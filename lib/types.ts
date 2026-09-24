export const LEVELS = ["N1", "N2", "N3", "N4", "N5", "Custom"] as const;
export type Level = (typeof LEVELS)[number];
export type Status = "new" | "learning" | "review" | "mastered";
export type Rating = 1 | 2 | 3 | 4;
export type VocabularyInput = {
  word: string;
  kana: string;
  romaji: string;
  meaning_zh: string;
  meaning_en: string;
  jlpt_level: Level;
  part_of_speech: string;
  example_sentence: string;
  example_kana: string;
  example_translation: string;
  notes: string;
  tags: string[];
};
export type Vocabulary = VocabularyInput & {
  id: string;
  user_id: string;
  created_at: string;
};
export type Progress = {
  id: string;
  user_id: string;
  vocabulary_id: string;
  status: Status;
  favorite: boolean;
  difficulty: number;
  stability: number;
  ease: number;
  interval_days: number;
  repetitions: number;
  review_count: number;
  correct_count: number;
  incorrect_count: number;
  first_learned_at: string | null;
  last_reviewed_at: string | null;
  last_forgotten_at: string | null;
  next_review_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
};
export type Word = Vocabulary & { progress: Progress };
export type ReviewLog = {
  id: string;
  action_id: string;
  user_id: string;
  vocabulary_id: string;
  session_id: string;
  rating: Rating;
  reviewed_at: string;
  client_reviewed_at: string;
  study_date: string;
  was_new: boolean;
  previous_interval: number;
  next_interval: number;
  duration_ms: number;
};
export type Day = {
  user_id: string;
  study_date: string;
  new_words: number;
  reviews: number;
  correct_answers: number;
  incorrect_answers: number;
  duration_ms: number;
};
export type Settings = {
  user_id: string;
  daily_new_words: number;
  daily_review_limit: number;
  preferred_language: "zh" | "en";
  timezone: string;
  show_romaji: boolean;
  show_translation: boolean;
  jlpt_levels: Level[];
  theme: "light" | "dark" | "system";
};
export type Snapshot = { words: Word[]; days: Day[]; settings: Settings };
export type ReviewAction = {
  id: string;
  userId: string;
  wordId: string;
  sessionId: string;
  rating: Rating;
  version: number;
  reviewedAt: string;
  durationMs: number;
  error?: string;
};
export const defaultSettings: Settings = {
  user_id: "demo",
  daily_new_words: 20,
  daily_review_limit: 100,
  preferred_language: "zh",
  timezone: "Asia/Shanghai",
  show_romaji: false,
  show_translation: true,
  jlpt_levels: [...LEVELS],
  theme: "light",
};
export function freshProgress(id: string, userId: string): Progress {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    user_id: userId,
    vocabulary_id: id,
    status: "new",
    favorite: false,
    difficulty: 5,
    stability: 0,
    ease: 2.5,
    interval_days: 0,
    repetitions: 0,
    review_count: 0,
    correct_count: 0,
    incorrect_count: 0,
    first_learned_at: null,
    last_reviewed_at: null,
    last_forgotten_at: null,
    next_review_at: null,
    version: 0,
    created_at: now,
    updated_at: now,
  };
}
