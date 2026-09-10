# IronTrack

Mobile-first, self-hostable 5×5 strength tracker inspired by StrongLifts. Round 1 establishes an Expo TypeScript app with Expo Router, React Native Web, and a red/dark/white UI.

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

`src/lib/supabase.ts` exposes a lazy singleton through `getSupabase()`, returning `null` when configuration is absent. Native session storage uses AsyncStorage; web uses Supabase's default browser storage. No backend requests are made by the shell. “Configured” means variables are present, not that a connection was verified. The client is typed with the Round 2 database model. Auth flows, lifecycle-based token refresh, and workout persistence UI are future work.

The SQL migration, reference workouts, data contract, isolated validation, and dedicated-project application instructions are in [supabase/README.md](supabase/README.md). No remote migration or deployment has been performed.

## Verify and build web

```sh
npm run typecheck
npx expo install --check
npm run build:web
npm run preview:web
```

The production static web export is written to `dist/`; preview serves it locally on port 8080. Public environment variables must be set **before building**. This round does not deploy anything.

## Structure and scope

- `app/_layout.tsx`: Router stack, safe areas, and status bar.
- `app/index.tsx`: responsive workout A/B preview with accessible selection controls.
- `src/theme/index.ts`: shared color and sizing tokens.
- `src/lib/supabase.ts`: optional environment-based client configuration.

The shell previews exercises only. It does not log sets, calculate progression, authenticate users, or save data.

Setup follows the official [Expo Router installation guide](https://docs.expo.dev/router/installation/) and [Supabase React Native guide](https://supabase.com/docs/guides/auth/quickstarts/react-native).

## Round 1 verification

TypeScript checking, Expo dependency compatibility, and static web export pass on Node 22.23.2. Native simulator/device behavior has not been verified. The initial dependency audit reports 13 moderate findings in Expo's transitive dependency tree (including Router URL decoding and build tooling), with no high or critical findings. Review upstream fixes before deployment; no forced major-version upgrades were applied.
