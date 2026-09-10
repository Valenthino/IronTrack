# Coolify deployment handoff

Repository: https://github.com/Valenthino/IronTrack (public), branch `main`.
The Round 5 commit must be pushed/merged into the selected branch before infrastructure provisions it. This handoff does not provision infrastructure or deploy.

## Application settings

1. On the separately provisioned Coolify server, create an application from the public Git repository above.
2. Select the **Dockerfile** build pack, base directory `/`, Dockerfile `/Dockerfile`, and the final/default build target (`runtime`). No custom build/start command or publish directory is needed.
3. Set **Ports Exposes** to `8080`. Route the assigned HTTPS domain to container port 8080; leave host port mappings empty. Coolify's proxy terminates TLS. No volume is needed.
4. Set the two variables below as **build variables** (available as Docker build arguments). Leave both unset for the local-only MVP. For authentication, provide both.
5. Keep health checks enabled. The Dockerfile includes a check against `http://127.0.0.1:8080/health.json` (200, JSON status `ok`). If an explicit dashboard check is required, use HTTP GET, port 8080, path `/health.json`, expected status 200, interval 30s, timeout 3s, start period 10s, and 3 retries.
6. An authorized infrastructure operator can build/deploy, then run the smoke command below against the final HTTPS URL. Follow with a browser check of onboarding, workout persistence after reload, and auth if configured.

## Public build configuration

| Variable | Value |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL` | Browser-reachable HTTPS Supabase API URL |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Public anon or publishable client key |

Expo embeds these values in browser JavaScript at build time. Runtime-only container variables do **not** change an existing export: rebuild after changes. These are public configuration, not secrets. Never supply a service-role/secret key, database password, or private token. No credentials are needed to clone the public repository. The Docker build context uses an allowlist and excludes local environment files; Expo dotenv loading is disabled in the image build.

Use a dedicated Supabase project with the schema and RLS policies described in [the Supabase handoff](../supabase/README.md). Configure the deployed origin as the Auth Site URL and the exact `https://<host>/auth` callback in redirect allowlists. `/auth` is served directly, preserving callback query parameters. Native testing also requires `irontrack://auth`. Schema application and real email/auth verification are separate operator tasks.

Training data remains in browser-local storage, even when signed in; this image adds no cloud workout sync. Health reports static web availability, not Supabase connectivity, email delivery, or database readiness.

## Local image verification (Docker required)

```sh
docker build -t irontrack:round5 .
docker run --rm -d --name irontrack-round5 -p 127.0.0.1:8080:8080 irontrack:round5
npm run smoke:deployed -- http://127.0.0.1:8080
docker inspect --format '{{.State.Health.Status}}' irontrack-round5
docker stop irontrack-round5
```

For a configured image, pass `--build-arg EXPO_PUBLIC_SUPABASE_URL --build-arg EXPO_PUBLIC_SUPABASE_ANON_KEY` to `docker build` after supplying the public values in your build environment. Do not put actual values in committed files.

```sh
npm run smoke:deployed -- https://your-deployed-host
```

The dependency-free Node 22 smoke script performs read-only GET requests for health, five exported routes, referenced home-page scripts, and a missing asset. It fails on redirects (use the final canonical URL), unexpected status/content types, or a missing-asset response other than 404. It does not sign in, write data, or execute browser JavaScript.

The runtime image contains Nginx and the export only, runs as UID 101, and listens on an unprivileged port. HTML/assets revalidate to avoid stale releases. No SPA fallback masks missing assets. Base images track Node 22 and stable unprivileged Nginx; rebuild for upstream security updates and pin reviewed digests if reproducibility is required. Roll back by redeploying a known-good commit with its matching public build settings; browser-local data is not part of the image.

References: [Coolify Dockerfile builds](https://next.coolify.io/docs/applications/builds/dockerfile), [Coolify health checks](https://next.coolify.io/docs/applications/configuration/health-checks), [Expo environment variables](https://docs.expo.dev/guides/environment-variables/).

## Round 5 verification

- `npm test`: 21 tests passed.
- `npm run typecheck`: passed.
- `EXPO_NO_DOTENV=1 npm run build:web`: passed; seven routes exported, plus the public health artifact.
- `npm run smoke:deployed -- http://127.0.0.1:8085`: passed against the local export served with the existing `serve` dependency.
- Docker and Nginx executables are unavailable in the implementation workspace; the image build, Nginx configuration execution, and container health check remain to be verified using the commands above.
- No Coolify calls, deployments, remote database changes, or real Supabase credentials were used.
