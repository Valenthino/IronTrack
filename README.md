# IronTrack

Mobile-first, self-hostable 5×5 strength tracker inspired by StrongLifts. Expo Router screens provide local workout tracking with a bold red/dark/white UI.

## Run locally

Use Node.js 22.13+ (Node 22 LTS recommended) and npm.

```sh
npm ci
npm run web
```

For a device, run `npm start` and open with an SDK-compatible Expo Go client. `npm run android` and `npm run ios` target installed emulators/simulators; iOS requires macOS and Xcode.

## Supabase

The preview works without configuration. To configure a backend, copy `.env.example` to `.env.local` and set:

- `EXPO_PUBLIC_SUPABASE_URL`: your hosted or self-hosted Supabase API URL.
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`: your public anon key (a publishable key is also accepted).

Restart Expo after changes. Expo embeds these values in the client bundle; never use a service-role key or other secret. Enable row-level security and appropriate policies before adding data access. A physical phone needs a URL reachable from the phone; localhost points to the phone itself.

`src/lib/supabase.ts` exposes a lazy singleton through `getSupabase()`, returning `null` when configuration is absent. Native session storage uses AsyncStorage; web uses Supabase's default browser storage. The auth screen uses this client to restore sessions, sign up and sign in with email and password, and sign out locally. “Configured” means variables are present, not that a connection was verified. The client is typed with the Round 2 database model. No external service was contacted during this round; email/password sign-in still requires verification in a configured test environment.

The SQL migration, reference workouts, data contract, isolated validation, and dedicated-project application instructions are in [supabase/README.md](supabase/README.md). No remote migration or deployment has been performed.

## Verify and build web

```sh
npm run typecheck
npm test
npx expo install --check
npm run build:web
npm run preview:web
```

The production static web export is written to `dist/`; preview serves it locally on port 8080. Public environment variables must be set **before building**. This round does not deploy anything.

## Structure and scope

- `app/_layout.tsx`: Router stack, safe areas, and status bar.
- `app/index.tsx`: today’s workout, A/B previews, per-set logging, warm-ups, completion, and rest timer.
- `app/onboarding.tsx`: five-step experience, goal, schedule/units, starting weights, and review wizard.
- `app/auth.tsx`: optional email + password sign-in and sign-up.
- `app/history.tsx`, `app/settings.tsx`: history, current targets, units, and account navigation.
- `src/state/store.tsx`: versioned local persistence with guarded writes.
- `src/training/flows.ts`: pure setup, logging, completion, unit conversion, and restore validation.
- `src/ui/common.tsx`: shared mobile layout and accessible controls.
- `src/theme/index.ts`: shared color and sizing tokens.
- `src/lib/supabase.ts`: optional environment-based client configuration.

Training works without an account. Onboarding records experience and strength/size/confidence goals, with the same classic A/B prescription for every goal. New installations default to lb. Blank starting weights default to 20 kg / 45 lb per lift. Explicit starting weights accept any finite value of 0 or more, including weights below the bar. Settings supports custom bar weights (including 40 lb) and optional microloading.

Start the scheduled workout, tap each set box, and choose 0–5 completed reps. Zero is an attempted failed set; a blank set is unlogged. Finish is enabled only after every working set is recorded. Completion saves an immutable session snapshot and applies the pure engine once. Successful lifts progress, failed lifts hold/deload, and A/B alternates. Warm-ups are shown separately and do not affect progression.

The rest timer starts at 2 minutes for a five-rep set and 3 minutes for fewer reps; manual 2/3-minute and skip controls are available. Its timestamp survives navigation and reloads, so background elapsed time is counted without notifications.

Setup, active sets, timer deadline, and history are stored using AsyncStorage under `irontrack.training.v1`. AppData version 2 retains this storage key and migrates version 1 on read, preserving lift weights, stalls, profile, history, active reps, and timer deadlines. Migrated snapshots default to microloading off and the standard bar; the next successful write persists version 2. Writes finish before UI state advances, and duplicate completion is guarded. Failed storage reads leave existing data untouched and block writes; reload to retry. This MVP assumes one active app tab. Training is device-local and shared by people using the same browser/device, even when signed in. Signing out preserves local training; clearing browser/app storage removes it. Cloud workout sync is not implemented.

Settings converts current targets to the nearest loadable weight in the selected unit while retaining stalls; repeated conversions can round weights. Unit and equipment changes are disabled during active workouts. Custom bar weights convert with units; changing equipment leaves current lift targets and history intact. Historical weights retain their original units. Approved R5 adds local reminders, bodyweight logs, session notes, and history-derived progress (see below).

Setup follows the official [Expo Router installation guide](https://docs.expo.dev/router/installation/) and [Supabase React Native guide](https://supabase.com/docs/guides/auth/quickstarts/react-native).

## Round 1 verification

TypeScript checking, Expo dependency compatibility, and static web export pass on Node 22.23.2. Native simulator/device behavior has not been verified. The initial dependency audit reports 13 moderate findings in Expo's transitive dependency tree (including Router URL decoding and build tooling), with no high or critical findings. Review upstream fixes before deployment; no forced major-version upgrades were applied.

## Training engine (Round 3)

`src/training/engine.ts` is a standalone TypeScript module with no React or database imports. `createTrainingState` starts on A with nominal 20 kg / 45 lb bars. `workoutDefinition` returns classic A/B prescriptions, including deadlift 1×5. Call `completeSession` once per finalized session with every prescribed working set; failed attempts may have zero reps. Incomplete logs are rejected. Persistence and duplicate-session prevention belong to the caller.

Successful lifts add 2.5 kg / 5 lb (including deadlift), or 1.25 kg / 2.5 lb with microloading enabled. A failed lift holds its weight; the third consecutive failure reduces it by 10%, rounded to the selected increment, without a bar-weight floor or an increase above the failed target. Success and deload reset stalls. Squat progress is shared across A/B; sessions alternate even if a lift stalls. Warm-ups are excluded from success checks.

`warmupSets` returns two empty-bar sets plus ascending 40% ×5, 60% ×3, and 80% ×2 sets, rounded down to loading increments; duplicate intermediate loads and loads at or above working weight are omitted. A working weight at or below the selected bar returns no separate warm-ups. `restSeconds` defaults to 120 seconds, or 180 after a difficult/failed set.

`calculatePlates` assumes unlimited matched pairs of standard kg or lb plates and returns counts **per side**, actual loaded weight, and the remaining unloadable weight. Custom bar weights are supported. The engine’s units are nominal; the UI flow explicitly converts current targets when the user changes units. Finite, nonnegative weights are required; targets below the bar return no plates, the selected bar as loaded weight, and a negative remainder indicating how far the bar exceeds the target. Positive remainders indicate weight still unloadable with the available denominations. Microloading adds matched 0.625 kg / 1.25 lb plates.

`npm test` compiles the isolated engine with the installed TypeScript compiler and runs Node's built-in unit tests without extra dependencies or network access. Flow tests also cover onboarding validation, set edits, completion, duplicate prevention, unit changes, persisted data validation, timer arithmetic, and email input validation.

## Round 4 verification

- `npm test`: 21 engine/flow tests pass.
- `npm run typecheck`: passes.
- `npm run build:web`: exports all seven routes, including auth, onboarding, history, and settings.
- Local headless Chromium at 390 × 844: onboarding, unconfigured auth, A/B preview, 15-set workout A completion, failed-lift hold, active draft/timer reload, history, and unit conversion pass without runtime exceptions or horizontal overflow.

`scripts/smoke-web.mjs` reproduces the browser flow with no extra npm dependencies. Serve `dist` on `127.0.0.1:8084`, start Chromium with a **disposable profile** and `--remote-debugging-port=9334`, then run `node scripts/smoke-web.mjs`. It clears local storage for that test origin and writes a screenshot to `/tmp/irontrack-round4-mobile.png`. Use an unconfigured build. Navigation link styles are flattened before passing through Router’s `asChild` wrapper to keep DOM anchor styles valid.

Real email/password sign-in against a configured Supabase project, and native device behavior, remain unverified. No deployment, external service changes, or database writes were performed.

## Deployment (Round 5)

[Coolify deployment handoff](docs/deployment.md) covers the existing public GitHub repository, Dockerfile build settings, public Supabase build variables, health checks, and operator verification. The multi-stage image serves the Expo export with non-root Nginx on port 8080. `/health.json` is a static liveness artifact. Run `npm run smoke:deployed -- https://your-deployed-host` for a read-only HTTP smoke check. Provisioning and deployment are separate infrastructure tasks.

