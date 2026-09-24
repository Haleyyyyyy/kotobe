# Kotoba

A personal Japanese vocabulary app built with Next.js, TypeScript, Tailwind CSS, Supabase Auth/PostgreSQL, and Vercel. N1-first vocabulary, daily flashcards, a transactional SM-2-style scheduler, activity calendar, weak words, import/export, and responsive desktop/mobile layouts.

## Run locally

Requires Node.js 22 LTS and pnpm 11.19.0. The repository pins the package manager through Corepack.

```sh
pnpm install
cp .env.example .env.local
# Fill in the two public Supabase values below.
pnpm dev
```

Open http://localhost:3000. Without credentials, the sign-in page offers a clearly labeled, in-memory demo. Demo records are separate from real user data and reset on a full reload. Example statistics are illustrative, not a claim about your own learning.

## Connect Supabase

1. Create a Supabase project.
2. Open the SQL Editor and execute all files in `supabase/migrations/` in filename order. Alternatively, link the project with the Supabase CLI and run `supabase db push`.
3. Under **Project Settings → API**, copy the project URL and **publishable key** into `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

A legacy public anon key also works. **Never put a service-role or secret key in either variable.** No service-role key is needed by this application.

4. Enable email/password authentication. Keep email confirmation enabled for production; configure a custom SMTP provider for reliable delivery.
5. Under **Authentication → URL Configuration**, set the Site URL to your deployed origin and allow redirects to `http://localhost:3000`, `http://localhost:3000/reset-password`, your production origin, and `https://YOUR_DOMAIN/reset-password`. Add only the preview origins you actually use.
6. Restart the app after changing environment variables. Register a new account, confirm its email, and sign in. Profiles and default settings are created by the signup trigger.

The migration is intended for a new project. If you apply it to a project with existing auth users, backfill profiles and settings through a trusted SQL Editor session:

```sql
insert into public.profiles(id,email)
select id,coalesce(email,'') from auth.users on conflict do nothing;
insert into public.user_settings(user_id)
select id from auth.users on conflict do nothing;
```

## Deploy to Vercel

