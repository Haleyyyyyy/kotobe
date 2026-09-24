"use client";
import { useNow } from "@/lib/use-now";
import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Flame,
  BookOpen,
  Target,
  Timer,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  Check,
  Layers,
  Star,
} from "lucide-react";
import { useStore } from "./provider";
import { SectionTitle, Stat, Empty } from "./ui";
import { accuracy, dayKey, shiftDay, streaks, weak } from "@/lib/study";
import { LEVELS, type Day } from "@/lib/types";
export function Heatmap() {
  const { days, settings } = useStore(),
    [months, setMonths] = useState(3),
    [selected, setSelected] = useState<Day | null>(null);
  const today = dayKey(new Date(), settings.timezone),
    count = months === 12 ? 364 : months === 6 ? 182 : 91,
    map = new Map(days.map((d) => [d.study_date, d]));
  const periodStart = shiftDay(today, 1 - count);
  const weekdayOffset =
    (new Date(periodStart + "T12:00:00Z").getUTCDay() + 6) % 7;
  const firstMonday = shiftDay(periodStart, -weekdayOffset);
  const cellCount = Math.ceil((count + weekdayOffset) / 7) * 7;
  const cells = Array.from({ length: cellCount }, (_, i) => {
    const key = shiftDay(firstMonday, i),
      day = map.get(key),
      n = (day?.reviews || 0) + (day?.new_words || 0);
    return { key, day, n };
  });
  return (
    <section className="panel activity">
      <SectionTitle title="每天一点进步">
        <div className="segmented" aria-label="学习记录范围">
          {[3, 6, 12].map((n) => (
            <button
              key={n}
              className={months === n ? "selected" : ""}
              onClick={() => setMonths(n)}
            >
              {n === 12 ? "1 年" : `${n} 个月`}
            </button>
          ))}
        </div>
      </SectionTitle>
      <div className="heatmap-months">
        <span>
          {new Date(cells[0].key + "T12:00:00").toLocaleDateString("zh-CN", {
            month: "long",
          })}
        </span>
        <span>
          {new Date(today + "T12:00:00").toLocaleDateString("zh-CN", {
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>
      <div className="heatmap-wrap">
        <div className="heatmap-days">
          <span>周一</span>
          <span>周三</span>
          <span>周五</span>
        </div>
        <div
          className="heatmap"
          style={{
            gridTemplateColumns: `repeat(${cellCount / 7},minmax(8px,1fr))`,
          }}
        >
          {cells.map(({ key, day, n }) => (
            <button
              disabled={key > today}
              style={key > today ? { visibility: "hidden" } : undefined}
              aria-label={`${key}：学习 ${n} 个词`}
              title={`${key}：学习 ${n} 个词`}
              key={key}
              className={`heat-cell intensity-${n === 0 ? 0 : n < 20 ? 1 : n < 40 ? 2 : n < 60 ? 3 : 4}`}
              onClick={() =>
                setSelected(
                  day || {
                    user_id: "",
                    study_date: key,
                    new_words: 0,
                    reviews: 0,
                    correct_answers: 0,
                    incorrect_answers: 0,
                    duration_ms: 0,
                  },
                )
              }
            />
          ))}
        </div>
      </div>
      <div className="heatmap-footer">
        <span>
          <strong>
            {
              days.filter(
                (d) =>
                  d.study_date >= cells[0].key && d.new_words + d.reviews > 0,
              ).length
            }
          </strong>{" "}
          天有学习记录
        </span>
        <span className="legend">
          少{" "}
          {[0, 1, 2, 3, 4].map((i) => (
            <i key={i} className={`intensity-${i}`} />
          ))}{" "}
          多
        </span>
      </div>
      {selected && (
        <div className="day-inline">
          <strong>{selected.study_date}</strong>
          <span>
            新词 {selected.new_words} · 复习 {selected.reviews} ·{" "}
            {accuracy(
              selected.correct_answers,
              selected.new_words + selected.reviews,
            )}
            % 正确率 · {Math.round(selected.duration_ms / 60000)} 分钟
          </span>
          <button className="text-button" onClick={() => setSelected(null)}>
            关闭
          </button>
        </div>
      )}
    </section>
  );
}
export function Dashboard() {
  const now = useNow();
  const { words, days, settings, demo } = useStore(),
    today = dayKey(new Date(), settings.timezone),
    d = days.find((x) => x.study_date === today),
    streak = streaks(days, today),
    due = words.filter(
      (w) =>
        w.progress.next_review_at &&
        Date.parse(w.progress.next_review_at) <= now,
    ).length,
    known = words.filter((w) => w.progress.status === "mastered").length,
    learning = words.filter((w) =>
      ["learning", "review"].includes(w.progress.status),
    ).length;
  const spotlight = words.find((w) => w.jlpt_level === "N1") || words[0];
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            {new Intl.DateTimeFormat("zh-CN", {
              timeZone: settings.timezone,
              weekday: "long",
              month: "long",
              day: "numeric",
            })
              .format(new Date())
              .toUpperCase()}
          </span>
          <h1>
            每天学点日语<span className="accent">.</span>
          </h1>
          <p>从今天的一小步，积累长久的记忆。</p>
        </div>
        <div className="streak-pill">
          <Flame size={19} />
          <strong>{streak.current} 天连续学习</strong>
        </div>
      </div>
      <section className="today-card">
        <div className="today-intro">
          <span className="eyebrow">今日学习</span>
          <h2>
            留一点时间
            <br />
            给新词汇。
          </h2>
          <p>{due ? `有 ${due} 个词等待复习。` : "从这里开始今天的学习。"}</p>
          <Link className="button primary" href="/study">
            开始今日学习 <ArrowRight size={18} />
          </Link>
        </div>
        <div className="today-progress">
          <div className="goal-row">
            <span>
              <i className="dot violet" />
              新词
            </span>
            <span>
              <strong>{d?.new_words || 0}</strong> / {settings.daily_new_words}
            </span>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${Math.min(100, ((d?.new_words || 0) / Math.max(1, settings.daily_new_words)) * 100)}%`,
              }}
            />
          </div>
          <div className="goal-row">
            <span>
              <i className="dot green" />
              复习
            </span>
            <span>
              <strong>{d?.reviews || 0}</strong> / {settings.daily_review_limit}
            </span>
          </div>
          <div className="progress-track green">
            <span
              style={{
                width: `${Math.min(100, ((d?.reviews || 0) / Math.max(1, settings.daily_review_limit)) * 100)}%`,
              }}
            />
          </div>
          <div className="today-bottom">
            <div>
              <Target size={17} />
              <strong>
                {d
                  ? `${accuracy(d.correct_answers, d.reviews + d.new_words)}%`
                  : "—"}
              </strong>
              <span>正确率</span>
            </div>
            <div>
              <Timer size={17} />
              <strong>{Math.round((d?.duration_ms || 0) / 60000)} 分钟</strong>
              <span>学习时长</span>
            </div>
          </div>
        </div>
      </section>
      <div className="stats-row">
        <Stat
          label="已掌握词汇"
          value={known.toLocaleString()}
          sub="已经记住的词汇"
          icon={<BookOpen size={18} />}
        />
        <Stat
          label="学习中词汇"
          value={learning.toLocaleString()}
          sub="正在熟悉的词汇"
          icon={<Layers size={18} />}
        />
        <Stat
          label="待复习"
          value={due.toLocaleString()}
          sub="按时复习，更好记住"
          icon={<Timer size={18} />}
        />
      </div>
      <Heatmap />
      <div className="dashboard-bottom">
        <section className="panel">
          <SectionTitle title="你的词汇">
            <Link className="text-link" href="/vocabulary">
              查看全部 <ArrowUpRight size={15} />
            </Link>
          </SectionTitle>
          <div className="level-bars">
            {LEVELS.filter((l) => l !== "Custom").map((l) => {
              const total = words.filter((w) => w.jlpt_level === l).length,
                mastered = words.filter(
                  (w) => w.jlpt_level === l && w.progress.status === "mastered",
                ).length;
              return (
                <Link
                  href={`/vocabulary?level=${l}`}
                  key={l}
                  className="level-row"
                >
                  <span className={`badge ${l === "N1" ? "purple" : ""}`}>
                    {l}
                  </span>
                  <div className="level-track">
                    <span
                      style={{
                        width: `${Math.max(total ? 3 : 0, (total / Math.max(1, words.length)) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="small muted">
                    {mastered} / {total}
                  </span>
                </Link>
              );
            })}
          </div>
          <div className="panel-foot">
            <span className="small muted">已掌握 / 总词汇</span>
            <span className="small">
              当前重点：N1 <Star size={13} />
            </span>
          </div>
        </section>
        <section className="panel spotlight">
          <SectionTitle title="再看一个词">
            <span className="badge purple">
              {spotlight?.jlpt_level || "N1"}
            </span>
          </SectionTitle>
          {spotlight ? (
            <>
              <div className="spotlight-word" lang="ja">
                {spotlight.word}
              </div>
              <span className="muted" lang="ja">
                {spotlight.kana}
              </span>
              <p>
                {settings.preferred_language === "zh"
                  ? spotlight.meaning_zh
                  : spotlight.meaning_en}
              </p>
              <Link
                href={`/vocabulary?word=${spotlight.id}`}
                className="text-link"
              >
                查看词汇详情 <ArrowRight size={16} />
              </Link>
            </>
          ) : (
            <>
              <p>添加第一个词汇吧。</p>
              <Link href="/vocabulary" className="text-link">
                添加词汇 <ArrowRight size={16} />
              </Link>
            </>
          )}
        </section>
      </div>
      {!demo && words.length === 0 && (
        <p className="small muted">
          可以从词汇页添加新词，或导入 CSV / JSON 词汇表。
        </p>
      )}
    </>
  );
}
function MiniChart({
  days,
  field,
  title,
  color = "var(--primary)",
}: {
  days: Day[];
  field: "reviews" | "new_words" | "accuracy" | "time";
  title: string;
  color?: string;
}) {
  const { settings } = useStore();
  const today = dayKey(new Date(), settings.timezone);
  const values = Array.from({ length: 30 }, (_, i) => {
    const key = shiftDay(today, i - 29),
      d = days.find((x) => x.study_date === key);
    return {
      key,
      value: !d
        ? 0
        : field === "accuracy"
          ? accuracy(d.correct_answers, d.new_words + d.reviews)
          : field === "time"
            ? Math.round(d.duration_ms / 60000)
            : d[field],
    };
  });
  const max = Math.max(1, ...values.map((d) => d.value));
  return (
    <section className="panel">
      <SectionTitle title={title}>
        <span className="small muted">最近 30 天</span>
      </SectionTitle>
      <div className="bar-chart" role="img" aria-label={`${title}，最近 30 天`}>
        {values.map((d) => (
          <div
            key={d.key}
            title={`${d.key}: ${d.value}${field === "accuracy" ? "%" : field === "time" ? " 分钟" : ""}`}
            style={{
              height: `${Math.max(2, (d.value / max) * 100)}%`,
              background: d.value ? color : "var(--line)",
            }}
          />
        ))}
      </div>
      <div className="chart-axis">
        <span>{values[0].key.slice(5)}</span>
        <span>今天</span>
      </div>
      <details className="chart-data">
        <summary>查看数据</summary>
        <div className="chart-data-grid">
          {values.map((v) => (
            <span key={v.key}>
              {v.key}: <strong>{v.value}</strong>
            </span>
          ))}
        </div>
      </details>
    </section>
  );
}
export function Statistics() {
  const { words, days, settings } = useStore(),
    streak = streaks(days, dayKey(new Date(), settings.timezone)),
    total = days.reduce((n, d) => n + d.new_words + d.reviews, 0),
    correct = days.reduce((n, d) => n + d.correct_answers, 0);
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">长期学习记录</span>
          <h1>看看自己的进步。</h1>
          <p>每一次复习，都在加深记忆。</p>
        </div>
        <Link href="/calendar" className="button">
          <CalendarDays size={17} />
          学习日历
        </Link>
      </div>
      <div className="stats-row four">
        {[
          ["词汇总数", words.length],
          [
            "已掌握",
            words.filter((w) => w.progress.status === "mastered").length,
          ],
          [
            "学习中",
            words.filter((w) =>
              ["learning", "review"].includes(w.progress.status),
            ).length,
          ],
          ["新词", words.filter((w) => w.progress.status === "new").length],
        ].map(([label, value]) => (
          <Stat key={label} label={String(label)} value={value} />
        ))}
      </div>
      <div className="chart-grid">
        <MiniChart days={days} field="new_words" title="每日新词" />
        <MiniChart
          days={days}
          field="reviews"
          title="每日复习"
          color="var(--green)"
        />
        <MiniChart days={days} field="accuracy" title="正确率趋势" />
        <MiniChart
          days={days}
          field="time"
          title="学习时长 · 分钟"
          color="var(--green)"
        />
      </div>
      <div className="stats-row four">
        <Stat label="当前连续天数" value={`${streak.current} days`} />
        <Stat label="最长连续天数" value={`${streak.longest} days`} />
        <Stat label="累计学习天数" value={streak.total} />
        <Stat label="累计答题数" value={total} />
      </div>
      <div className="dashboard-bottom">
        <section className="panel">
          <SectionTitle title="JLPT 等级分布" />
          {LEVELS.map((l) => (
            <div key={l} className="distribution-row">
              <span className="badge">{l}</span>
              <div className="level-track">
                <span
                  style={{
                    width: `${(words.filter((w) => w.jlpt_level === l).length / Math.max(1, words.length)) * 100}%`,
                  }}
                />
              </div>
              <strong>{words.filter((w) => w.jlpt_level === l).length}</strong>
            </div>
          ))}
        </section>
        <section className="panel">
          <SectionTitle title="记忆情况" />
          <div className="retention">
            {accuracy(correct, total)}
            <span>%</span>
          </div>
          <p>总体记忆正确率</p>
          <p className="small muted">
            “较难”“记得”“轻松”的回答计为正确；“重来”计为遗忘。
          </p>
          <div className="panel-foot">
            <span>{words.filter(weak).length} 个词需要重点巩固</span>
            <Link href="/review?tab=weak" className="text-link">
              复习 <ArrowRight size={15} />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
export function Calendar() {
  const { days, settings } = useStore(),
    today = dayKey(new Date(), settings.timezone),
    [month, setMonth] = useState(today.slice(0, 7)),
    [selected, setSelected] = useState(today);
  const first = new Date(month + "-01T12:00:00"),
    offset = (first.getDay() + 6) % 7,
    last = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate(),
    d = days.find((x) => x.study_date === selected);
  function change(delta: number) {
    const next = new Date(first);
    next.setMonth(next.getMonth() + delta);
    setMonth(
      `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return (
    <>
      <div className="page-heading">
        <div>
          <span className="eyebrow">每天的积累</span>
          <h1>你的学习日历。</h1>
          <p>记录每一天的日语学习。</p>
        </div>
      </div>
      <div className="calendar-layout">
        <section className="panel">
          <SectionTitle
            title={first.toLocaleDateString("zh-CN", {
              month: "long",
              year: "numeric",
            })}
          >
            <div className="flex">
              <button
                aria-label="上个月"
                className="icon-button"
                onClick={() => change(-1)}
              >
                <ChevronLeft size={19} />
              </button>
              <button
                className="text-button"
                onClick={() => setMonth(today.slice(0, 7))}
              >
                今天
              </button>
              <button
                aria-label="下个月"
                className="icon-button"
                onClick={() => change(1)}
              >
                <ChevronRight size={19} />
              </button>
            </div>
          </SectionTitle>
          <div className="calendar-grid">
            {["周一", "周二", "周三", "周四", "周五", "周六", "周日"].map(
              (n) => (
                <span key={n} className="calendar-label">
                  {n}
                </span>
              ),
            )}
            {Array.from({ length: offset }, (_, i) => (
              <span key={`blank-${i}`} />
            ))}
            {Array.from({ length: last }, (_, i) => {
              const key = month + "-" + String(i + 1).padStart(2, "0"),
                day = days.find((x) => x.study_date === key),
                n = (day?.new_words || 0) + (day?.reviews || 0);
              return (
                <button
                  key={key}
                  className={`calendar-day ${selected === key ? "selected" : ""} ${key === today ? "today" : ""}`}
                  onClick={() => setSelected(key)}
                >
                  <strong>{i + 1}</strong>
                  {n > 0 ? (
                    <>
                      <Check size={15} />
                      <span>{n} 个词</span>
                    </>
                  ) : (
                    <span>—</span>
                  )}
                </button>
              );
            })}
          </div>
        </section>
        <section className="panel calendar-detail">
          <span className="eyebrow">当天学习</span>
          <h2>
            {new Date(selected + "T12:00:00").toLocaleDateString("zh-CN", {
              month: "long",
              day: "numeric",
            })}
          </h2>
          {d ? (
            <>
              <Stat label="新词" value={d.new_words} />
              <Stat label="复习" value={d.reviews} />
              <Stat
                label="accuracy"
                value={`${accuracy(d.correct_answers, d.new_words + d.reviews)}%`}
              />
              <Stat
                label="学习时长"
                value={`${Math.round(d.duration_ms / 60000)} 分钟`}
              />
            </>
          ) : (
            <Empty title="没有学习记录" description="当天没有学习记录。" />
          )}
        </section>
      </div>
    </>
  );
}
