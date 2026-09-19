# Staging architecture and reconstruction

Phase 0.5 verified the foundation; Phase 1 added customer identity and request intake, Phase 2 pricing and quote acceptance, and Phase 3 multi-Trip dispatch and private POD. Phase 3.5 extends this same isolated Staging environment with Saudi and Egyptian markets. Each canonical phase report preserves its historical acceptance evidence. Phase 4 adds Internal Driver execution and Phase 5 adds foreground tracking and owned in-app notifications. Payments and Production remain excluded.

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

## Phase 3 rollout gate

The accepted Phase 3 baseline contained thirteen migrations and 49 public tables with RLS. Its canonical report preserves the accepted Preview and tests; protected PR #4 subsequently merged it into develop. Phase 3.5 adds six migrations, bringing Staging to nineteen migrations and 54 public tables with RLS. Run both-market Phase 3 journeys, Phase 2, intake and foundation suites sequentially on the current Phase 3.5 Preview. Finish with scoped data/file/session cleanup and automation-bypass revocation. Historical Preview results do not substitute for current acceptance.

## Phase 2 verification

Use the canonical Phase 2 report for the accepted application source and Preview origin. The operator runs guarded Phase 2, intake and Foundation browser suites sequentially against that same origin, followed by repository migration/RLS verification and regenerated types. Test catalogues are synthetic Staging configuration; they do not approve Production tariffs. Preserve required role/permission/catalogue data during scoped fixture cleanup. Revoke the temporary automation-bypass credential only after all hosted tests finish.

## Phase 3.5 Staging setup

After current-source CI passes, apply repository migrations only to the explicitly allowlisted `naql365-staging` Supabase project. Existing accepted Staging data is upgraded; do not reset it. A fresh local/CI database is reconstructed separately.

For a fresh controlled Staging catalogue, run intake configuration first, then `node scripts/staging/configure-markets.mjs --apply`, then `npm run staging:configure-pricing`. These commands verify the Staging project and require its enrollment organization. Market provisioning adds initial geography; the Staging-only step explicitly activates SA/EG service/city pairs. Pricing/tax fixtures are synthetic: SA 1500 bps, EG 2000 bps, 19 rules per market. They are neither approved tariffs nor a legal tax compliance claim.

Deploy the tested branch as a protected Vercel Preview. Preview variables remain `APP_ENV`, `STAGING_AUTH_SMOKE_ENABLED`, `NEXT_PUBLIC_SUPABASE_URL`, and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, all Preview-scoped; no Production scope is required. Configure Supabase Auth to the exact candidate origin and the four bounded AR/EN callback URLs in `config/staging/supabase/config.toml`. No redirect wildcard is needed. The canonical Phase 3.5 report identifies the final accepted candidate and any remaining gates.

## Phase 4 staging continuation

Phase 4 adds six migrations to the accepted nineteen, for twenty-five total. Apply them through the same allowlisted Staging-only workflow after CI passes. Do not reset the hosted database. Fresh reconstruction and populated upgrade are separate CI/integration gates. No extra application secret or Production environment scope is needed.

Use the candidate URL and acceptance status from `docs/reports/Naql365-Phase-4-Report.md`. Keep the exact callback allowlist synchronized with `config/staging/supabase/config.toml`. Driver account provisioning follows `docs/driver-execution.md`; EXTERNAL resources remain unlinked and non-authenticated. The execution and session suites use disposable synthetic accounts and retain the intended Market/catalogue configuration during cleanup.

## Phase 5 tracking setup

After the complete local/CI gate passes, apply the two additive tracking migrations through the guarded Staging migration workflow. Verify twenty-seven migrations, official generated types and all public-table RLS checks. The Realtime publication contains only latest Trip location and notifications, with INSERT/UPDATE and per-event RLS; private sample history is never published.

Run `node scripts/staging/configure-tracking.mjs --apply` with the approved Staging guard variables. It sets a 24-hour Staging retention policy, installs pg_cron if necessary and schedules `private.prune_tracking_history()` every ten minutes. The function removes at most 10,000 expired samples per invocation; publication also enforces a per-Trip cap. Production retention remains unconfigured. Inspect cron execution metadata without logging location data.

Deploy with the supported Vercel Preview target after CI, independently verify target/source/READY and protection, then update only the exact Staging Auth origin/callback allowlist. No map or routing API credentials are needed for the disclosed OpenStreetMap raster viewport; ETA is explicitly unavailable. See the canonical Phase 5 report for the accepted Preview and executed evidence.

Run `node scripts/staging/verify-phase5.mjs` against that verified protected origin using a temporary automation credential held only in the process environment. Do not overlap fixture runners. It exercises the complete SA/EG Driver journeys with real browser GPS and actual Supabase Realtime subscriptions. Run foundation/intake/commercial/Operations regressions serially on the same Preview. Cleanup must remove synthetic identities, operational/commercial data, files, latest locations, private samples/sessions and owned notifications; retain intended catalogues and retention configuration. Revoke the temporary Preview automation credential last.
