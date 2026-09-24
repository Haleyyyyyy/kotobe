import type { Day, Progress, Rating, Settings, Word } from "./types";
export function dayKey(date: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
export function shiftDay(key: string, delta: number) {
  const d = new Date(key + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
export function accuracy(correct: number, total: number) {
  return total ? Math.round((correct / total) * 100) : 0;
}
export function weak(word: Word) {
  const p = word.progress;
  return (
    p.incorrect_count >= 2 ||
    (p.review_count >= 3 && p.correct_count / p.review_count < 0.7)
  );
}
export function makeQueue(
  words: Word[],
  settings: Settings,
  today: Day | undefined,
  mode: "normal" | "due" | "weak",
  now = Date.now(),
) {
  const available = words.filter((w) =>
    settings.jlpt_levels.includes(w.jlpt_level),
  );
  const priority = (a: Word, b: Word) =>
    (a.progress.next_review_at || "").localeCompare(
      b.progress.next_review_at || "",
    ) || a.jlpt_level.localeCompare(b.jlpt_level);
  const reviewLimit = Math.max(
    0,
    settings.daily_review_limit - (today?.reviews || 0),
  );
  if (mode === "weak")
    return available
      .filter(weak)
      .sort((a, b) => b.progress.incorrect_count - a.progress.incorrect_count)
      .slice(0, reviewLimit);
  const due = available
    .filter(
      (w) =>
        w.progress.status !== "new" &&
        w.progress.next_review_at &&
        Date.parse(w.progress.next_review_at) <= now,
    )
    .sort(
      (a, b) =>
        Number(a.progress.status === "learning") -
          Number(b.progress.status === "learning") || priority(a, b),
    )
    .slice(0, reviewLimit);
  if (mode === "due") return due;
  return [
    ...due,
    ...available
      .filter((w) => w.progress.status === "new")
      .sort(
        (a, b) =>
          a.jlpt_level.localeCompare(b.jlpt_level) ||
          a.created_at.localeCompare(b.created_at),
      )
      .slice(
        0,
        Math.max(0, settings.daily_new_words - (today?.new_words || 0)),
      ),
  ];
}
// Preview only; PostgreSQL submit_review is canonical for authenticated users.
export function schedule(
  p: Progress,
  rating: Rating,
  now = new Date(),
): Progress {
  let interval: number,
    reps = p.repetitions,
    ease = p.ease;
  if (rating === 1) {
    interval = 10 / 1440;
    reps = 0;
    ease = Math.max(1.3, ease - 0.2);
  } else if (rating === 2) {
    interval = Math.max(1, p.interval_days * 1.2);
    ease = Math.max(1.3, ease - 0.15);
  } else if (rating === 3) {
    interval =
      reps === 0
        ? 1
        : reps === 1
          ? 6
          : Math.max(1, Math.round(p.interval_days * ease));
    reps++;
  } else {
    interval =
      reps === 0 ? 4 : Math.max(4, Math.round(p.interval_days * ease * 1.3));
    reps++;
    ease += 0.15;
  }
  interval = Math.min(interval, 36500);
  return {
    ...p,
    status: rating === 1 ? "learning" : interval >= 30 ? "mastered" : "review",
    interval_days: interval,
    stability: interval,
    ease,
    repetitions: reps,
    difficulty: Math.max(1, Math.min(10, 5 + (2.5 - ease) * 3)),
    review_count: p.review_count + 1,
    correct_count: p.correct_count + Number(rating > 1),
    incorrect_count: p.incorrect_count + Number(rating === 1),
    first_learned_at: p.first_learned_at || now.toISOString(),
    last_reviewed_at: now.toISOString(),
    last_forgotten_at: rating === 1 ? now.toISOString() : p.last_forgotten_at,
    next_review_at: new Date(+now + interval * 86400000).toISOString(),
    version: p.version + 1,
    updated_at: now.toISOString(),
  };
}
export function intervalLabel(days: number) {
  return days < 1
    ? `${Math.round(days * 1440)} 分钟`
    : days < 30
      ? `${Math.round(days)} 天`
      : `${Math.round(days / 30)} 个月`;
}
export function streaks(days: Day[], today: string) {
  const set = new Set(
    days.filter((d) => d.new_words + d.reviews > 0).map((d) => d.study_date),
  );
  let current = 0,
    key = set.has(today) ? today : shiftDay(today, -1);
  while (set.has(key)) {
    current++;
    key = shiftDay(key, -1);
  }
  let longest = 0,
    run = 0,
    previous = "";
  for (const date of [...set].sort()) {
    run = previous && shiftDay(previous, 1) === date ? run + 1 : 1;
    longest = Math.max(longest, run);
    previous = date;
  }
  return { current, longest, total: set.size };
}