## Round 6 review

See [review findings and verification](docs/review-round6.md). Review fixes are local commits; the deployed HTTP smoke checks the existing deployment, not these unshipped changes.

## Round 7 — final polish

Visual consistency, accessibility, and state clarity pass. No new features were added.

- **Single accent red.** The theme previously declared `#E32736` while buttons and completed set boxes used `#C91D2C`. All red accents now resolve to one token (`theme.colors.red`), and the set boxes, buttons, badge, and brand mark share it.
- **Success vs error feedback.** `Message` now accepts a `tone` (`error` | `success`). "Workout saved", "You're signed in", "Signed out", and "Check your inbox" render in a distinct success color instead of the error red; genuine errors stay red.
- **Loading is not an error.** A new `Loading` component renders muted, `progressbar`-labelled text. Every screen's `!ready` branch now shows a neutral loading state and only surfaces a red message when storage actually failed.
- **Touch targets.** Interactive controls keep ≥ 48px height (nav 48, buttons 50, inputs 52, set boxes 52), meeting mobile accessibility guidance.
- **Test gap closed.** Added engine coverage asserting invalid units and workouts are rejected consistently across `increment`, `barWeight`, `createTrainingState`, `calculatePlates`, and `workoutDefinition`.

Verification: `npm test` (24 passing), `npm run typecheck`, and `EXPO_NO_DOTENV=1 npm run build:web` all pass. See the commit message for the deployed hash.

## Approved visual round R2

