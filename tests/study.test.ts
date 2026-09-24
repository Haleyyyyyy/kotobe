import { test } from "node:test";
import assert from "node:assert/strict";
import { schedule, makeQueue, streaks, dayKey } from "../lib/study";
import { parseVocabulary, csv } from "../lib/import-export";
import {
  freshProgress,
  defaultSettings,
  type Word,
  type Day,
} from "../lib/types";
function word(
  id: string,
  status: Word["progress"]["status"],
  level: Word["jlpt_level"] = "N1",
): Word {
  return {
    id,
    user_id: "u",
    word: id,
    kana: "",
    romaji: "",
    meaning_zh: "test",
    meaning_en: "",
    jlpt_level: level,
    part_of_speech: "",
    example_sentence: "",
    example_kana: "",
    example_translation: "",
    notes: "",
    tags: [],
    created_at: "2026-01-01",
    progress: {
      ...freshProgress(id, "u"),
      status,
      next_review_at: status === "new" ? null : "2026-01-01",
    },
  };
}
test("queue prioritizes due review, due learning, and N1 new words with daily limits", () => {
  const words = [
    word("new4", "new", "N4"),
    word("learn", "learning"),
    word("new1", "new"),
    word("due", "review"),
  ];
  const queue = makeQueue(
    words,
    { ...defaultSettings, daily_new_words: 1, daily_review_limit: 2 },
    undefined,
    "normal",
  );
  assert.deepEqual(
    queue.map((w) => w.id),
    ["due", "learn", "new1"],
  );
  const day = { new_words: 1, reviews: 2 } as Day;
  assert.equal(
    makeQueue(
      words,
      { ...defaultSettings, daily_new_words: 1, daily_review_limit: 2 },
      day,
      "normal",
    ).length,
    0,
  );
});
test("future learning words do not jump the due queue", () => {
  const w = word("later", "learning");
  w.progress.next_review_at = "2099-01-01";
  assert.equal(makeQueue([w], defaultSettings, undefined, "normal").length, 0);
});
test("SM-2 style rating intervals and counters", () => {
  const p = freshProgress("x", "u");
  assert.equal(schedule(p, 3).interval_days, 1);
  assert.equal(schedule(schedule(p, 3), 3).interval_days, 6);
  assert.equal(schedule(p, 4).interval_days, 4);
  assert.equal(schedule(p, 2).interval_days, 1);
  assert.equal(schedule(p, 1).incorrect_count, 1);
  assert.equal(schedule(p, 1).repetitions, 0);
});
test("CSV handles quoted commas, multiline values, UTF-8 BOM and tags", () => {
  const rows = parseVocabulary(
    '\uFEFFword,kana,meaning_en,tags\n見込む,みこむ,"anticipate, expect","N1;reading"',
    "words.csv",
  );
  assert.equal(rows[0].meaning_en, "anticipate, expect");
  assert.deepEqual(rows[0].tags, ["N1", "reading"]);
  assert.throws(
    () =>
      parseVocabulary(
        '[{"word":"a","meaning_en":"b","jlpt_level":"N7"}]',
        "words.json",
      ),
    /JLPT/,
  );
});
test("JSON export vocabulary can be reimported; CSV neutralizes spreadsheet formulas", () => {
  assert.equal(
    parseVocabulary(
      '{"vocabulary":[{"word":"語","meaning_en":"word"}]}',
      "export.json",
    )[0].word,
    "語",
  );
  assert.match(csv([{ word: "=1+1" }]), /'=1\+1/);
});
test("timezone dates and streaks handle midnight and yesterday", () => {
  assert.equal(
    dayKey(new Date("2026-09-22T20:00:00Z"), "Asia/Shanghai"),
    "2026-09-23",
  );
  const days = ["2026-09-20", "2026-09-21", "2026-09-22"].map(
    (study_date) => ({ study_date, new_words: 1, reviews: 1 }) as Day,
  );
  assert.deepEqual(streaks(days, "2026-09-23"), {
    current: 3,
    longest: 3,
    total: 3,
  });
});
