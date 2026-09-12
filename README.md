# Naql365 · نقل 365

Transportation Operating Platform. **Phase 3: Operations, multi-Trip dispatch and POD foundation.** Staging acceptance and review status are recorded in the canonical Phase 3 report; this is not a Production release.

Independent implementation for Naql365. No source, branding, credentials or data from another product is used.

## Quick start

Requires Node 24 and npm. For the complete local Supabase stack, Docker must be running.

```sh
npm ci
cp .env.example .env.local
npm run dev
```

Visit `/ar` (default) or `/en`. Public pages work without Supabase credentials; protected routes fail closed with a configuration state. Fill the two public Supabase settings from **this project's** local instance or isolated development project. Set `APP_URL` to your canonical origin; production builds require it. Never use production credentials for local tests.

```sh
npm run db:start
npm run db:reset
npm run db:types
npm run lint
npm run typecheck
npm run test:unit
npm run build
npx playwright install chromium
npm run test:e2e
npm run test:db
```

For local production/E2E builds, set `APP_URL=http://127.0.0.1:3000`. E2E starts the built app itself and expects no Supabase environment variables. On Windows use `$env:APP_URL='http://127.0.0.1:3000'`. The shared PostgreSQL integration assertions also run without Docker via PGlite in `test:unit`. Complete Supabase tests run separately in CI.

## Structure

```text
src/app/                    Next.js route composition, layouts and handlers
src/components/             UI primitives and shells
src/styles/                 Brand and semantic design tokens
src/i18n/                   Central ar/en dictionaries and locale utilities
src/domain/                 Framework-independent models and provider ports
src/application/            Testable authorization and safe redirect services
src/infrastructure/         Supabase adapters, server guards, storage, configuration
supabase/migrations/        Ordered, reviewed database and storage changes
tests/unit/                 Pure logic and input boundary tests
tests/integration/          Applied SQL and adapter integration tests
supabase/tests/             Shared rollback-only database assertions
tests/e2e/                  Browser, accessibility and route checks
docs/                       Architecture, operations and decision records
```

## Documentation

- [Repository audit](docs/repository-audit.md)
- [Architecture and decisions](docs/architecture.md)
- [Database and migrations](docs/database.md)
- [Authentication and RBAC](docs/auth-and-rbac.md)
- [Security baseline](docs/security.md)
- [Development and deployment](docs/development.md)
- [Testing](docs/testing.md)
- [Phase roadmap](docs/roadmap.md)
- [Customer identity and request intake](docs/customer-request-intake.md)
- [Pricing and quote architecture](docs/pricing-and-quotes.md)
- [Phase 2 acceptance report](docs/reports/Naql365-Phase-2-Report.md)
- [Operations architecture and schema analysis](docs/operations-dispatch-pod.md)
- [Phase 3 acceptance report](docs/reports/Naql365-Phase-3-Report.md)

Workflow: `feature/* → develop → main`. Phase 3 uses `feature/phase-3-operations-dispatch-pod` from accepted develop `86ba612a5f6f7f4afd7a5c0650d5b4d3848f2b6f`. Phase 4 remains locked. Phase 3 merging requires separate owner authorization and the protected review workflow. No automatic Production release is configured.
