# Development and delivery

## Runtime and setup

Use Node 24; run npm ci from the repository root. package-lock.json is authoritative. Environment values belong in ignored .env.local; PowerShell can use `Copy-Item .env.example .env.local`. Do not paste actual keys into issue descriptions, test fixtures or documentation.

| Variable                             | Visibility       | Required                                  |
| ------------------------------------ | ---------------- | ----------------------------------------- |
| NEXT_PUBLIC_SUPABASE_URL             | Browser + server | Protected identity/data features          |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Browser + server | Same; use publishable key only            |
| APP_URL                              | Server           | Production build/runtime canonical origin |

Development defaults APP_URL to http://localhost:3000. Production-style local tests use http://127.0.0.1:3000. Public pages remain reviewable without a configured backend; protected routes fail closed. Do not introduce fake backend credentials to satisfy build checks.

## Database

Docker must be running for `npm run db:start`. Only use `npm run db:reset` against the local stack; it recreates local development data. Seeds are disabled. Use `npm run db:types` after migrations. If Docker is unavailable, the integration suite can validate migrations in embedded PostgreSQL, but complete Supabase CI remains required.

Create a new timestamped migration for subsequent schema changes. Keep seed fixtures in rollback tests only. Supabase hosted connection and deployment secrets are managed outside this repository. No automated migration against production is configured.

## Git workflow

Feature branches target develop. Develop integrates tested work; main is released after review. Phase 0 started with an empty remote and no main/develop history. The initial work branch is feature/phase-0-foundation. Establish develop from the reviewed baseline; promote to main only when release configuration is ready. Never force-push shared history or merge a failing workflow.

Recommended branch protection requires both CI jobs: `Lint, types, tests and production build` and `Supabase migrations and RLS`. Require PR review and disallow force pushes. Branch protections are repository settings and must be verified separately; committing a workflow does not enable protection.

## Vercel

Import the GitHub repository using the Next.js preset and repository root. Node runtime is 24, install is npm ci, build is npm run build. Set APP_URL to the exact canonical deployment origin and the two Supabase public settings for that environment. Choose main as production only after it exists and is approved. Feature/develop previews must not connect to production data. No vercel.json is needed for the supported App Router preset.

Do not connect a Vercel project or publish a feature branch as production just to demonstrate a build. Foundation verification uses local production builds and CI. The existing Supabase/Vercel account tabs identify the product context but do not prove any deployment/configuration was performed.