Onboarding uses five steps with red selection cards, progress, back navigation, inline validation, and native geometric lift illustrations. Schedule preferences (2/3/4 days and a training/rest pattern) are stored as optional profile data, so existing v1/v2 saves remain compatible. They do not change workout sequencing or add reminders. Experience and goal personalize advisory hints; blank weights still use the nominal empty bar. Explicit weights are retained separately for lb and kg while navigating the wizard. Done saves through the existing guarded local store. Auth and backend behavior are unchanged.

Focused verification: `npm test`, `npm run typecheck`, and `EXPO_NO_DOTENV=1 npm run build:web`. With the export served on port 8084 and a disposable Chromium profile exposing CDP on port 9334, run `node scripts/smoke-onboarding.mjs` for the five-step mobile flow, validation, unit/back retention, review, save/reload, 320px overflow and 48px target checks. This browser check clears only the test origin's local storage.


## Approved round R3 — custom programs

Plan / Program is available from Today and Settings. Classic A/B remains the default; PPL (Push, Pull, Legs) and Upper/Lower are available as replacement presets. Replacement requires an inline confirmation, starts at the first day, and preserves all lift targets and completed history.

Create a custom program by editing its name, adding/removing/renaming days, and adding/removing/reordering the five core lifts. Days can be reordered and have stable IDs, so renaming does not change rotation. Save applies the whole validated program; each day must contain at least one unique core lift. Removing the upcoming day selects the first remaining day. Choose 1–7 days per week independently of the rotation length. A changed frequency clears an incompatible onboarding weekday pattern; no calendar scheduling or reminders are added.

The pure engine resolves ordered days from the program, wraps after its final day, and preserves per-lift progression across all days. Prescriptions, microloading, three-stall deloads, warmups and rest behavior remain unchanged. Plan edits are blocked during active workouts. History retains each session’s program/day names and prescriptions as saved.

AppData version 3 migrates v1/v2 current training, active drafts and history to Classic A/B, keeping the existing local storage key and preserving the next A/B day, weights, stalls, equipment, logged reps and rest deadline. Existing schedule frequency is retained; otherwise frequency defaults to three. No sync, backend, deployment, or R4–R6 work is included.

R3 verification: `npm test` (44 tests), `npm run typecheck`, and `EXPO_NO_DOTENV=1 npm run build:web`.


## Approved round R5 — progress and consistency

History now includes lightweight native View line graphs for all five lifts, all-time PR badges, and stall/deload outcomes derived from the saved session snapshot. Graphs show working weights (including failed attempts), sorted by completion time and converted to the current display unit. A PR is the heaviest working weight with at least one completed rep; zero-rep attempts do not qualify. Tied all-time records receive badges. This is not an estimated 1RM.

The Monday-first month calendar marks workouts and bodyweight logs. Tap a date to filter sessions, then tap a session to edit its notes. Multiple sessions on the same date remain available. The grid scrolls horizontally on narrow phones to retain 48px day targets. Notes can also be saved during an active workout, survive reloads and completion, and are limited to 2,000 characters. Save notes before leaving or finishing.

The streak counts consecutive Monday–Sunday weeks meeting the **current program’s weekly target on distinct training days**. Rest days and the unfinished current week do not break it; a completed week below target does. Changing the weekly target recalculates the streak. Multiple workouts on one day count as one training day.

Optional bodyweight logs accept a positive weight and local date, one entry per date; saving again replaces that date’s entry. Logs retain their entered units, appear on the progress graph, and are marked in the calendar.

Settings has opt-in reminder weekdays (Monday-first) and a 24-hour local time. The in-app banner appears at/after that time until dismissed for the day or a workout is active/completed that day. Browser Notification permission is requested only via the explicit button; unsupported or denied notifications leave the banner usable. Browser delivery is best-effort while the app is open, once per day per tab session. **Closed-app/background scheduled delivery is not supported.** No email, SMS, push server, sync, or new dependencies.

R5 retains AppData version 3 and the existing storage key. New optional notes/bodyweight/reminder fields are validated on restore; older v1/v2 migrations and existing v3 saves remain supported. All training and R5 metadata stay device-local regardless of sign-in. No deployment or infrastructure changes are part of this round.

Verification: `npm test` (61 pure-model tests), `npm run typecheck`, and `EXPO_NO_DOTENV=1 npm run build:web -- --clear`. R5 model coverage includes mixed-unit PRs, zero-rep attempts, stall snapshots, notes through completion, bodyweight replacement/validation, leap calendars, year/week boundaries, rest-day grace, reminder timing/suppression, and corrupt local-data rejection.


Local mobile smoke: serve the R5 export on `127.0.0.1:8087`, start Chromium with a disposable profile and `--remote-debugging-port=9337`, then run `node scripts/smoke-r5.mjs` after `npm test`. It clears only that local origin’s training storage and verifies PR/stall rendering, calendar filtering, bodyweight, notes/reload, reminder banner/dismissal and settings/reload, 320px overflow, and 48px controls. All pass without runtime exceptions. Native device behavior and actual browser notification delivery are not verified; permission and delivery remain browser-dependent.
