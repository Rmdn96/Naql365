# Naql365 — Phase 0.5 Staging Gate

Date: 2026-09-09. Scope: foundation verification only.

## A. Repository State

Repository: [Rmdn96/Naql365](https://github.com/Rmdn96/Naql365). The initial working tree was clean at Phase 0 baseline `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`, on feature/phase-0-foundation. The audit covered branches/remotes, lockfile/package manager, workflows, environment examples, Supabase config, migrations, Next configuration, source, tests and docs. There were 80 tracked files, three migrations and an existing tested foundation. No foundation rewrite or dependency upgrade was needed. npm remains the package manager.

## B. Branch

Work branch: `feature/phase-0-5-staging-gate`, created from develop at the verified Phase 0 baseline. main and develop did not previously exist; both were created at the baseline and pushed before enabling protection. All new implementation commits are on the feature branch. No merge occurred. The branch has been pushed to origin.

Logical implementation commits:

- `059b05e` — gated technical Auth surfaces and staging deployment safeguards.
- `7b8be80902ef98200533087f96915b6354de945c` — hosted database/types/Auth/Storage verification and browser harness.

Documentation/verification follow-up commits are on the same branch. The final delivery message identifies the final HEAD and its CI run; a report cannot embed its own future commit hash.

## C. Changes

- Added environment/target validation and staging-only login/logout, session-status and signed-file probes.
- Added exact-origin checking for technical Auth actions, secure HTTPS session cookie settings and logout on forbidden shells.
- Added non-production noindex headers/metadata, robots exclusion and empty sitemap; `/login` redirects to Arabic.
- Added guarded hosted migration/type and Auth/REST/Storage scripts, separate hosted browser configuration and secret-safe reporter.
- Generated database types from hosted PostgreSQL. Migration SQL and dependency versions are unchanged.
- Added `config/staging/supabase/config.toml`, separate from local Supabase configuration.
- Added staging, deployment and smoke-test documentation; updated security documentation and ignored nested Supabase CLI caches.

No request wizard, Smart Quote, pricing, order/driver workflow, dispatch, GPS, payment gateway, automation, AI, marketplace or billing was implemented.

## D. Staging Architecture

Independent Supabase project plus a dedicated Vercel project with Preview-scoped variables. Local Supabase and existing Naql365 project credentials are not reused. The app requires only the staging API origin and publishable key; privileged operator credentials never enter application configuration. See [staging setup](../staging.md).

## E. Vercel Deployment

**BLOCKED.** Team naql365; project naql365-staging (`prj_QYnu3qbPjQWyAcgNDYoDmpH6sN8z`). Next.js/Node 24, `npm ci`, `npm run build`, Preview-only APP_ENV, smoke flag and Supabase public variables are configured. Deployment protection remains enabled.

The initial CLI request explicitly specified `--target preview`, but Vercel returned Production for its first deployment. Build succeeded; deployment `dpl_2LdRGd4cmXDbVqd9HmJwoV9r2GTS` was removed immediately. A subsequent API inspection showed zero deployments. No Supabase credentials were attached to that attempt, and no production database or business data was modified. The attempted Production classification is disclosed rather than described as a passing Staging deployment.

Vercel's [official documentation](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting) confirms first deployments are Production. No repeated attempt, bootstrap Production deployment or promotion was performed. A new application guard rejects non-production configuration on that target before compilation. A supported Preview-only provisioning path remains required.

## F. Supabase Staging

**PASS.** Created a new independent healthy project:

- Name: naql365-staging.
- Reference: `zuvyfeflkzlciuaauxba`.
- Organization: `hjfxhwznfgjgywsdsqzn`.
- Region: eu-central-1.
- PostgreSQL: 17.

The pre-existing Naql365 project was left unchanged. Three controlled `example.test` identities and non-sensitive fixtures were created solely for testing and removed. Final counts: organizations 0, profiles 0, customers 0, file registry 0, stored objects 0. The 63 remaining audit entries are legitimate migration-created catalogue records: 8 roles, 17 permissions and 38 role-permission links.

## G. Migration Reconstruction

**PASS.** Standard Supabase CLI project creation → link → `db push --linked` applied all migrations to the fresh database. No migration repair, SQL workaround, schema patch or business seed was required. Remote migration history matched repository filenames. All 37 public tables have RLS. The existing shared SQL assertions passed against hosted PostgreSQL, then types were generated from the same project and TypeScript validation passed.

| Migration                                 | SHA-256                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- |
| 20260909000100_identity_and_domain.sql    | 2d56c2730a089a92bf604414833a580a1ad9fd7b65dc8c7526484a677bd2e9fe |
| 20260909000200_private_storage.sql        | 430c5f82d25ee8a4380cc7cd8250940bbf3387d074bfa334294d6bd1cc45f97c |
| 20260909000300_role_integrity_indexes.sql | 3caa0956772206ffb8e9ff407eae77d83d7beae186b80bee0cfebc7c0b5a5848 |

## H. Auth Verification

**PARTIAL.** Real Supabase API tests passed password login and server-verified identity for three synthetic users, session refresh, sign-out, and rejection of the revoked refresh token. Staging settings now disable self-signup, require 12-character passwords and secure password changes; refresh rotation and email confirmations remain enabled. Config diff reports zero declared-setting updates outstanding.

Site URL still has the provider's localhost default and the redirect list is empty because there is no accepted Preview origin. Actual browser SSR cookies, callback exchange, PKCE, authenticated account navigation and logout through the hosted application remain BLOCKED. Direct password API tests do not prove those requirements.

## I. Authorization Verification

**PARTIAL overall; database/API checks PASS.** A real customer JWT gained account.access and was denied portal.access. Supplied SUPER_ADMIN metadata assigned no roles. Membership self-promotion failed. Suspending membership denied permissions, customer records and file access with the same existing session and after refresh. Server-side application authorization has passing unit tests; its hosted browser path remains unverified.

## J. RLS Verification

**PASS on hosted PostgreSQL and REST.** Shared SQL assertions and real authenticated calls verified organization isolation, same-organization customer isolation, cross-tenant denial, membership integrity, role restrictions, audit forgery denial, private storage isolation and suspension. Relational assertions also verified composite FKs, quote/order uniqueness and trip-stop relationships. SQL fixtures rolled back. No permissive policy was introduced.

## K. Storage Verification

**PASS for hosted Storage service.** Authorized owner download passed; same-tenant peer, other tenant, public URL access and unauthorized signing were denied. A 60-second signed URL worked before expiry and failed after expiry. Suspension immediately blocked direct authenticated download and new signing. Existing signed URLs remain bearer capabilities until expiry; this is documented. The object was removed afterwards. The application's signed-file redirect route still requires hosted browser verification.

The first service-test run passed security assertions but its cleanup command failed. Only the recorded fixture scope was cleaned through trusted administration, then the complete service suite was rerun with exit 0, including all cleanup steps. No failing security assertion was bypassed. Cleanup failures now report non-secret fixture UUIDs for precise recovery.

## L. Browser Smoke Tests

**PARTIAL.** Local production-build desktop/mobile suite: 18/18 PASS. Covers Arabic default, English switching, routing, shell denial without configuration, callback redirect rejection, noindex/robots/sitemap, responsive pages and keyboard dialog behavior. The dedicated hosted browser suite is implemented and typechecked but has not run against an accepted Staging deployment.

## M. Accessibility

**PARTIAL.** Local axe checks on AR/EN homepages and design-system/dialog states passed, along with keyboard/focus and viewport checks. Hosted AR/EN/login/authorized-shell accessibility is not proven. The hosted suite includes axe checks; Arabic login and suspended-shell checks remain in the explicit acceptance protocol.

## N. SEO

**PARTIAL.** Local tests passed canonical routing, language behavior, noindex metadata/header, robots Disallow `/` and empty sitemap. Source includes locale-aware metadata and hreflang. Actual hosted canonical, language alternates, titles, crawler rules and internal-page indexing require the final Preview origin.

## O. Security

**PARTIAL overall.** No app service-role key, hardcoded role email, public sensitive bucket, client-only authorization or relaxed RLS was added. Secret-pattern checks and staged diff review found no credentials. Vercel Preview contains only public Supabase values and non-secret environment flags. Local auth/session fixtures keep credentials in memory and suppress sensitive diagnostics. All cloud test identities/objects were removed.

Live hosted browser bundle, cookie, CSP and runtime-log verification remains pending. Supabase SSR cookie flags and server-only boundaries are implemented but are not represented as completed hosted checks. No production data was modified. The removed first Vercel Production-classified attempt is the deployment exception described in section E.

## P. CI

**PASS.** [CI run 34361752493](https://github.com/Rmdn96/Naql365/actions/runs/34361752493) completed successfully for `975f950c3c48f8c1625491d781bbead2434d1ae0`. Both required jobs passed: `Lint, types, tests and production build` and `Supabase migrations and RLS`. This includes install, formatting, secret checks, lint, typecheck, 52 unit/integration tests, production build, 18 desktop/mobile E2E tests, full Supabase reconstruction/RLS, generated types and subsequent typechecking.

The initial Phase 0.5 CI run `34361114506` passed its database job but failed formatting because nested CLI cache JSON had been accidentally tracked. The job log identified `config/staging/supabase/.temp/linked-project.json`. Those non-secret cache files were removed from Git and the ignore rule broadened. No error was ignored. Local checks also passed; historical secret-pattern scanning covered 12 commits with no findings. An actual negative build check confirmed the Vercel Production/Staging mismatch aborts before compilation. Hosted services were rerun after final Auth settings, with exit 0 and successful cleanup. The subsequent report-only commit does not change the validated implementation; its own CI is checked in the final delivery.

## Q. Branch Protection

**PASS.** GitHub REST read-back returned HTTP 200 for main and develop, with strict required CI checks, PR and one approval, stale-review dismissal, last-push approval, admin enforcement, conversation resolution, linear history, disabled force pushes and disabled branch deletion. No permission limitation prevented configuration. No merge was executed.

## R. Known Limitations

- No accepted Vercel Preview origin; therefore no complete hosted browser/PKCE/SSR/accessibility/SEO/security evidence.
- Supabase Site URL/callback allowlist awaits that origin; current loopback default is not accepted as hosted configuration.
- The hosted browser harness is prepared but unexecuted; its existence is not counted as PASS.
- Local Docker was unavailable; full Supabase PostgreSQL reconstruction is exercised by Linux CI and by the independent hosted Staging project.
- No persistent smoke identities remain. A future browser run needs a newly provisioned controlled customer fixture and exact cleanup.
- A separate reviewer is needed to satisfy branch protections before merging.

## S. Blockers and owner actions

1. Obtain a Vercel-supported first deployment that is genuinely Preview for project naql365-staging. The existing prohibition on Production remains in force; no exception is assumed.
2. Configure the resulting exact HTTPS Site URL and `/auth/callback` allowlist in Supabase, aligned with APP_URL.
3. Run hosted browser desktop/mobile, real PKCE, cookie/session/logout, suspended-route, application storage, accessibility, SEO, bundle and log checks from [the smoke protocol](../staging-smoke-test.md). Attach sanitized evidence to this report and rerun CI for the reviewed SHA.

## T. Final Decision

**GO WITH CONDITIONS.** The reconstructed database, RLS, real Auth/Storage service tests and tested source foundation support continuing the **remaining Phase 0.5 verification**. The external Preview provisioning blocker prevents full gate acceptance. This is **not GO FOR PHASE 1**. Do not start Phase 1 until all critical hosted application gates have execution evidence and the report is updated.

| Gate              | Result  | Evidence                                                                                      |
| ----------------- | ------- | --------------------------------------------------------------------------------------------- |
| Repository        | PASS    | Clean audited Phase 0 baseline 184ac237                                                       |
| Branch            | PASS    | feature/phase-0-5-staging-gate from develop; pushed                                           |
| Staging Vercel    | BLOCKED | Project/Preview env configured; first Production-classified attempt deleted; zero deployments |
| Staging Supabase  | PASS    | New healthy zuvyfeflkzlciuaauxba; separate from existing project                              |
| Fresh migrations  | PASS    | Three original migrations, matching history, 37 RLS tables                                    |
| Generated types   | PASS    | Generated from hosted public schema; typecheck passed                                         |
| Auth              | PARTIAL | Real API login/refresh/logout passed; browser/PKCE/URLs blocked                               |
| Authorization     | PARTIAL | Real JWT/RPC denial and suspension passed; hosted shell pending                               |
| RLS               | PASS    | Hosted shared SQL assertions plus authenticated REST isolation                                |
| Storage           | PASS    | Real private object isolation, signing, expiry, suspension, cleanup                           |
| Browser smoke     | PARTIAL | 18 local passes; hosted suite blocked                                                         |
| Accessibility     | PARTIAL | Local AR/EN axe/keyboard passed; hosted login/account pending                                 |
| SEO               | PARTIAL | Local metadata/robots/noindex passed; real origin pending                                     |
| Security          | PARTIAL | DB/API/storage review passed; hosted bundle/cookie/CSP/log checks pending                     |
| CI                | PASS    | Run 34361752493 on 975f950: both required jobs passed                                         |
| Branch protection | PASS    | main/develop protections configured and read back                                             |
