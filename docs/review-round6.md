# Round 6 self-review — 2026-09-09

Review baseline: `636fb14`, all tracked implementation changes since `458ce58`, checked against `/opt/hermes-vault/Projects/Personal/IronTrack.md`. Changes made in isolated worktree `/tmp/IronTrack-review`, branch `fix/round6-review`. No deployment or infrastructure/database mutation performed.

## Fixed

- New installations incorrectly defaulted to kg. They now default to lb/45; existing kg training remains kg. Onboarding uses the current unit when mounted.
- The approved plate guide existed only as an engine function. Workout cards now show matched plates **per side**, including an explicit empty-bar state.
- The approved three-workouts/week cadence was absent from onboarding guidance. The welcome screen now explains alternating A/B with rest days.
- Persisted targets accepted unloadable weights and setup accepted extreme numeric magnitudes. Setup/restore now reject unsafe increment counts; restore also checks loadability before exposing targets to the screen/engine. Invalid saved data remains untouched under the existing fail-closed store behavior.
- Completed-set captions had insufficient contrast on red; they now use white. Placeholder text is darker on the light input background.
- An incomplete callback containing only a refresh token remained in the address bar. It now follows callback cleanup and displays the invalid-link message. Malformed callback URLs are caught instead of throwing out of the effect.

## Outstanding findings / acceptance limits

1. **High — account-backed training is not implemented.** `src/state/store.tsx` uses one device-local AsyncStorage key; no application code reads/writes the Supabase training tables. Signing in does not isolate training by user, migrate it, or restore it across devices. UI disclosures accurately describe shared device storage, but this is not the fully integrated Supabase MVP implied by the brief. Replacing the persistence architecture and deciding guest-data ownership is beyond a bounded review fix; do not mark the complete MVP accepted.
2. **Schema integration contract is incomplete.** SQL and database TypeScript types agree and local RLS tests pass. Local profile values (`new/returning/experienced`) differ from SQL (`beginner/intermediate/advanced`) and are not interchangeable experience classifications. Draft IDs are not UUIDs; SQL sessions require UUIDs. The schema does not persist engine stalls or next-workout state directly. A future adapter must define these semantics, synchronize squat across A/B, enforce session consistency, and atomically prevent duplicate progression. SQL documentation assigns session consistency to application code; no such remote writer exists today. SQL numeric bounds also differ from the local numeric model. Do not directly upload local state.
3. **13 moderate dependency audit findings**, zero high/critical. They include the Router URL-decoding chain and Expo tooling dependencies. The audit's proposed fixes downgrade Expo/Router across major versions and were not applied. Expo dependency compatibility passes. This remains an upstream remediation item, not evidence of a clean dependency audit.
4. **Native and real authentication remain unverified.** No SMTP email was sent; no real account callback, native device build, screen-reader session, or hosted JWT/RLS request was tested. The HTTP health artifact says nothing about database/SMTP readiness or the dedicated Supabase service. No other Coolify or Supabase resource was inspected or changed.
5. Local persistence still assumes one active tab, as already documented. Concurrent tabs can overwrite stale snapshots; local data is not an account boundary or backup. The implementation makes no multi-tab synchronization claim.

## Verification evidence

- `npm test`: 23 passing tests. Added regressions for lb defaults, preserving existing kg data, and rejecting unsafe/unloadable targets; existing tests cover per-lift progression, third-stall deload, squat sharing, warm-up exclusion, plate conservation, failed/zero sets, duplicate completion, unit conversion, draft restore, and timers.
- `npm run typecheck`: passes.
- `EXPO_NO_DOTENV=1 npm run build:web`: passes, seven exported routes. Worktree dependencies were installed independently after browser testing exposed Metro resolving the original checkout through a dependency symlink; the accepted build uses worktree sources.
- `EXPO_NO_DOTENV=1 npx expo install --check`: dependencies compatible.
- `node scripts/validate-schema.mjs`: 49 local PGlite checks pass, covering actual migration execution, two-user CRUD isolation, ownership forgery/transfer, anonymous access, reference protection, constraints, timestamps, and cascades. No migration changed.
- `node scripts/smoke-web.mjs`: headless Chromium with a disposable profile against the revised local export. Covers lb onboarding default, explicit kg setup, unconfigured auth, A/B previews, all 15 A and 11 B working sets, failed-lift hold, progression, timer/draft reload, history, conversion, empty/nonempty plate guidance, and no horizontal overflow at 320/390/1280px. Also checks refresh-only synthetic callback cleanup and retained training history. No runtime exceptions.
- `npm run smoke:deployed -- https://irontrack.vavqo.com`: passes health JSON, five routes, application bundles and missing-asset 404. This read-only check verifies the existing deployment, **not the unshipped review fixes**.
- Git-history secret-pattern scan: zero matches for private-key headers, common provider secret prefixes, AWS access IDs or JWTs in inspected tracked files/revisions. Environment files were not read; no real credentials were used. Pattern scans cannot prove the absence of all secrets. Docker context is allowlisted and excludes environment/key material; client configuration is public-only by contract.
- `git diff --check`: passes. No extra dependencies, analytics, reminders, notes, or other out-of-MVP features added.
