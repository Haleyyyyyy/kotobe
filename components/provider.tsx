"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { demoSnapshot } from "@/lib/demo";
import {
  defaultSettings,
  type Snapshot,
  type ReviewAction,
  type Rating,
  type Word,
  type VocabularyInput,
  type Settings,
  type ReviewLog,
  type Progress,
  type Day,
  type Vocabulary,
} from "@/lib/types";
import { schedule, dayKey } from "@/lib/study";
import * as offline from "@/lib/offline";
type Store = Snapshot & {
  user: User | null;
  demo: boolean;
  loading: boolean;
  online: boolean;
  pending: ReviewAction[];
  message: string;
  recovery: boolean;
  notice: (s: string) => void;
  enterDemo: () => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  review: (
    w: Word,
    r: Rating,
    session: string,
    duration: number,
  ) => Promise<void>;
  importWords: (rows: VocabularyInput[], replace: boolean) => Promise<string>;
  setWord: (
    id: string,
    status: "new" | "mastered" | null,
    favorite: boolean | null,
  ) => Promise<void>;
  saveWord: (id: string, input: VocabularyInput) => Promise<void>;
  saveSettings: (s: Settings) => Promise<void>;
  history: (id?: string) => Promise<ReviewLog[]>;
  sync: () => Promise<void>;
  discard: (id: string) => Promise<void>;
  finishRecovery: () => void;
};
const Context = createContext<Store | null>(null);
const empty: Snapshot = { words: [], days: [], settings: defaultSettings };
// Fetch every page, rather than silently truncating a long-term vocabulary collection at 1,000 rows.
async function rows<T>(
  table: string,
  order: string,
  filter?: { key: string; value: string },
): Promise<T[]> {
  const all: T[] = [];
  for (let offset = 0; ; offset += 1000) {
    let query = supabase!
      .from(table)
      .select("*")
      .order(order)
      .range(offset, offset + 999);
    if (filter) query = query.eq(filter.key, filter.value);
    const { data, error } = await query;
    if (error) throw error;
    all.push(...(data as T[]));
    if (data.length < 1000) return all;
  }
}
export function Provider({ children }: { children: ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot>(empty),
    [user, setUser] = useState<User | null>(null),
    [demo, setDemo] = useState(false),
    [loading, setLoading] = useState(true),
    [online, setOnline] = useState(true),
    [pending, setPending] = useState<ReviewAction[]>([]),
    [message, setMessage] = useState(""),
    [recovery, setRecovery] = useState(false);
  const syncing = useRef(false),
    identity = useRef<string | null>(null),
    demoLogs = useRef<ReviewLog[]>([]);
  const notice = useCallback((s: string) => setMessage(s), []);
  const refresh = useCallback(async () => {
    if (!user || !supabase || demo) return;
    const uid = user.id;
    try {
      if (!navigator.onLine) {
        const cached = await offline.readSnapshot(uid);
        if (cached && identity.current === uid) setSnapshot(cached);
        setPending(await offline.pending(uid));
        return;
      }
      const [vocabulary, progress, days, settings] = await Promise.all([
        rows<Vocabulary>("vocabulary", "id"),
        rows<Progress>("user_vocabulary", "id"),
        rows<Day>("daily_statistics", "study_date"),
        supabase.from("user_settings").select("*").eq("user_id", uid).single(),
      ]);
      if (settings.error) throw settings.error;
      if (identity.current !== uid) return;
      const map = new Map(progress.map((p) => [p.vocabulary_id, p]));
      const next = {
        words: vocabulary
          .map((v) => ({ ...v, progress: map.get(v.id)! }))
          .filter((w) => w.progress),
        days,
        settings: settings.data as Settings,
      };
      setSnapshot(next);
      await offline.cacheSnapshot(uid, next);
      setPending(await offline.pending(uid));
    } catch (e) {
      if (identity.current !== uid) return;
      const cached = await offline.readSnapshot(uid).catch(() => undefined);
      if (cached && !navigator.onLine) setSnapshot(cached);
      if (navigator.onLine)
        notice(
          e instanceof Error
            ? e.message
            : String(
                (e as { message?: string }).message || "无法加载学习数据。",
              ),
        );
    } finally {
      setLoading(false);
    }
  }, [user, demo, notice]);
  const sync = useCallback(async () => {
    if (!user || !supabase || demo || syncing.current || !navigator.onLine)
      return;
    syncing.current = true;
    try {
      for (const action of await offline.pending(user.id)) {
        if (identity.current !== user.id) break;
        if (action.error) continue;
        const { error } = await supabase.rpc("submit_review", {
          p_action_id: action.id,
          p_vocabulary_id: action.wordId,
          p_session_id: action.sessionId,
          p_rating: action.rating,
          p_expected_version: action.version,
          p_client_reviewed_at: action.reviewedAt,
          p_duration_ms: action.durationMs,
        });
        if (error) {
          if (
            error.message.includes("STALE_REVIEW") ||
            error.message.includes("Word not found")
          ) {
            await offline.putAction({ ...action, error: error.message });
            notice("该词汇已在其他设备更新，请到设置处理待同步的复习。");
            continue;
          }
          notice("复习答案已保存在此设备，稍后会重试同步。");
          break;
        }
        await offline.removeAction(action.id);
      }
      await refresh();
    } catch (e) {
      notice(
        `同步暂停： ${e instanceof Error ? e.message : "请重新连接后重试。"}`,
      );
    } finally {
      syncing.current = false;
    }
  }, [user, demo, refresh, notice]);
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) notice(error.message);
      identity.current = data.session?.user.id || null;
      setUser(data.session?.user || null);
      if (!data.session) setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      const nextIdentity = session?.user.id || null;
      if (identity.current !== nextIdentity) {
        setSnapshot(empty);
        setPending([]);
        setLoading(Boolean(session));
      }
      identity.current = nextIdentity;
      setUser(session?.user || null);
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (event === "SIGNED_OUT") {
        setSnapshot(empty);
        setPending([]);
      }
      if (session) setDemo(false);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, [notice]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  useEffect(() => {
    const update = () => {
      setOnline(navigator.onLine);
      if (navigator.onLine) void sync();
    };
    setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    window.addEventListener("focus", update);
    const timer = setInterval(update, 30000);
    void sync();
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
      window.removeEventListener("focus", update);
      clearInterval(timer);
    };
  }, [sync]);
  useEffect(() => {
    if (!supabase || !user) return;
    const channel = supabase
      .channel(`kotoba-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", filter: `user_id=eq.${user.id}` },
        () => void refresh(),
      )
      .subscribe();
    return () => {
      void supabase!.removeChannel(channel);
    };
  }, [user, refresh]);
  useEffect(() => {
    const m = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        snapshot.settings.theme === "system"
          ? m.matches
            ? "dark"
            : "light"
          : snapshot.settings.theme);
    apply();
    m.addEventListener("change", apply);
    return () => m.removeEventListener("change", apply);
  }, [snapshot.settings.theme]);
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production")
      void navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  async function logout() {
    if (user && (await offline.pending(user.id)).length) {
      notice("退出登录前，请先同步或处理待同步的复习。");
      return;
    }
    if (user) await offline.clearSnapshot(user.id);
    if (supabase) {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
    setDemo(false);
    setSnapshot(empty);
    setUser(null);
    identity.current = null;
  }
  async function review(w: Word, r: Rating, session: string, duration: number) {
    if (demo) {
      const time = new Date(),
        key = dayKey(time, snapshot.settings.timezone),
        isNew = w.progress.status === "new";
      demoLogs.current.push({
        id: crypto.randomUUID(),
        action_id: crypto.randomUUID(),
        user_id: "demo",
        vocabulary_id: w.id,
        session_id: session,
        rating: r,
        reviewed_at: time.toISOString(),
        client_reviewed_at: time.toISOString(),
        study_date: key,
        was_new: isNew,
        previous_interval: w.progress.interval_days,
        next_interval: schedule(w.progress, r).interval_days,
        duration_ms: duration,
      });
      setSnapshot((s) => {
        const days = [...s.days],
          index = days.findIndex((d) => d.study_date === key),
          d =
            index >= 0
              ? days[index]
              : {
                  user_id: "demo",
                  study_date: key,
                  new_words: 0,
                  reviews: 0,
                  correct_answers: 0,
                  incorrect_answers: 0,
                  duration_ms: 0,
                };
        const next = {
          ...d,
          new_words: d.new_words + Number(isNew),
          reviews: d.reviews + Number(!isNew),
          correct_answers: d.correct_answers + Number(r > 1),
          incorrect_answers: d.incorrect_answers + Number(r === 1),
          duration_ms: d.duration_ms + duration,
        };
        if (index >= 0) days[index] = next;
        else days.push(next);
        return {
          ...s,
          days,
          words: s.words.map((x) =>
            x.id === w.id ? { ...x, progress: schedule(x.progress, r) } : x,
          ),
        };
      });
      return;
    }
    if (!user) throw new Error("请先登录。");
    const action: ReviewAction = {
      id: crypto.randomUUID(),
      userId: user.id,
      wordId: w.id,
      sessionId: session,
      rating: r,
      version: w.progress.version,
      reviewedAt: new Date().toISOString(),
      durationMs: Math.min(duration, 600000),
    };
    await offline.putAction(action);
    setPending(await offline.pending(user.id));
    await sync();
  }
  async function importWords(input: VocabularyInput[], replace: boolean) {
    if (demo) {
      const next = [...snapshot.words];
      let added = 0,
        replaced = 0,
        skipped = 0;
      const { freshProgress } = await import("@/lib/types");
      for (const item of input) {
        const index = next.findIndex(
          (w) => w.word === item.word && w.kana === item.kana,
        );
        if (index >= 0) {
          if (replace) {
            next[index] = { ...next[index], ...item };
            replaced++;
          } else skipped++;
        } else {
          const id = crypto.randomUUID();
          next.push({
            ...item,
            id,
            user_id: "demo",
            created_at: new Date().toISOString(),
            progress: freshProgress(id, "demo"),
          });
          added++;
        }
      }
      setSnapshot((s) => ({ ...s, words: next }));
      return `${added} added · ${replaced} replaced · ${skipped} skipped`;
    }
    const { data, error } = await supabase!.rpc("import_vocabulary", {
      p_rows: input,
      p_replace: replace,
    });
    if (error) throw error;
    await refresh();
    return `${data.inserted} added · ${data.replaced} replaced · ${data.skipped} skipped`;
  }
  async function setWord(
    id: string,
    status: "new" | "mastered" | null,
    favorite: boolean | null,
  ) {
    if (demo)
      setSnapshot((s) => ({
        ...s,
        words: s.words.map((w) =>
          w.id === id
            ? {
                ...w,
                progress: {
                  ...w.progress,
                  status: status ?? w.progress.status,
                  favorite: favorite ?? w.progress.favorite,
                  next_review_at:
                    status === "new"
                      ? null
                      : status === "mastered"
                        ? new Date(Date.now() + 30 * 86400000).toISOString()
                        : w.progress.next_review_at,
                },
              }
            : w,
        ),
      }));
    else {
      const { error } = await supabase!.rpc("set_word_state", {
        p_vocabulary_id: id,
        p_status: status,
        p_favorite: favorite,
      });
      if (error) throw error;
      await refresh();
    }
  }
  async function saveWord(id: string, input: VocabularyInput) {
    if (demo)
      setSnapshot((s) => ({
        ...s,
        words: s.words.map((w) => (w.id === id ? { ...w, ...input } : w)),
      }));
    else {
      const { error } = await supabase!
        .from("vocabulary")
        .update(input)
        .eq("id", id);
      if (error) throw error;
      await refresh();
    }
  }
  async function saveSettings(s: Settings) {
    if (!demo) {
      const { error } = await supabase!
        .from("user_settings")
        .update({ ...s, user_id: user!.id })
        .eq("user_id", user!.id);
      if (error) throw error;
    }
    setSnapshot((v) => ({ ...v, settings: s }));
    notice("设置已保存。");
  }
  async function history(id?: string) {
    if (demo)
      return demoLogs.current
        .filter((l) => !id || l.vocabulary_id === id)
        .reverse();
    const all = await rows<ReviewLog>(
      "review_logs",
      "id",
      id ? { key: "vocabulary_id", value: id } : undefined,
    );
    return all
      .filter((l) => !id || l.vocabulary_id === id)
      .sort((a, b) => b.reviewed_at.localeCompare(a.reviewed_at));
  }
  return (
    <Context.Provider
      value={{
        ...snapshot,
        user,
        demo,
        loading,
        online,
        pending,
        message,
        recovery,
        notice,
        enterDemo: () => {
          setSnapshot(demoSnapshot());
          setDemo(true);
          setLoading(false);
        },
        logout,
        refresh,
        review,
        importWords,
        setWord,
        saveWord,
        saveSettings,
        history,
        sync,
        discard: async (id) => {
          await offline.removeAction(id);
          if (user) setPending(await offline.pending(user.id));
          await refresh();
        },
        finishRecovery: () => setRecovery(false),
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const c = useContext(Context);
  if (!c) throw new Error("Missing provider");
  return c;
}
