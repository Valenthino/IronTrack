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

`src/lib/supabase.ts` exposes a lazy singleton through `getSupabase()`, returning `null` when configuration is absent. Native session storage uses AsyncStorage; web uses Supabase's default browser storage. The auth screen uses this client to restore sessions, request email magic links, handle code/token callbacks, and sign out locally. “Configured” means variables are present, not that a connection was verified. The client is typed with the Round 2 database model. In a configured installation, allow the web `/auth` URL and native `irontrack://auth` callback in Supabase Auth redirect settings. Open links on the same device/browser. No external service was contacted during this round; email delivery and native callback behavior still require verification in a configured test environment.

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
- `app/onboarding.tsx`: experience, goal, units, and starting weights.
- `app/auth.tsx`: optional email magic-link sign-in and callback handling.
- `app/history.tsx`, `app/settings.tsx`: history, current targets, units, and account navigation.
- `src/state/store.tsx`: versioned local persistence with guarded writes.
- `src/training/flows.ts`: pure setup, logging, completion, unit conversion, and restore validation.
- `src/ui/common.tsx`: shared mobile layout and accessible controls.
- `src/theme/index.ts`: shared color and sizing tokens.
- `src/lib/supabase.ts`: optional environment-based client configuration.

Training works without an account. Onboarding records experience and strength/size/confidence goals, with the same classic A/B prescription for every goal. Blank starting weights default to 20 kg / 45 lb per lift. Custom weights must be at least the nominal bar and use 2.5 kg / 5 lb increments.

Start the scheduled workout, tap each set box, and choose 0–5 completed reps. Zero is an attempted failed set; a blank set is unlogged. Finish is enabled only after every working set is recorded. Completion saves an immutable session snapshot and applies the pure engine once. Successful lifts progress, failed lifts hold/deload, and A/B alternates. Warm-ups are shown separately and do not affect progression.

The rest timer starts at 2 minutes for a five-rep set and 3 minutes for fewer reps; manual 2/3-minute and skip controls are available. Its timestamp survives navigation and reloads, so background elapsed time is counted without notifications.

Setup, active sets, timer deadline, and history are stored using AsyncStorage under `irontrack.training.v1`. Writes finish before UI state advances, and duplicate completion is guarded. Failed storage reads leave existing data untouched and block writes; reload to retry. This MVP assumes one active app tab. Training is device-local and shared by people using the same browser/device, even when signed in. Signing out preserves local training; clearing browser/app storage removes it. Cloud workout sync is not implemented.

Settings converts current targets to the nearest loadable weight in the selected unit while retaining stalls; repeated conversions can round weights. Unit changes are disabled during active workouts. Historical weights retain their original units. No reminders, bodyweight, notes, or advanced analytics are included.

Setup follows the official [Expo Router installation guide](https://docs.expo.dev/router/installation/) and [Supabase React Native guide](https://supabase.com/docs/guides/auth/quickstarts/react-native).

## Round 1 verification

TypeScript checking, Expo dependency compatibility, and static web export pass on Node 22.23.2. Native simulator/device behavior has not been verified. The initial dependency audit reports 13 moderate findings in Expo's transitive dependency tree (including Router URL decoding and build tooling), with no high or critical findings. Review upstream fixes before deployment; no forced major-version upgrades were applied.

## Training engine (Round 3)

`src/training/engine.ts` is a standalone TypeScript module with no React or database imports. `createTrainingState` starts on A with nominal 20 kg / 45 lb bars. `workoutDefinition` returns classic A/B prescriptions, including deadlift 1×5. Call `completeSession` once per finalized session with every prescribed working set; failed attempts may have zero reps. Incomplete logs are rejected. Persistence and duplicate-session prevention belong to the caller.

Successful lifts add 2.5 kg / 5 lb (including deadlift). A failed lift holds its weight; the third consecutive failure reduces it by 10%, rounded to the nearest standard increment and bounded by the nominal bar (or an existing lighter weight). Success and deload reset stalls. Squat progress is shared across A/B; sessions alternate even if a lift stalls. Warm-ups are excluded from success checks.

`warmupSets` returns two empty-bar sets plus ascending 40% ×5, 60% ×3, and 80% ×2 sets, rounded down to loading increments; duplicate intermediate loads and loads at or above working weight are omitted. An empty-bar working weight needs no separate warm-ups. `restSeconds` defaults to 120 seconds, or 180 after a difficult/failed set.

`calculatePlates` assumes unlimited matched pairs of standard kg or lb plates and returns counts **per side**, actual loaded weight, and the remaining unloadable weight. Custom bar weights are supported. The engine’s units are nominal; the UI flow explicitly converts current targets when the user changes units. Finite, nonnegative weights are required; targets below the bar are rejected.

`npm test` compiles the isolated engine with the installed TypeScript compiler and runs Node's built-in unit tests without extra dependencies or network access. Flow tests also cover onboarding validation, set edits, completion, duplicate prevention, unit changes, persisted data validation, timer arithmetic, and email input validation.

## Round 4 verification

- `npm test`: 21 engine/flow tests pass.
- `npm run typecheck`: passes.
- `npm run build:web`: exports all seven routes, including auth, onboarding, history, and settings.
- Local headless Chromium at 390 × 844: onboarding, unconfigured auth, A/B preview, 15-set workout A completion, failed-lift hold, active draft/timer reload, history, and unit conversion pass without runtime exceptions or horizontal overflow.

`scripts/smoke-web.mjs` reproduces the browser flow with no extra npm dependencies. Serve `dist` on `127.0.0.1:8084`, start Chromium with a **disposable profile** and `--remote-debugging-port=9334`, then run `node scripts/smoke-web.mjs`. It clears local storage for that test origin and writes a screenshot to `/tmp/irontrack-round4-mobile.png`. Use an unconfigured build. Navigation link styles are flattened before passing through Router’s `asChild` wrapper to keep DOM anchor styles valid.

Real magic-link delivery, configured Supabase callbacks, and native device behavior remain unverified. No deployment, external service changes, or database writes were performed.

## Deployment (Round 5)

[Coolify deployment handoff](docs/deployment.md) covers the existing public GitHub repository, Dockerfile build settings, public Supabase build variables, health checks, and operator verification. The multi-stage image serves the Expo export with non-root Nginx on port 8080. `/health.json` is a static liveness artifact. Run `npm run smoke:deployed -- https://your-deployed-host` for a read-only HTTP smoke check. Provisioning and deployment are separate infrastructure tasks.
