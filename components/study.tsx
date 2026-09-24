"use client";
import { statusLabel } from "@/lib/locale";
import { useNow } from "@/lib/use-now";
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ArrowRight,
  RotateCcw,
  Star,
  Check,
  Target,
  Clock,
  Layers,
  ArrowLeft,
} from "lucide-react";
import { useStore } from "./provider";
import {
  accuracy,
  dayKey,
  makeQueue,
  schedule,
  intervalLabel,
  weak,
} from "@/lib/study";
import type { Word, Rating, Day } from "@/lib/types";
import { Empty, Stat, errorText } from "./ui";
const labels = ["重来", "较难", "记得", "轻松"] as const;
export function Study() {
  const s = useStore(),
    params = useSearchParams(),
    mode =
      params.get("mode") === "weak"
        ? "weak"
        : params.get("mode") === "due"
          ? "due"
          : "normal";
  const [queue, setQueue] = useState<Word[] | null>(null),
    [index, setIndex] = useState(0),
    [flipped, setFlipped] = useState(false),
    [busy, setBusy] = useState(false),
    [answers, setAnswers] = useState<
      { rating: Rating; isNew: boolean; duration: number }[]
    >([]),
    [sessionId] = useState(() => crypto.randomUUID()),
    started = useRef(0),
    locked = useRef(false),
    swiped = useRef(false),
    touch = useRef<{ x: number; y: number } | null>(null);
  const today = s.days.find(
    (d) => d.study_date === dayKey(new Date(), s.settings.timezone),
  );
  useEffect(() => {
    if (queue === null) {
      const key = dayKey(new Date(), s.settings.timezone);
      const pendingToday = s.pending.filter(
        (a) =>
          !a.error &&
          dayKey(new Date(a.reviewedAt), s.settings.timezone) === key,
      );
      const pendingNew = pendingToday.filter(
        (a) =>
          s.words.find((w) => w.id === a.wordId)?.progress.status === "new",
      ).length;
      const used: Day = {
        ...(today || {
          user_id: "",
          study_date: key,
          correct_answers: 0,
          incorrect_answers: 0,
          duration_ms: 0,
        }),
        new_words: (today?.new_words || 0) + pendingNew,
        reviews: (today?.reviews || 0) + pendingToday.length - pendingNew,
      };
      setQueue(
        makeQueue(
          s.words.filter((w) => !s.pending.some((a) => a.wordId === w.id)),
          s.settings,
          used,
          mode,
        ),
      );
      started.current = Date.now();
    }
  }, [queue, s.words, s.pending, s.settings, today, mode]);
  const w = queue?.[index];
  const grade = useCallback(
    async (rating: Rating) => {
      if (!w || !flipped || locked.current) return;
      locked.current = true;
      setBusy(true);
      try {
        const duration = Math.min(600000, Date.now() - started.current);
        await s.review(w, rating, sessionId, duration);
        setAnswers((a) => [
          ...a,
          { rating, isNew: w.progress.status === "new", duration },
        ]);
        setIndex((i) => i + 1);
        setFlipped(false);
        started.current = Date.now();
      } catch (e) {
        s.notice(errorText(e));
      } finally {
        locked.current = false;
        setBusy(false);
      }
    },
    [w, flipped, s, sessionId],
  );
  useEffect(() => {
    function key(e: KeyboardEvent) {
      if (
        e.target instanceof HTMLElement &&
        ["INPUT", "TEXTAREA", "SELECT"].includes(e.target.tagName)
      )
        return;
      if (e.code === "Space") {
        e.preventDefault();
        setFlipped((v) => !v);
      }
      if (["1", "2", "3", "4"].includes(e.key))
        void grade(Number(e.key) as Rating);
    }
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [grade]);
  useEffect(() => {
    function before(e: BeforeUnloadEvent) {
      if (answers.length && w) {
        e.preventDefault();
        e.returnValue = "";
      }
    }
    window.addEventListener("beforeunload", before);
    return () => window.removeEventListener("beforeunload", before);
  }, [answers.length, w]);
  if (queue === null) return <p>正在准备学习卡片…</p>;
  if (!queue.length)
    return (
      <>
        <div className="page-heading">
          <div>
            <span className="eyebrow">今日进度</span>
            <h1>今天已经学完了。</h1>
          </div>
        </div>
        <Empty
          title="当前没有可学的词汇"
          description="学习列表根据每日上限、所选等级和复习时间生成。待同步的答案完成同步后才能再次学习。"
        >
          <Link href="/vocabulary" className="button primary">
            浏览词汇 <ArrowRight size={17} />
          </Link>
          <Link href="/settings" className="button">
            学习设置
          </Link>
        </Empty>
      </>
    );
  if (!w) {
    const correct = answers.filter((a) => a.rating > 1).length;
    return (
      <div className="session-complete">
        <div className="complete-icon">
          <Check size={34} />
        </div>
        <span className="eyebrow">今天又进步了一点</span>
        <h1>本次学习完成。</h1>
        <p>坚持学习，记住这些词汇会越来越容易。</p>
        <div className="stats-row">
          <Stat label="学习词数" value={answers.length} />
          <Stat
            label="正确率"
            value={`${accuracy(correct, answers.length)}%`}
          />
          <Stat
            label="用时"
            value={`${Math.max(1, Math.round(answers.reduce((n, a) => n + a.duration, 0) / 60000))} min`}
          />
        </div>
        <p>
          {answers.filter((a) => a.isNew).length} 个新词 ·{" "}
          {answers.filter((a) => !a.isNew).length} 次复习
        </p>
        <div className="rating-summary">
          {labels.map((label, i) => (
            <div key={label}>
              <span className={`rating-text rating-${i + 1}`}>{label}</span>
              <strong>
                {answers.filter((a) => a.rating === i + 1).length}
              </strong>
            </div>
          ))}
        </div>
        <p className="small muted">
          {s.demo
            ? "演示模式的学习记录不会永久保存。"
            : s.pending.length
              ? `还有 ${s.pending.length} 条答案待同步，请在同步完成前保留此设备上的数据。`
              : "学习进度已保存到账号。"}
        </p>
        <Link className="button primary" href="/">
          返回首页 <ArrowRight size={17} />
        </Link>
      </div>
    );
  }
  const progress = s.words.find((x) => x.id === w.id)?.progress || w.progress;
  return (
    <div className="study-layout">
      <div className="study-heading">
        <Link href="/" className="text-link">
          <ArrowLeft size={16} />
          结束学习
        </Link>
        <span>
          {mode === "weak"
            ? "易错词练习"
            : mode === "due"
              ? "到期复习"
              : "每日学习"}
        </span>
        <strong>
          {index + 1} <span className="muted">/ {queue.length}</span>
        </strong>
      </div>
      <div className="session-progress">
        <span style={{ width: `${(index / queue.length) * 100}%` }} />
      </div>
      <div className="study-meta">
        <span className="badge purple">{w.jlpt_level}</span>
        <span className={`status ${w.progress.status}`}>
          {statusLabel[w.progress.status]}
        </span>
        <button
          className={`icon-button ${progress.favorite ? "favorited" : ""}`}
          aria-label="切换收藏"
          onClick={() =>
            s
              .setWord(w.id, null, !progress.favorite)
              .catch((e) => s.notice(errorText(e)))
          }
        >
          <Star size={19} fill={progress.favorite ? "currentColor" : "none"} />
        </button>
      </div>
      <button
        className={`flashcard ${flipped ? "flipped" : ""}`}
        aria-label={flipped ? "隐藏答案" : "显示答案"}
        onClick={() => {
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          setFlipped((v) => !v);
        }}
        onTouchStart={(e) => {
          touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        }}
        onTouchEnd={(e) => {
          if (!touch.current) return;
          const dx = e.changedTouches[0].clientX - touch.current.x,
            dy = e.changedTouches[0].clientY - touch.current.y;
          if (Math.abs(dx) > 80 && Math.abs(dx) > Math.abs(dy)) {
            swiped.current = true;
            if (!flipped) setFlipped(true);
            else void grade(dx > 0 ? 3 : 1);
          }
          touch.current = null;
        }}
      >
        <span className="eyebrow">
          {flipped ? "记住这个词" : "这个词是什么意思？"}
        </span>
        <span className="flash-word" lang="ja">
          {w.word}
        </span>
        {flipped ? (
          <>
            <span className="flash-kana" lang="ja">
              {w.kana}
            </span>
            {s.settings.show_romaji && (
              <span className="muted">{w.romaji}</span>
            )}
            <span className="flash-meaning">
              {s.settings.preferred_language === "zh"
                ? w.meaning_zh || w.meaning_en
                : w.meaning_en || w.meaning_zh}
            </span>
            {w.example_sentence && (
              <span className="flash-example">
                <span lang="ja">{w.example_sentence}</span>
                {s.settings.show_translation && (
                  <span className="muted">{w.example_translation}</span>
                )}
              </span>
            )}
          </>
        ) : (
          <span className="flip-hint">
            <RotateCcw size={15} />
            点击翻面 · 空格键
          </span>
        )}
      </button>
      {flipped ? (
        <>
          <p className="grade-prompt">你记得怎么样？</p>
          <div className="grade-buttons">
            {labels.map((label, i) => (
              <button
                key={label}
                disabled={busy}
                className={`grade grade-${i + 1}`}
                onClick={() => void grade((i + 1) as Rating)}
              >
                <span>
                  <kbd>{i + 1}</kbd>
                  {label}
                </span>
                <small>
                  {intervalLabel(
                    schedule(w.progress, (i + 1) as Rating).interval_days,
                  )}
                </small>
              </button>
            ))}
          </div>
        </>
      ) : (
        <button
          className="button primary reveal"
          onClick={() => setFlipped(true)}
        >
          显示答案 <span className="keycap">space</span>
        </button>
      )}
      <div className="study-footer">
        <span>
          <Target size={14} />
          {answers.length
            ? accuracy(
                answers.filter((a) => a.rating > 1).length,
                answers.length,
              )
            : "—"}
          % 正确率
        </span>
        <span>右滑：记得 · 左滑：重来</span>
        <span>
          <Layers size={14} />
          {queue.length - index} 张待学习
        </span>
      </div>
    </div>
  );
}
export function Review() {
  const now = useNow();
  const { words, settings } = useStore(),
    params = useSearchParams(),
    [tab, setTab] = useState(params.get("tab") === "weak" ? "weak" : "due"),
    [sort, setSort] = useState("mistakes");
  const due = words.filter(
      (w) =>
        w.progress.next_review_at &&
        Date.parse(w.progress.next_review_at) <= now,
    ),
    weakWords = words.filter(weak),
    list = [...(tab === "weak" ? weakWords : due)].sort((a, b) =>
      sort === "accuracy"
        ? accuracy(a.progress.correct_count, a.progress.review_count) -
          accuracy(b.progress.correct_count, b.progress.review_count)
        : sort === "recent"
          ? (b.progress.last_forgotten_at || "").localeCompare(
              a.progress.last_forgotten_at || "",
            )
          : b.progress.incorrect_count - a.progress.incorrect_count,
    );
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">巩固记忆</span>
          <h1>复习，让记忆更牢。</h1>
          <p>先看看最需要巩固的词汇。</p>
        </div>
      </div>
      <div className="review-cards">
        <section className="panel">
          <Clock size={24} />
          <span className="eyebrow">到期复习</span>
          <h2>{due.length} 个词待复习</h2>
          <p>按照复习计划及时巩固。</p>
          <Link className="button primary" href="/study?mode=due">
            开始到期复习 <ArrowRight size={17} />
          </Link>
        </section>
        <section className="panel weak-card">
          <Target size={24} />
          <span className="eyebrow">重点巩固</span>
          <h2>{weakWords.length} 个易错词</h2>
          <p>容易忘记的词，值得多看几遍。</p>
          <Link className="button" href="/study?mode=weak">
            复习易错词 <ArrowRight size={17} />
          </Link>
        </section>
      </div>
      <div className="section-title">
        <div className="vocabulary-tabs">
          <button
            className={tab === "due" ? "active" : ""}
            onClick={() => setTab("due")}
          >
            待复习 ({due.length})
          </button>
          <button
            className={tab === "weak" ? "active" : ""}
            onClick={() => setTab("weak")}
          >
            易错词 ({weakWords.length})
          </button>
        </div>
        <select
          aria-label="复习词汇排序"
          value={sort}
          onChange={(e) => setSort(e.target.value)}
        >
          <option value="mistakes">错误次数最多</option>
          <option value="accuracy">正确率最低</option>
          <option value="recent">最近忘记</option>
        </select>
      </div>
      <section className="panel">
        {list.length ? (
          <div className="review-list">
            {list.map((w) => (
              <Link
                key={w.id}
                href={`/vocabulary?word=${w.id}`}
                className="review-word"
              >
                <div>
                  <strong lang="ja">{w.word}</strong>
                  <span lang="ja">{w.kana}</span>
                </div>
                <p>
                  {settings.preferred_language === "zh"
                    ? w.meaning_zh
                    : w.meaning_en}
                </p>
                <span className="badge purple">{w.jlpt_level}</span>
                <span className="muted small">
                  答错 {w.progress.incorrect_count} 次
                </span>
                <span>
                  {accuracy(w.progress.correct_count, w.progress.review_count)}%
                </span>
                <ArrowRight size={16} />
              </Link>
            ))}
          </div>
        ) : (
          <Empty
            title={tab === "weak" ? "记得不错" : "已完成当前复习"}
            description={
              tab === "weak"
                ? "多次答错或正确率低于 70% 的词汇会显示在这里。"
                : "词汇到达复习时间后会显示在这里。"
            }
          />
        )}
      </section>
    </>
  );
}
