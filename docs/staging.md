# Staging architecture and reconstruction

Phase 0.5 verified the foundation; Phase 1 extends the same isolated Staging environment with customer identity and request intake. Phase 2 adds isolated pricing and quote acceptance verification. Dispatch, payment and Phase 3+ workflows remain excluded. Historical foundation evidence stays in the Phase 0.5 report; current intake acceptance belongs to the Phase 1 report.

## Environment inventory

| Environment | Application                                         | Database                                                     |
| ----------- | --------------------------------------------------- | ------------------------------------------------------------ |
| Local       | Next.js on loopback, APP_ENV=local                  | Supabase local PostgreSQL 17                                 |
| Staging     | Vercel project naql365-staging, Preview target only | Supabase naql365-staging, zuvyfeflkzlciuaauxba, eu-central-1 |
| Production  | Outside this phase                                  | Never connected or migrated                                  |

The staging Supabase organization is hjfxhwznfgjgywsdsqzn. The existing project named Naql365 was inspected only and was not reused. Project identifiers are public configuration, not credentials. A pre-existing shell access token belonged to another account: it was removed from task subprocess environments before authenticating the correct CLI account. No unrelated project was changed.

## Application variables

`.env.example` contains names only. Keep local values in ignored `.env.local`; Vercel Preview values live in Vercel Environment Variables. Do not pull cloud values over the local configuration.

| Name                                 | Scope  | Staging value/source                                                  |
| ------------------------------------ | ------ | --------------------------------------------------------------------- |
| APP_ENV                              | Server | staging                                                               |
| STAGING_AUTH_SMOKE_ENABLED           | Server | true during the gate; disabled by default                             |
| NEXT_PUBLIC_SUPABASE_URL             | Public | Staging project's HTTPS API origin                                    |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Public | Staging publishable key, never a secret/service-role key              |
| APP_URL                              | Server | Verified deployment origin; omit to derive from VERCEL_URL in staging |

The application rejects a Preview target without APP_ENV=staging, and rejects non-production configuration on the Vercel Production target before compilation. Local defaults remain non-indexable. Never set APP_ENV=production to bypass the staging restriction.

Privileged operator commands use a correctly authenticated Supabase CLI, or SUPABASE_ACCESS_TOKEN in an approved process environment. SUPABASE_DB_PASSWORD is only needed for linking/pushing migrations. Neither credential belongs in Vercel or browser configuration. Test commands require STAGING_SUPABASE_PROJECT_REF and STAGING_SUPABASE_ORG_ID and verify project name, organization and health before accessing it.

## Reconstructing a fresh staging project

1. Use the correct Supabase organization and create a **new empty** project named naql365-staging with PostgreSQL 17. Generate a unique database password in a password manager or process memory. Check project reference and organization before linking. Never reset an existing populated or production database.
2. Run `supabase link --project-ref <verified-staging-ref>` with the database password supplied securely. Then `supabase db push --linked` applies repository migrations in filename order. Do not use migration repair or manually create missing schema to pass the gate.
3. Set the two staging guard variables above, then run `npm run test:staging:db`. It compares remote migration history with the repository, runs the shared RLS assertions in a rollback transaction, and generates public TypeScript definitions from hosted PostgreSQL. Run `npm run typecheck` immediately afterwards and review the generated diff.
4. The shared SQL suite requires an empty business/identity dataset: run it before persistent smoke fixtures. It creates no committed fixture rows. It verifies RLS, cross-tenant FKs, customer/role integrity, quote version/order uniqueness, trip relationships and private storage policies.
5. Compare `supabase config diff --workdir config/staging --project-ref <verified-staging-ref>` before using `config push` with the same arguments. This file declares only hosted Auth security settings; undeclared settings stay unchanged. **Never push the local supabase/config.toml to Staging.**
6. Run `npm run test:staging:services`. This creates three synthetic identities, two fixture organizations and one non-sensitive private object, tests real Auth/REST/Storage and removes the fixtures. The trusted cleanup deletes only this run's generated UUIDs, including its synthetic audit records. These operator privileges are not granted to application clients.

The first reconstruction on 2026-09-09 used all three unchanged Phase 0 migrations and created 37 public tables, all with RLS. Migration hashes and execution evidence are recorded in the phase report. No seed or manual schema patch was used.

## Auth URLs and hosted verification

Phase 1 enables customer self-signup in Staging with confirmation, a twelve-character minimum, secure password change and refresh rotation. Confirmed registration creates no staff privilege; customer membership requires the guarded onboarding transaction. Administrative synthetic identities are used only by the acceptance harness and cleaned afterwards.

The active candidate origin and deployment SHA are recorded in [deployment](deployment.md) and `config/staging/supabase/config.toml`. Supabase Site URL is that exact HTTPS origin. Redirect URLs contain only its AR/EN callbacks and the two locale-specific password recovery destinations. APP_URL derives from VERCEL_URL. Arabic and English login routes are `/ar/login` and `/en/login`; `/login` redirects to Arabic. The callback uses PKCE `exchangeCodeForSession` and allowlisted internal destinations.

The foundation technical email-link action remains gated with `shouldCreateUser: false` and disabled in Production. Phase 1 customer registration/recovery are separate actions. The SSR client stores the PKCE verifier in the browser cookie. Only the configured callback is sent to Supabase; client redirect fields are ignored. Responses do not reveal account existence.

Real Arabic and English email links were followed in the same Chrome profile as initiation. Both reached the localized protected account, survived refresh, signed out and denied account access afterwards. A scoped database read observed an S256 flow before verification and its consumption plus a new session afterwards, without selecting any code/token. The controlled mailbox identity was removed after verification. Password/API tests remain separate evidence.

Keep one reviewed deployment origin active for acceptance. After a replacement Preview is independently READY, update this exact allowlist and retire the previous origin. This explicit rotation is a small operator step that avoids accepting unrelated branches or team-wide wildcard redirects. Never apply the local Auth config to hosted Staging.

## References

- [Supabase CLI configuration](https://supabase.com/docs/reference/cli/supabase-config)
- [Supabase SSR advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide)
- [Supabase sessions](https://supabase.com/docs/guides/auth/sessions)
