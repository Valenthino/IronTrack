# IronTrack database

This migration is for a **fresh, dedicated IronTrack Supabase project only**. No migration has been applied remotely. Do not run it against supabase-north-specs, supabase-wacrm, or any shared project. Provisioning, deployment, and Coolify changes are outside this round.

## Apply when the dedicated project is available

1. Verify the project name and project reference in the Supabase dashboard identify the dedicated IronTrack project.
2. Open that project's SQL Editor and execute the entire contents of `migrations/20260909000100_initial_schema.sql`. It runs in a transaction and includes the six reference exercise rows. Run once; it deliberately fails if these objects already exist. Record the filename as applied; do not subsequently replay it through CLI migrations.
3. Check that all five tables have RLS enabled, the six workout definitions exist, and two separate signed-in test accounts cannot read or modify one another's rows. The SQL Editor's privileged role bypasses RLS, so editor-only reads do not validate isolation.
4. Configure the app's existing public Supabase URL and publishable/anon key for this project only. Never place database passwords or service-role keys in source or client configuration.

For a team using the Supabase migration CLI instead of SQL Editor, import this migration into that dedicated project's migration workflow and review the pending migration list before applying. Do not use a previously linked workspace or run database reset against a remote project.

## Data contract

- `profiles`: one row per Auth user, created by onboarding after sign-in. Required experience values are beginner/intermediate/advanced (MVP vocabulary); goal is strength/size/confidence. No Auth signup trigger: account creation should not depend on questionnaire completion.
- Starting weights are explicit columns for all five lifts. SQL defaults are 45 lb. For kg onboarding, supply **all five** weights as 20 and `starting_weight_unit = 'kg'`; `startingWeights()` provides this payload. These are nominal bar defaults, not exact conversions.
- `settings`: one row per user, default lb. Onboarding should upsert it. Display unit changes never reinterpret stored weights: each profile, plan, and log carries its original weight unit.
- `workout_definitions`: authenticated read-only reference data. A = squat/bench/row, B = squat/overhead press/deadlift. All 5×5 except deadlift 1×5. Seed is part of the migration; it contains no users or credentials.
- `workout_plan`: six user-owned rows initialized from definitions and onboarding weights. One row per user/day/lift; targets and ordering come from definitions. The future progression engine must keep the two squat plan weights synchronized.
- `workout_logs`: one performed set per row, zero reps allowed for a failed set. Generate one session UUID per workout and reuse it across sets. Use a consistent workout day and session start time as `performed_at` throughout that session. Warm-up and work-set numbering each start at 1. The uniqueness constraint prevents duplicate set slots within a user's session. Session completion and A/B consistency within a session are application responsibilities in this four-entity MVP.
- Logs snapshot exercise/weight/unit independently of mutable plans, preserving history when plans change. No user-to-user foreign keys exist; ownership references Auth UUIDs. Auth account deletion cascades through all personal tables.
- Server timestamps default on insert; update triggers preserve `created_at` and refresh `updated_at`. Indexes support recent history, per-lift progression queries, session lookup, and per-user plans.
- Hand-maintained `src/lib/database.types.ts` mirrors this migration and types the Supabase client. Update it with schema changes; it does not replace runtime SQL constraints.

RLS uses explicit per-operation owner policies and both UPDATE predicates, following [Supabase's RLS guidance](https://supabase.com/docs/guides/database/postgres/row-level-security). Anonymous roles have no table privileges; authenticated roles cannot truncate or modify reference definitions. Supabase administrative/service roles remain privileged and must never be shipped to clients.

## Local verification

No Supabase service, credentials, Docker daemon, or remote database is needed:

```sh
npm run typecheck
npm install --prefix /tmp/irontrack-sql-validation --no-audit --no-fund @electric-sql/pglite@0.3.14
node scripts/validate-schema.mjs /tmp/irontrack-sql-validation/node_modules/@electric-sql/pglite/dist/index.js
```

The validator executes the actual migration in disposable in-memory PostgreSQL (PGlite), with a minimal Auth schema and role stand-in. It tests two-user CRUD isolation, forged ownership, anonymous access, reference protection, constraints, duplicate sets, warm-ups, timestamps, and deletion cascades. This validates SQL behavior, not a hosted Supabase/PostgREST deployment or real JWT authentication.
