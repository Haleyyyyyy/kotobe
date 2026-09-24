import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
const db = new PGlite();
const alice = "10000000-0000-4000-8000-000000000001",
  bob = "10000000-0000-4000-8000-000000000002";
let wordId: string;
async function asUser(id: string) {
  await db.exec("reset role");
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]);
  await db.exec("set role authenticated");
}
async function scalar(sql: string, params: unknown[] = []) {
  return Object.values(
    (await db.query<Record<string, unknown>>(sql, params)).rows[0],
  )[0];
}
before(async () => {
  await db.exec(
    `create schema auth;create role anon nologin;create role authenticated nologin;create table auth.users(id uuid primary key,email text);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated,anon;grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.exec(
    await readFile(
      new URL(
        "../supabase/migrations/202609230001_kotoba.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  await db.query("insert into auth.users(id,email) values($1,$2),($3,$4)", [
    alice,
    "alice@example.test",
    bob,
    "bob@example.test",
  ]);
  await asUser(alice);
  await db.query("select public.import_vocabulary($1::jsonb,false)", [
    JSON.stringify([
      { word: "見込む", kana: "みこむ", meaning_zh: "预料", jlpt_level: "N1" },
    ]),
  ]);
  wordId = String(await scalar("select id from vocabulary"));
});
after(async () => db.close());
test("signup creates private profile and default settings", async () => {
  await asUser(alice);
  assert.equal(await scalar("select count(*)::int from profiles"), 1);
  assert.equal(await scalar("select daily_new_words from user_settings"), 20);
});
test("RLS blocks other accounts from reading and modifying vocabulary, progress, settings", async () => {
  await asUser(bob);
  assert.equal(await scalar("select count(*)::int from vocabulary"), 0);
  assert.equal(await scalar("select count(*)::int from user_vocabulary"), 0);
  assert.equal(
    (
      await db.query(
        "update vocabulary set meaning_zh=$1 where id=$2 returning id",
        ["hacked", wordId],
      )
    ).rows.length,
    0,
  );
  await assert.rejects(
    () =>
      db.query("insert into vocabulary(user_id,word) values($1,$2)", [
        alice,
        "bad",
      ]),
    /row-level security/i,
  );
  await assert.rejects(
    () => db.query("select set_word_state($1,$2,null)", [wordId, "mastered"]),
    /Word not found/,
  );
});
test("review transaction schedules, logs and updates stats exactly once", async () => {
  await asUser(alice);
  const action = crypto.randomUUID(),
    session = crypto.randomUUID();
  const values = [
    action,
    wordId,
    session,
    3,
    0,
    new Date().toISOString(),
    24000,
  ];
  await db.query("select submit_review($1,$2,$3,$4,$5,$6,$7)", values);
  await db.query("select submit_review($1,$2,$3,$4,$5,$6,$7)", values);
  assert.equal(await scalar("select review_count from user_vocabulary"), 1);
  assert.equal(
    await scalar("select interval_days::float from user_vocabulary"),
    1,
  );
  assert.equal(await scalar("select count(*)::int from review_logs"), 1);
  assert.equal(await scalar("select new_words from daily_statistics"), 1);
  assert.equal(await scalar("select correct_answers from study_sessions"), 1);
  assert.equal(
    await scalar("select duration_ms::int from daily_statistics"),
    24000,
  );
});
test("stale reviews fail without adding logs or mutating counters", async () => {
  await asUser(alice);
  await assert.rejects(
    () =>
      db.query("select submit_review($1,$2,$3,4,0,now(),1000)", [
        crypto.randomUUID(),
        wordId,
        crypto.randomUUID(),
      ]),
    /STALE_REVIEW/,
  );
  assert.equal(await scalar("select count(*)::int from review_logs"), 1);
});
test("Good grows interval; Again resets to ten minutes and records a lapse", async () => {
  await asUser(alice);
  await db.query("select submit_review($1,$2,$3,3,1,now(),1000)", [
    crypto.randomUUID(),
    wordId,
    crypto.randomUUID(),
  ]);
  assert.equal(
    await scalar("select interval_days::float from user_vocabulary"),
    6,
  );
  await db.query("select submit_review($1,$2,$3,1,2,now(),1000)", [
    crypto.randomUUID(),
    wordId,
    crypto.randomUUID(),
  ]);
  assert.ok(
    Math.abs(
      Number(await scalar("select interval_days::float from user_vocabulary")) -
        10 / 1440,
    ) < 0.00001,
  );
  assert.equal(await scalar("select status from user_vocabulary"), "learning");
  assert.equal(await scalar("select incorrect_count from user_vocabulary"), 1);
});
test("imports skip or replace duplicates without resetting progress", async () => {
  await asUser(alice);
  const payload = JSON.stringify([
    { word: "見込む", kana: "みこむ", meaning_zh: "updated", jlpt_level: "N1" },
  ]);
  await db.query("select import_vocabulary($1::jsonb,false)", [payload]);
  assert.equal(await scalar("select meaning_zh from vocabulary"), "预料");
  await db.query("select import_vocabulary($1::jsonb,true)", [payload]);
  assert.equal(await scalar("select meaning_zh from vocabulary"), "updated");
  assert.equal(await scalar("select review_count from user_vocabulary"), 3);
  assert.equal(await scalar("select count(*)::int from vocabulary"), 1);
});
test("an invalid row rolls back the whole import", async () => {
  await asUser(alice);
  await assert.rejects(
    () =>
      db.query("select import_vocabulary($1::jsonb,false)", [
        JSON.stringify([
          { word: "new word", kana: "a" },
          { word: "bad", jlpt_level: "N8" },
        ]),
      ]),
    /check constraint/,
  );
  assert.equal(await scalar("select count(*)::int from vocabulary"), 1);
});
test("users cannot write fabricated logs or progress directly", async () => {
  await asUser(alice);
  await assert.rejects(
    () => db.query("update user_vocabulary set review_count=9000"),
    /permission denied/,
  );
  await assert.rejects(
    () => db.query("delete from review_logs"),
    /permission denied/,
  );
  await asUser(bob);
  assert.equal(await scalar("select count(*)::int from review_logs"), 0);
  assert.equal(await scalar("select count(*)::int from study_sessions"), 0);
  assert.equal(await scalar("select count(*)::int from daily_statistics"), 0);
});
test("unauthenticated callers cannot import or submit reviews", async () => {
  await db.exec("reset role;set role anon");
  await assert.rejects(
    () => db.query("select import_vocabulary('[]',false)"),
    /permission denied/,
  );
  await assert.rejects(
    () =>
      db.query("select submit_review($1,$2,$3,3,0,now(),0)", [
        crypto.randomUUID(),
        wordId,
        crypto.randomUUID(),
      ]),
    /permission denied/,
  );
});

test("offline review keeps its study date but schedules from synchronization time", async () => {
  await asUser(alice);
  await db.query("select import_vocabulary($1::jsonb,false)", [
    JSON.stringify([{ word: "昨日", kana: "きのう", meaning_en: "yesterday" }]),
  ]);
  const id = String(
    await scalar("select id from vocabulary where word='昨日'"),
  );
  await db.query("select submit_review($1,$2,$3,4,0,$4,12000)", [
    crypto.randomUUID(),
    id,
    crypto.randomUUID(),
    "2026-01-01T16:30:00Z",
  ]);
  assert.equal(
    String(
      await scalar(
        "select study_date::text from review_logs where vocabulary_id=$1",
        [id],
      ),
    ),
    "2026-01-02",
  );
  assert.equal(
    await scalar(
      "select next_review_at > now() from user_vocabulary where vocabulary_id=$1",
      [id],
    ),
    true,
  );
  assert.equal(
    await scalar(
      "select interval_days::float from user_vocabulary where vocabulary_id=$1",
      [id],
    ),
    4,
  );
  await db.query("select submit_review($1,$2,$3,2,1,now(),12000)", [
    crypto.randomUUID(),
    id,
    crypto.randomUUID(),
  ]);
  assert.ok(
    Math.abs(
      Number(
        await scalar(
          "select interval_days::float from user_vocabulary where vocabulary_id=$1",
          [id],
        ),
      ) - 4.8,
    ) < 0.000001,
  );
});
