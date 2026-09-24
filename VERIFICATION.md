# Verification record

Local environment: macOS 13, Node.js 24.19.0, pnpm 11.19.0. Application target: Node.js 22 LTS on Vercel.

## Passed

- ESLint with Next.js and TypeScript rules.
- TypeScript strict checking.
- Next.js production build.
- 16 automated PostgreSQL/domain tests, including:
  - signup profile/settings initialization;
  - per-account vocabulary/progress/history/session/statistics isolation;
  - forbidden direct writes and unauthenticated RPC calls;
  - atomic, idempotent review recording;
  - stale-device conflict rejection;
  - Again/Hard/Good/Easy scheduling and counters;
  - offline study date versus server-anchored next due time;
  - duplicate import skip/replace and full rollback on invalid rows;
  - daily queue limits and due-time filtering;
  - CSV/JSON validation and safe spreadsheet export;
  - timezone/streak calculations.
- HTTP smoke checks for the production app and install manifest.

## Hosted Supabase status

A dedicated Kotoba Supabase project was created and both migrations were applied. All seven public application tables have RLS enabled. Hosted function privileges were checked; the two trigger functions are not directly executable by signed-in users. The three intentionally exposed RPCs require authentication and check the caller inside the function. The following are **not yet verified live**:

- email signup/confirmation and password reset delivery;
- Supabase JWT/session refresh and live PostgREST authorization;
- realtime subscriptions and synchronization across actual devices;
- offline outbox replay against the hosted endpoint;
- Vercel deployment with production environment values;
- home-screen installation on physical iOS/Android devices.

Use the live acceptance checklist in README.md after applying the migration and connecting credentials. Do not treat the demo as verification of cloud authentication or synchronization.
