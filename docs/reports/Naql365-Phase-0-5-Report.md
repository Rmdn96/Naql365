# Naql365 — Phase 0.5 Staging Gate Closeout

Date: 2026-09-09. Canonical report. Phase 1 remains locked.

## A. Previous State

Previous decision: GO WITH CONDITIONS. Closeout began with a fetch and a clean working tree on `feature/phase-0-5-staging-gate` at the expected commit `9f9b5a84ac4713be79cd990a5cf33adb402fcc2a`. Remote: [Rmdn96/Naql365](https://github.com/Rmdn96/Naql365). [Baseline CI](https://github.com/Rmdn96/Naql365/actions/runs/34362179559) was read back as completed/success for that exact SHA.

Previously accepted gates were Repository, Branch, Staging Supabase, fresh migrations, generated types, RLS, Storage, CI and branch protection. Vercel was blocked; hosted Auth, authorization, browser, accessibility, SEO and security remained incomplete. These prior service/local tests are not represented as new hosted-browser evidence.

## B. Root Cause of Vercel Misclassification

The audit found a concrete client-side mechanism in the installed Vercel CLI 59.13.1: `parseTarget` accepts `--target preview`, but `postDeployment` subsequently assigns `undefined` to that target before serializing the deployment creation request. The API therefore does not receive an explicit Preview constraint from this CLI flag.

The original creation response classified the first deployment as `production`. Vercel's [official domain documentation](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting) states that a new project's first deployment is Production. The observed response is consistent with that provider rule after the client omits the target. Private backend implementation was not available; no unverified internal condition is asserted.

Current API read-back: project naql365-staging (`prj_QYnu3qbPjQWyAcgNDYoDmpH6sN8z`), team naql365, no Git link, no targets, zero deployments, autoAssignCustomDomains enabled, deployment protection enabled. No evidence establishes that merely connecting Git or disabling domain aliases changes first-deployment target classification. Those settings were not changed speculatively.

The [creation API documentation](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment) describes an omitted target as Preview and a `null` response target as Preview; its first-deployment exception is documented separately. No supported route guaranteeing a genuine first Preview deployment for this project was found. A custom label or unaliased Production deployment would not satisfy the task.

Reproduction: inspect Vercel CLI 59.13.1 `dist/chunks/chunk-N6HP5BLI.js`, `postDeployment`, around line 11434, and `dist/chunks/chunk-RN6V5ODW.js`, `parseTarget`. No new deployment was attempted during closeout after identifying this known fallback.

## C. Changes Made

Documentation only: clarified the verified target-omission mechanism, current cloud configuration, exact environment-isolation checks, secure Auth allowlist strategy and unresolved acceptance requirements. The canonical report was updated rather than creating a competing report. No application, dependency, migration, RLS, permission or cloud configuration changes were made during closeout.

## D. Final Preview Deployment

**BLOCKED.** There is no accepted Preview deployment and no Preview URL to report. The previously removed deployment `dpl_2LdRGd4cmXDbVqd9HmJwoV9r2GTS` is not reused or counted as evidence. No new Production deployment, promotion, fake Preview label or bootstrap Production workaround was created.

Required architecture remains: reviewed GitHub feature/develop commit → actual Vercel Preview → Preview environment variables → independent Supabase Staging. The Git integration is not yet connected because automatic creation must not reintroduce the known first-deployment fallback.

## E. Environment Isolation

Current environment inventory was read from Vercel. Development and Production contain zero Naql365 variables. These four records are scoped only to Preview:

| Variable name                        | Exposure    | Environment  | Verification                                                             |
| ------------------------------------ | ----------- | ------------ | ------------------------------------------------------------------------ |
| NEXT_PUBLIC_SUPABASE_URL             | Public      | Preview only | Individual decrypted read-back matches independent Staging origin        |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Public      | Preview only | Exact in-memory comparison with Staging project's publishable key passed |
| APP_ENV                              | Server-only | Preview only | Sensitive record exists; stored value is not returned by API             |
| STAGING_AUTH_SMOKE_ENABLED           | Server-only | Preview only | Sensitive record exists; stored value is not returned by API             |

No values are included here. The list API returned ciphertext for encrypted entries; verification used the [individual variable API](https://vercel.com/docs/rest-api/projects/retrieve-the-decrypted-value-of-an-environment-variable-of-a-project-by-id), with comparisons in memory only. No service-role key, management token or database password is configured in the application. Runtime flag verification awaits Preview.

## F. Supabase Auth Configuration

The independent Staging project `zuvyfeflkzlciuaauxba` remains ACTIVE_HEALTHY, PostgreSQL 17, in the correct Naql365 organization. The pre-existing project was not modified. Hosted config diff reports zero pending changes for declared security settings. Site URL still has the provider's localhost default and redirect allowlist is empty; these are not a valid completed hosted configuration.

Chosen strategy: for each accepted Preview deployment, verify its HTTPS origin and use exactly that origin as APP_URL/Site URL plus its exact `/auth/callback` entry. Retire the previous allowlist entry when replacing the active staging deployment. No team-wide or unrestricted wildcard is needed. This controlled per-deployment rotation is maintainable for the gate and avoids accepting unrelated deployments. It cannot be applied until a genuine Preview origin exists.

## G. Hosted PKCE Evidence

**BLOCKED.** No hosted browser → PKCE callback → session → account journey was executed. The current password-login smoke form does not initiate PKCE; prior password API success is not PKCE proof. Real Arabic and English callback, matching verifier, refresh persistence, logout and denial after logout remain required. No localhost run was substituted.

## H. Hosted Authorization Evidence

**PARTIAL.** Previously accepted real customer JWT/REST/RPC tests proved customer/staff separation, no role from metadata, denied self-promotion, tenant/customer isolation and immediate suspension effects. Foundation source is unchanged at closeout. The hosted protected account shell, suspended-user navigation and server-authoritative route probes still lack a genuine Preview origin and were not retested locally as a substitute.

## I. Hosted RLS Evidence

**PASS retained for the database gate.** The three hosted migration versions were read back during closeout and match the repository: 20260909000100, 20260909000200 and 20260909000300. No SQL or policy changes occurred. Prior hosted shared SQL and real JWT checks covered organization/customer isolation, membership integrity, audit tampering, storage isolation and suspension. The requested unchanged passing tests were not unnecessarily reconstructed again against the shared hosted project. Fresh Linux CI still verifies migrations/RLS/types for the final branch.

## J. Hosted Storage Evidence

**PASS retained for the Storage service; application path BLOCKED.** Prior real service checks verified owner access, peer/other-tenant denial, no public exposure, authorized signing, denial of new signing after suspension, and rejection after 60-second expiry. The complete service run finished with successful fixture cleanup. Neither policies nor application code changed. The hosted application file-redirect route must still be tested from genuine Preview; this report does not equate the prior service check with that missing path.

## K. Browser Smoke Results

**BLOCKED for closeout hosted evidence.** No accepted URL exists for AR/EN public routes, login, PKCE, session, protected shell, logout, suspended membership, storage, desktop or mobile. The existing hosted harness/protocol is prepared but its existence is not PASS. Earlier 18 local E2E passes remain regression evidence only.

## L. Accessibility Results

**PARTIAL.** Earlier local axe, keyboard, focus and viewport checks remain recorded regression evidence. Hosted `/ar`, `/en`, Arabic/English login and authenticated account labels, landmarks, contrast and keyboard/RTL/LTR checks are outstanding. No new hosted axe result is claimed.

## M. SEO Results

**PARTIAL.** The unchanged foundation includes locale-aware titles/metadata, canonical/hreflang, structured data and non-production noindex/robots/empty-sitemap protections. Real HTTPS output and structured data have not been verified on Preview. Local output is not accepted as hosted evidence.

## N. Security Results

**PARTIAL.** Closeout verified Preview-only environment scopes and exact Staging public-key/origin isolation without reporting values. App/migration/dependency/security source is unchanged. Deployment protection remains enabled, and the existing guard rejects non-production app configuration on Vercel Production before compilation. No production data or configuration was modified.

Hosted CSP, security headers, cookie/refresh behavior, browser assets/source exposure, callback redirects, private-file application access and runtime logs remain unverified. No secret exposure or failed RLS result was observed during this read-only closeout; absence of a hosted application prevents a complete security PASS.

## O. Regression Test Results

No code or infrastructure fix was applied, so the previously accepted 52 unit/integration tests, 18 E2E tests, build, generated types and hosted service assertions were not repeated merely to substitute for hosted evidence. After the documentation changes, the branch CI runs the complete existing quality gate: install, formatting, secret scan, lint, typecheck, unit/integration, build, E2E, full Supabase migration reconstruction/RLS and generated types. No check is skipped or changed to continue-on-error.

## P. CI Result

The exact starting SHA's CI is PASS: [34362179559](https://github.com/Rmdn96/Naql365/actions/runs/34362179559). Final documentation commit CI is verified before delivery; the final delivery records its exact SHA and run URL. No prior green run will be described as the new commit's result.

## Q. Test Data Cleanup

Closeout created no users, organizations, files or business data and required no fixture deletion. The last completed service run removed its identities/objects/organizations; required catalogues/schema were retained. No Production data was touched.

## R. Files Changed

- docs/deployment.md
- docs/staging.md
- docs/staging-smoke-test.md
- docs/reports/Naql365-Phase-0-5-Report.md

No source, migration, dependency, workflow, environment-example or security-policy files changed during closeout.

## S. Commits

Continue on `feature/phase-0-5-staging-gate` from `9f9b5a84ac4713be79cd990a5cf33adb402fcc2a`. Closeout documentation is committed and pushed on this branch. Final HEAD/CI and clean working-tree state are supplied with delivery. No merge to develop/main was performed.

## T. Final Acceptance Matrix

Previously passing foundation/service gates are retained only where the closeout confirmed unchanged source/state. Hosted closeout requirements remain explicit; no PARTIAL/BLOCKED entry is relabeled PASS to close the gate.

| Gate              | Result  | Evidence                                                                                |
| ----------------- | ------- | --------------------------------------------------------------------------------------- |
| Repository        | PASS    | Fetch, correct baseline/remote, clean initial tree                                      |
| Branch            | PASS    | Correct feature branch, safe continuation                                               |
| Staging Vercel    | BLOCKED | Live API: zero deployments; confirmed first-deployment target mechanism                 |
| Staging Supabase  | PASS    | Correct independent project, ACTIVE_HEALTHY, no config drift                            |
| Fresh migrations  | PASS    | Matching hosted migration history; unchanged SQL; prior fresh reconstruction retained   |
| Generated types   | PASS    | Unchanged generated types; exact baseline CI passed; final CI checks regeneration       |
| Auth              | PARTIAL | Prior API verification retained; hosted PKCE/session/URL gates blocked                  |
| Authorization     | PARTIAL | Prior real JWT/RLS checks retained; hosted shells blocked                               |
| RLS               | PASS    | Unchanged verified policies/migrations; prior hosted assertions retained                |
| Storage           | PASS    | Prior real service isolation/expiry retained; hosted application route outstanding      |
| Browser smoke     | BLOCKED | No genuine Preview URL; no localhost substitution                                       |
| Accessibility     | PARTIAL | Prior local evidence only; hosted checks outstanding                                    |
| SEO               | PARTIAL | Source foundation unchanged; hosted output outstanding                                  |
| Security          | PARTIAL | Current environment isolation verified; hosted runtime/bundle/cookie checks outstanding |
| CI                | PASS    | Verified baseline; final closeout run recorded at delivery                              |
| Branch protection | PASS    | Fresh API read-back: PR/checks/admin enforcement, no force pushes on main/develop       |

## U. Final Decision

**GO WITH CONDITIONS**

Phase 0.5 is **not closed** and Phase 1 remains locked. The unresolved external prerequisite is a Vercel-supported first deployment that is genuinely Preview, without any Production bootstrap or label workaround. Once that path is available, configure the exact Auth URLs and execute every hosted gate above. No Phase 1 implementation was started.

Owner action: obtain confirmation from Vercel for project naql365-staging that a first deployment can be provisioned as Preview (API response target null / dashboard Preview) without creating Production. Provide the original removed deployment ID and explain that the installed CLI strips the Preview target. No support message was sent without authorization. The current prohibition on Production remains unchanged.