1. Push this directory to a Git repository and import it in Vercel as a Next.js project. If the repository contains a parent directory, choose this app as the Root Directory.
2. Set both `NEXT_PUBLIC_SUPABASE_*` variables for Production and the Preview environments you want to use.
3. Select Node.js 22 and add `ENABLE_EXPERIMENTAL_COREPACK=1` to the Vercel build environment so Vercel honors the pinned pnpm version. Leave the install command on automatic detection; use `pnpm build`. The committed lockfile pins dependency versions. See [Vercel package manager configuration](https://vercel.com/docs/package-managers).
4. Deploy. Set Supabase's Site URL and redirect allowlist to the resulting domain as described above.
5. Run the live acceptance checklist below. Public environment variables are embedded at build time: redeploy when they change.

You can also run `vercel` from this directory after signing in with the Vercel CLI. No hard-coded deployment credentials or external API secrets are included.

## Learning and synchronization

- **Canonical state:** Supabase. All tables use RLS. Browser requests carry the signed-in user's JWT; no privileged client key is used.
- **Private vocabulary:** vocabulary and learning records belong to an account. Composite foreign keys prevent linking another account's word or session.
- **Atomic review:** `submit_review` locks the word's progress row, checks its version, calculates its next interval, and updates history, session totals, and daily statistics in one transaction.
- **Idempotency:** a durable action UUID has a unique `(user_id, action_id)` constraint. Retries after an uncertain response cannot double-count reviews.
- **Concurrent devices:** an outdated word version fails with `STALE_REVIEW`. The newer cloud state is retained; the user can explicitly discard the conflicting pending answer in Settings, then study the word again.
- **Refresh:** data loads on sign-in, returns to the tab, after writes, every 30 seconds, and on database realtime events.
- **Offline:** pending answers and a recent account-scoped snapshot are stored in IndexedDB. The outbox is replayed in order when connectivity returns. Accounts never share cached snapshots. Logout requires resolving pending answers and clears the cached snapshot.
- **PWA:** manifest and 192/512px icons; production service worker caches the public app shell and loaded static assets. Supabase network responses are never intercepted. A previously loaded queue can survive a temporary connection interruption. First-ever offline use and unvisited assets are not guaranteed. Safari may evict storage; device storage is temporary, not a backup.
- **Authentication:** Supabase persists its session and refreshes tokens. Learning records are not stored in localStorage. Clearing browser storage before synchronization can lose pending actions.
- **Study dates:** each answer retains the account timezone's calendar date when recorded. Server time anchors the next due interval, so a late offline sync does not schedule an answer immediately back into the past. Changing timezone does not rewrite existing statistics.

### Scheduler

This is a documented SM-2-style algorithm, not FSRS. PostgreSQL is authoritative; TypeScript mirrors it for interval previews and the demo.

| Rating | Next interval                              | Ease / repetitions            |
| ------ | ------------------------------------------ | ----------------------------- |
| Again  | 10 minutes                                 | ease −0.20, repetitions reset |
| Hard   | max(1 day, previous ×1.2)                  | ease −0.15                    |
| Good   | 1 day, then 6 days, then previous ×ease    | successful repetition +1      |
| Easy   | 4 days initially, then previous ×ease ×1.3 | ease +0.15, repetition +1     |

Ease has a floor of 1.3. An interval of 30+ days is labeled Mastered; these words still receive reviews. Stability is the current interval in days and difficulty is a bounded ease-derived indicator; neither claims FSRS semantics. Mark known schedules a check in 30 days; mark unknown restarts scheduling while keeping historical counters.

Daily sessions prioritize due review/mastered words, due learning words, then new words. Future learning cards are never pulled in before their due time. New words prioritize N1. Again cards become due after ten minutes; a short session does not force an immediate repeat. Weak words have at least two lapses or recall below 70% after three answers. Weak-word practice intentionally allows early practice, within the daily review cap.

## Vocabulary files

CSV requires a `word` and at least one of `meaning_zh` / `meaning_en`. Optional columns:

```csv
word,kana,romaji,meaning_zh,meaning_en,jlpt_level,part_of_speech,example_sentence,example_kana,example_translation,notes,tags
見込む,みこむ,mikomu,预料；预计,to anticipate,N1,Verb,今年は売上の増加が見込まれている。,,预计今年销售额将增长。,,reading;priority
```

Tags use semicolons in CSV or arrays in JSON. JSON accepts an array or an exported object's `vocabulary` array. Imports support up to 5,000 rows / 5 MB per file, show a preview, and compare trimmed `word + kana`. Replace updates vocabulary details without resetting progress. Invalid rows roll back the import. Exported CSV neutralizes formula-like values for spreadsheet safety. JSON is the lossless format.

Export includes vocabulary, progress, review history, settings, and daily statistics. Progress/history exports are for data ownership and analysis; this version does not restore review histories from an export. Vocabulary exports can be reimported.

## Checks

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm build
# In one terminal:
pnpm start
# In another:
pnpm exec playwright install chromium
pnpm test:e2e
```

The database suite runs the actual migration in PGlite's PostgreSQL engine, simulating Supabase's `auth.users`, `auth.uid()`, and roles. It checks RLS boundaries, disallowed direct writes, private history, transaction rollback, scheduler intervals, duplicate submissions, and stale-version rejection. It does not emulate Supabase's hosted email delivery, JWT issuance, PostgREST, or Realtime.

Browser tests cover demo import/edit, study grading, export, navigation, and 390px mobile overflow. See `VERIFICATION.md` for what was actually executed in this environment.

### Live acceptance checklist (requires your Supabase project)

- Register two accounts and confirm both emails. Verify sign-in, persistence after reload, sign-out, and email password reset.
- Account A: import a CSV, flip a card, grade it, then reload. Verify the next due time, counts, and history.
- Account B: verify that A's words and history are inaccessible, including direct REST calls with B's token.
- Open A on a second device. Verify the same records and settings. Try grading a previously loaded card on both devices: one stale action should need resolution.
- Go offline after loading a queue, answer cards, reconnect. Verify each action creates exactly one log and daily totals match. Repeat reconnect to check idempotency.
- On iOS Safari / Android Chrome, install to the home screen. Check touch gestures, keyboard shortcuts on desktop, dark mode, and import/export.

## Code map

- `app/`: Next.js entry points, global design tokens and responsive styles.
- `components/provider.tsx`: account state, Supabase I/O, synchronization and demo boundary.
- `components/`: authentication, dashboard/charts/calendar, vocabulary/editor/import, flashcards/review, settings/export.
- `lib/types.ts`: domain types; `lib/study.ts`: queue and scheduler preview.
- `lib/offline.ts`: versioned IndexedDB cache and outbox.
- `lib/import-export.ts`: CSV/JSON parsing and safe export.
- `supabase/migrations/`: schema, RLS, triggers, and transactional commands.
- `tests/`: database and domain tests; `tests/e2e/`: browser acceptance checks.

The presentation, scheduling, import, and persistence boundaries are separate so decks, speech, grammar, or other language content can be added without replacing the core review transaction.

Official references: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Supabase password auth](https://supabase.com/docs/guides/auth/passwords), [Supabase row-level security](https://supabase.com/docs/guides/database/postgres/row-level-security).
