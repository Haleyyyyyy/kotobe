"use client";
import { statusLabel, ratingLabel, partOfSpeechLabel } from "@/lib/locale";
import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "next/navigation";
import {
  Search,
  Plus,
  Upload,
  Star,
  ArrowUpRight,
  Download,
  Check,
  ChevronLeft,
  ChevronRight,
  Pencil,
} from "lucide-react";
import { useStore } from "./provider";
import { Modal, Empty, errorText, Stat } from "./ui";
import {
  LEVELS,
  type VocabularyInput,
  type Word,
  type ReviewLog,
} from "@/lib/types";
import { parseVocabulary, download, FIELDS } from "@/lib/import-export";
import { accuracy } from "@/lib/study";
const blank: VocabularyInput = {
  word: "",
  kana: "",
  romaji: "",
  meaning_zh: "",
  meaning_en: "",
  jlpt_level: "N1",
  part_of_speech: "Noun",
  example_sentence: "",
  example_kana: "",
  example_translation: "",
  notes: "",
  tags: [],
};
export function WordEditor({
  word,
  onClose,
}: {
  word?: Word;
  onClose: () => void;
}) {
  const { importWords, saveWord, notice } = useStore(),
    [form, setForm] = useState<VocabularyInput>(
      word
        ? (Object.fromEntries(
            FIELDS.map((k) => [k, word[k]]),
          ) as VocabularyInput)
        : blank,
    ),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  function field(
    key: keyof VocabularyInput,
    label: string,
    required = false,
    textarea = false,
  ) {
    return (
      <label key={key}>
        {label}
        {textarea ? (
          <textarea
            rows={3}
            value={String(form[key])}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        ) : (
          <input
            required={required}
            maxLength={key === "word" || key === "kana" ? 200 : undefined}
            value={String(form[key])}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
          />
        )}
      </label>
    );
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!form.meaning_zh.trim() && !form.meaning_en.trim()) {
      setError("请填写中文或英文释义。");
      return;
    }
    setBusy(true);
    try {
      const clean = { ...form, word: form.word.trim(), kana: form.kana.trim() };
      if (word) {
        await saveWord(word.id, clean);
        notice("词汇已更新。");
      } else notice(await importWords([clean], false));
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title={word ? "编辑词汇" : "添加新词汇"} onClose={onClose} wide>
      <form onSubmit={submit} className="word-form">
        <div className="form-grid">
          {field("word", "日语词汇", true)}
          {field("kana", "假名")}
          {field("meaning_zh", "中文释义")}
          {field("meaning_en", "英文释义")}
          <label>
            JLPT 等级
            <select
              value={form.jlpt_level}
              onChange={(e) =>
                setForm({
                  ...form,
                  jlpt_level: e.target.value as VocabularyInput["jlpt_level"],
                })
              }
            >
              {LEVELS.map((l) => (
                <option key={l}>{l}</option>
              ))}
            </select>
          </label>
          <label>
            词性
            <select
              value={form.part_of_speech}
              onChange={(e) =>
                setForm({ ...form, part_of_speech: e.target.value })
              }
            >
              {[
                "",
                "Noun",
                "Verb",
                "Adjective",
                "Adverb",
                "Expression",
                "Particle",
              ].map((p) => (
                <option key={p} value={p}>
                  {partOfSpeechLabel[p] || "请选择"}
                </option>
              ))}
            </select>
          </label>
          {field("romaji", "罗马字")}
          <label>
            标签（用分号分隔）
            <input
              value={form.tags.join(";")}
              onChange={(e) =>
                setForm({ ...form, tags: e.target.value.split(";") })
              }
            />
          </label>
        </div>
        {field("example_sentence", "例句", false, true)}
        {field("example_kana", "例句假名")}
        {field("example_translation", "例句翻译")}
        {field("notes", "个人笔记", false, true)}
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button type="button" className="button" onClick={onClose}>
            取消
          </button>
          <button disabled={busy} className="button primary">
            {busy ? "保存中…" : word ? "保存修改" : "添加词汇"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function ImportDialog({ onClose }: { onClose: () => void }) {
  const { words, importWords, notice } = useStore(),
    [rows, setRows] = useState<VocabularyInput[]>([]),
    [replace, setReplace] = useState(false),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [name, setName] = useState("");
  const seen = new Set(words.map((w) => JSON.stringify([w.word, w.kana])));
  let duplicates = 0;
  for (const row of rows) {
    const key = JSON.stringify([row.word, row.kana]);
    if (seen.has(key)) duplicates++;
    seen.add(key);
  }
  async function file(f: File | undefined) {
    if (!f) return;
    setRows([]);
    setError("");
    setName(f.name);
    try {
      setRows(parseVocabulary(await f.text(), f.name));
    } catch (e) {
      setError(errorText(e));
    }
  }
  async function confirm() {
    setBusy(true);
    try {
      notice(await importWords(rows, replace));
      onClose();
    } catch (e) {
      setError(errorText(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal title="导入词汇" onClose={onClose} wide>
      <p className="muted">导入 CSV 或 JSON 文件。已有学习记录会保留。</p>
      <label className="upload-zone">
        <Upload size={28} />
        <strong>{name || "选择词汇文件"}</strong>
        <span className="small muted">
          CSV 或 JSON · 不超过 5 MB · 最多 5,000 行
        </span>
        <input
          type="file"
          accept=".csv,.json"
          onChange={(e) => void file(e.target.files?.[0])}
        />
      </label>
      <button
        className="text-link"
        onClick={() =>
          download(
            "kotoba-template.csv",
            "word,kana,meaning_zh,meaning_en,jlpt_level,example_sentence\n見込む,みこむ,预料；预计,to anticipate,N1,今年は売上の増加が見込まれている。\n",
            "text/csv",
          )
        }
      >
        <Download size={15} /> 下载 CSV 模板
      </button>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      {rows.length > 0 && (
        <>
          <div className="import-summary">
            <strong>找到 {rows.length} 个词汇</strong>
            <span>{duplicates} 个重复词汇（词汇＋假名）</span>
          </div>
          <div className="table-scroll preview-table">
            <table>
              <thead>
                <tr>
                  <th>词汇</th>
                  <th>假名</th>
                  <th>释义</th>
                  <th>等级</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 10).map((r, i) => (
                  <tr key={i}>
                    <td lang="ja">{r.word}</td>
                    <td>{r.kana}</td>
                    <td>{r.meaning_zh || r.meaning_en}</td>
                    <td>{r.jlpt_level}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rows.length > 10 && (
            <p className="small muted">仅显示前 10 行，共 {rows.length} 行。</p>
          )}
          <fieldset className="duplicate-options">
            <legend>遇到重复词汇时</legend>
            <label>
              <input
                type="radio"
                name="duplicates"
                checked={!replace}
                onChange={() => setReplace(false)}
              />
              跳过重复词汇
            </label>
            <label>
              <input
                type="radio"
                name="duplicates"
                checked={replace}
                onChange={() => setReplace(true)}
              />
              替换词汇信息，保留学习进度
            </label>
          </fieldset>
        </>
      )}
      <div className="modal-actions">
        <button className="button" onClick={onClose}>
          取消
        </button>
        <button
          className="button primary"
          disabled={!rows.length || busy}
          onClick={() => void confirm()}
        >
          {busy ? "导入中…" : "确认导入"}
          <Check size={16} />
        </button>
      </div>
    </Modal>
  );
}
function Detail({
  word,
  onClose,
  onEdit,
}: {
  word: Word;
  onClose: () => void;
  onEdit: () => void;
}) {
  const { settings, history, setWord, notice } = useStore(),
    [logs, setLogs] = useState<ReviewLog[]>([]),
    [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    history(word.id)
      .then((x) => {
        if (active) setLogs(x);
      })
      .catch((e) => {
        if (active) setError(errorText(e));
      });
    return () => {
      active = false;
    };
  }, [word.id, history]);
  const p = word.progress,
    format = (date: string | null) =>
      date
        ? new Date(date).toLocaleString("zh-CN", {
            timeZone: settings.timezone,
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
          })
        : "暂无";
  return (
    <Modal title="词汇详情" onClose={onClose} wide>
      <div className="detail-heading">
        <div>
          <div className="detail-word" lang="ja">
            {word.word}
          </div>
          <p lang="ja" className="muted">
            {word.kana} {settings.show_romaji && `· ${word.romaji}`}
          </p>
        </div>
        <div className="flex">
          <button
            className={`icon-button ${p.favorite ? "favorited" : ""}`}
            aria-label={p.favorite ? "取消收藏" : "加入收藏"}
            onClick={() =>
              setWord(word.id, null, !p.favorite).catch((e) =>
                notice(errorText(e)),
              )
            }
          >
            <Star size={22} fill={p.favorite ? "currentColor" : "none"} />
          </button>
          <button className="button" onClick={onEdit}>
            <Pencil size={15} />
            编辑
          </button>
        </div>
      </div>
      <div className="flex">
        <span className="badge purple">{word.jlpt_level}</span>
        <span className="badge">
          {partOfSpeechLabel[word.part_of_speech] ||
            word.part_of_speech ||
            "未指定"}
        </span>
        <span className={`status ${p.status}`}>{statusLabel[p.status]}</span>
      </div>
      <h3>
        {settings.preferred_language === "zh"
          ? word.meaning_zh || word.meaning_en
          : word.meaning_en || word.meaning_zh}
      </h3>
      <p className="muted">
        {settings.preferred_language === "zh"
          ? word.meaning_en
          : word.meaning_zh}
      </p>
      {word.example_sentence && (
        <div className="example">
          <p lang="ja">{word.example_sentence}</p>
          {word.example_kana && (
            <p className="small muted" lang="ja">
              {word.example_kana}
            </p>
          )}
          {settings.show_translation && (
            <p className="muted">{word.example_translation}</p>
          )}
        </div>
      )}
      <div className="tags">
        {word.tags.map((t, i) => (
          <span className="badge" key={`${t}-${i}`}>
            #{t}
          </span>
        ))}
      </div>
      {word.notes && (
        <div className="notes">
          <strong>我的笔记</strong>
          <p>{word.notes}</p>
        </div>
      )}
      <div className="detail-actions">
        <button
          className="button"
          onClick={() =>
            setWord(word.id, "mastered", null).catch((e) =>
              notice(errorText(e)),
            )
          }
        >
          标记为已掌握
        </button>
        <button
          className="button"
          onClick={() =>
            setWord(word.id, "new", null).catch((e) => notice(errorText(e)))
          }
        >
          标记为不认识
        </button>
      </div>
      <h3>我的学习记录</h3>
      <div className="detail-stats">
        <Stat label="复习" value={p.review_count} />
        <Stat label="答对" value={p.correct_count} />
        <Stat label="错误" value={p.incorrect_count} />
        <Stat
          label="正确率"
          value={`${accuracy(p.correct_count, p.review_count)}%`}
        />
      </div>
      <dl className="date-list">
        <dt>首次学习</dt>
        <dd>{format(p.first_learned_at)}</dd>
        <dt>上次复习</dt>
        <dd>{format(p.last_reviewed_at)}</dd>
        <dt>下次复习</dt>
        <dd>{format(p.next_review_at)}</dd>
      </dl>
      <h3>复习记录</h3>
      {error && <p className="error">{error}</p>}
      {logs.length ? (
        logs.map((log) => (
          <div className="history-row" key={log.id}>
            <span>{format(log.client_reviewed_at)}</span>
            <span className={`rating-text rating-${log.rating}`}>
              {ratingLabel[log.rating]}
            </span>
          </div>
        ))
      ) : (
        <p className="muted small">还没有复习记录。</p>
      )}
    </Modal>
  );
}
export function VocabularyPage() {
  const s = useStore(),
    params = useSearchParams(),
    [search, setSearch] = useState(""),
    [level, setLevel] = useState(params.get("level") || "All"),
    [status, setStatus] = useState("All"),
    [tag, setTag] = useState("All"),
    [pos, setPos] = useState("All"),
    [difficulty, setDifficulty] = useState("All"),
    [favorites, setFavorites] = useState(false),
    [page, setPage] = useState(0),
    [importing, setImporting] = useState(false),
    [editing, setEditing] = useState<Word | "new" | null>(null),
    [detail, setDetail] = useState<string | null>(params.get("word"));
  const filtered = s.words
    .filter((w) => {
      const q = search.toLowerCase();
      return (
        (!q ||
          [w.word, w.kana, w.meaning_zh, w.meaning_en].some((v) =>
            v.toLowerCase().includes(q),
          )) &&
        (level === "All" || w.jlpt_level === level) &&
        (status === "All" || w.progress.status === status) &&
        (tag === "All" || w.tags.includes(tag)) &&
        (pos === "All" || w.part_of_speech === pos) &&
        (difficulty === "All" ||
          (difficulty === "Hard"
            ? w.progress.difficulty >= 6
            : w.progress.difficulty < 6)) &&
        (!favorites || w.progress.favorite)
      );
    })
    .sort(
      (a, b) =>
        a.jlpt_level.localeCompare(b.jlpt_level) ||
        a.word.localeCompare(b.word, "ja"),
    );
  const currentPage = Math.min(
      page,
      Math.max(0, Math.ceil(filtered.length / 15) - 1),
    ),
    selected = s.words.find((w) => w.id === detail);
  function filter(value: string, set: (s: string) => void) {
    set(value);
    setPage(0);
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">不断积累的词汇</span>
          <h1>记住更多词汇。</h1>
          <p>已收录 {s.words.length} 个词汇，继续积累吧。</p>
        </div>
        <div className="flex">
          <button className="button" onClick={() => setImporting(true)}>
            <Upload size={16} />
            导入
          </button>
          <button className="button primary" onClick={() => setEditing("new")}>
            <Plus size={17} />
            添加词汇
          </button>
        </div>
      </div>
      <div className="vocabulary-tabs">
        <button
          className={!favorites ? "active" : ""}
          onClick={() => {
            setFavorites(false);
            setPage(0);
          }}
        >
          全部词汇 <span>{s.words.length}</span>
        </button>
        <button
          className={favorites ? "active" : ""}
          onClick={() => {
            setFavorites(true);
            setPage(0);
          }}
        >
          <Star size={16} />
          收藏 <span>{s.words.filter((w) => w.progress.favorite).length}</span>
        </button>
      </div>
      <section className="panel vocabulary-panel">
        <div className="filter-bar">
          <label className="search-box">
            <Search size={18} />
            <input
              aria-label="搜索词汇"
              placeholder="搜索日语、假名或释义…"
              value={search}
              onChange={(e) => filter(e.target.value, setSearch)}
            />
          </label>
          <label className="sr-only" htmlFor="level">
            JLPT 等级
          </label>
          <select
            id="level"
            value={level}
            onChange={(e) => filter(e.target.value, setLevel)}
          >
            <option value="All">全部等级</option>
            {LEVELS.map((l) => (
              <option key={l}>{l}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="status">
            学习状态
          </label>
          <select
            id="status"
            value={status}
            onChange={(e) => filter(e.target.value, setStatus)}
          >
            <option value="All">全部状态</option>
            {["new", "learning", "review", "mastered"].map((l) => (
              <option key={l} value={l}>
                {statusLabel[l as keyof typeof statusLabel]}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="tag">
            标签
          </label>
          <select
            id="tag"
            value={tag}
            onChange={(e) => filter(e.target.value, setTag)}
          >
            <option value="All">全部标签</option>
            {[...new Set(s.words.flatMap((w) => w.tags))].map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="sr-only" htmlFor="pos">
            词性
          </label>
          <select
            id="pos"
            value={pos}
            onChange={(e) => filter(e.target.value, setPos)}
          >
            <option value="All">全部词性</option>
            {[...new Set(s.words.map((w) => w.part_of_speech))]
              .filter(Boolean)
              .map((t) => (
                <option key={t} value={t}>
                  {partOfSpeechLabel[t] || t}
                </option>
              ))}
          </select>
          <label className="sr-only" htmlFor="difficulty">
            难度
          </label>
          <select
            id="difficulty"
            value={difficulty}
            onChange={(e) => filter(e.target.value, setDifficulty)}
          >
            <option value="All">全部难度</option>
            <option value="Hard">较难</option>
            <option value="Normal">普通</option>
          </select>
        </div>
        {filtered.length ? (
          <>
            <div className="table-scroll">
              <table className="vocab-table">
                <thead>
                  <tr>
                    <th>词汇</th>
                    <th>释义</th>
                    <th>等级</th>
                    <th>状态</th>
                    <th>正确率</th>
                    <th>
                      <span className="sr-only">收藏</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filtered
                    .slice(currentPage * 15, currentPage * 15 + 15)
                    .map((w) => (
                      <tr key={w.id}>
                        <td>
                          <button
                            className="word-link"
                            onClick={() => setDetail(w.id)}
                          >
                            <strong lang="ja">{w.word}</strong>
                            <span lang="ja">{w.kana}</span>
                          </button>
                        </td>
                        <td className="meaning-cell">
                          {s.settings.preferred_language === "zh"
                            ? w.meaning_zh || w.meaning_en
                            : w.meaning_en || w.meaning_zh}
                          <span className="small muted">
                            {partOfSpeechLabel[w.part_of_speech] ||
                              w.part_of_speech}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`badge ${w.jlpt_level === "N1" ? "purple" : ""}`}
                          >
                            {w.jlpt_level}
                          </span>
                        </td>
                        <td>
                          <span className={`status ${w.progress.status}`}>
                            {statusLabel[w.progress.status]}
                          </span>
                        </td>
                        <td>
                          {w.progress.review_count
                            ? `${accuracy(w.progress.correct_count, w.progress.review_count)}%`
                            : "—"}
                        </td>
                        <td>
                          <button
                            className={`icon-button ${w.progress.favorite ? "favorited" : ""}`}
                            aria-label={`${w.progress.favorite ? "取消收藏" : "收藏"} ${w.word}`}
                            onClick={() =>
                              s
                                .setWord(w.id, null, !w.progress.favorite)
                                .catch((e) => s.notice(errorText(e)))
                            }
                          >
                            <Star
                              size={18}
                              fill={
                                w.progress.favorite ? "currentColor" : "none"
                              }
                            />
                          </button>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>
                {currentPage * 15 + 1}–
                {Math.min(filtered.length, currentPage * 15 + 15)}，共{" "}
                {filtered.length} 个词汇
              </span>
              <div className="flex">
                <button
                  className="icon-button"
                  disabled={currentPage === 0}
                  aria-label="上一页"
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={19} />
                </button>
                <span>第 {currentPage + 1} 页</span>
                <button
                  className="icon-button"
                  disabled={(currentPage + 1) * 15 >= filtered.length}
                  aria-label="下一页"
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={19} />
                </button>
              </div>
            </div>
          </>
        ) : (
          <Empty
            title={s.words.length ? "没有符合条件的词汇" : "从第一个词汇开始"}
            description={
              s.words.length
                ? "试试其他搜索词或筛选条件。"
                : "添加词汇，或导入词汇表。"
            }
          >
            <button
              className="button primary"
              onClick={() => setEditing("new")}
            >
              添加第一个词汇 <ArrowUpRight size={16} />
            </button>
          </Empty>
        )}
      </section>
      {importing && <ImportDialog onClose={() => setImporting(false)} />}{" "}
      {editing && (
        <WordEditor
          word={editing === "new" ? undefined : editing}
          onClose={() => setEditing(null)}
        />
      )}{" "}
      {selected && !editing && (
        <Detail
          word={selected}
          onClose={() => setDetail(null)}
          onEdit={() => setEditing(selected)}
        />
      )}
    </>
  );
}
