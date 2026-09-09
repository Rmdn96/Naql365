# Naql365 — Phase 0.5 Final Closeout Report

Date: 2026-09-09. Canonical report. This final closeout supersedes the earlier GO WITH CONDITIONS assessment preserved in Git at 563baeb. Phase 1 implementation has not started.

## A. Starting State

Fetched origin before changes. Branch was `feature/phase-0-5-staging-gate`, HEAD `563baeb00bbb927fffcdf5a5397dde601b47fb8b`, working tree clean. Remote: [Rmdn96/Naql365](https://github.com/Rmdn96/Naql365). The expected baseline and its [successful CI](https://github.com/Rmdn96/Naql365/actions/runs/34366815108) were verified. Supabase/migrations/RLS/storage and branch protection already had accepted foundation evidence; genuine Preview and hosted acceptance were outstanding.

## B. Verified Vercel Root Cause

Installed Vercel CLI 59.13.1 accepts `--target preview` but `postDeployment` removes that target before serializing the creation request. The new project's first deployment was then classified Production by Vercel. This matches the provider's documented first-deployment rule; no private backend mechanism is guessed. Changing labels or retaining the failed first app deployment was not used as Preview proof.

The owner explicitly revised the restriction for one minimum infrastructure bootstrap. The original failed deployment loop was not repeated.

## C. Supported Bootstrap Method Used

Used the official staged-production command `vercel deploy --prebuilt --prod --skip-domain --yes --scope naql365` from an isolated directory outside the application repository. Its Build Output API package was 372 bytes: static 404/noindex/no-store content, restrictive CSP, no functions, no Next.js app, no credentials and no database connection. No application guard was weakened and no Production-scoped variable was added.

References: [staged deployments](https://vercel.com/docs/cli/deploying-from-cli), [Build Output API](https://vercel.com/docs/build-output-api/configuration), [deployment target semantics](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment).

## D. Bootstrap Deployment Result

One bootstrap was created: `dpl_A9tbFm4qjbwJbRR8CmzK6oXcvWqY`, READY, classified Production. It was infrastructure bootstrap only, never a Naql365 release or Staging acceptance evidence. Vercel assigned the derived alias `naql365-staging-naql365.vercel.app` despite `--skip-domain`; no custom production domain was attached. Unauthenticated requests encountered Deployment Protection.

After two genuine Preview deployments existed and the project had a Preview target, the bootstrap was removed through Vercel CLI. API read-back showed only the two READY Preview deployments. No Production database, business data, payment or messaging resource was introduced or modified. No intended production traffic was directed to it.

## E. Genuine Preview Evidence

Accepted Preview: [naql365-staging-lc8qnrb3y-naql365.vercel.app](https://naql365-staging-lc8qnrb3y-naql365.vercel.app).

- Project: naql365-staging, `prj_QYnu3qbPjQWyAcgNDYoDmpH6sN8z`, team naql365.
- Deployment: `dpl_F1v9VXeVjoZswHi6deeU7p6Uu3y1`.
- Independent API classification: `target: null` (Preview), `readyState: READY`.
- Git metadata: `feature/phase-0-5-staging-gate`, `d3c834b6be4b048a98e3739dbfdf5f6a883e1b75`.
- Later changes concern test tooling, hosted Auth URL configuration and documentation; deployed application source/dependencies are unchanged.

The preceding genuine Preview `dpl_Hfa3XwqPUJ2P9dBu6adRHM21yUfd` proved the bootstrap path worked. Final hosted evidence below uses the accepted origin above. The workflow is an operator-controlled CLI deployment of the GitHub branch; automatic Git deployment is not connected. No promotion or merge was performed.

## F. Environment Isolation

Fresh API read-back verified the Preview URL points to independent Supabase Staging, and its publishable key exactly matches that project's key in memory. No secret values are recorded.

| Variable                             | Exposure                                    | Scope                                                           |
| ------------------------------------ | ------------------------------------------- | --------------------------------------------------------------- |
| NEXT_PUBLIC_SUPABASE_URL             | Public                                      | Preview only                                                    |
| NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY | Public                                      | Preview only                                                    |
| APP_ENV                              | Server-only                                 | Preview only                                                    |
| STAGING_AUTH_SMOKE_ENABLED           | Server-only                                 | Preview only                                                    |
| APP_URL                              | Server-only                                 | Derived from VERCEL_URL in Staging; no stored override          |
| VERCEL_AUTOMATION_BYPASS_SECRET      | Privileged test-process/platform credential | Controlled automation only; never a public application variable |

Development and Production have zero Naql365 application variables. No service-role key, database password or Supabase management token is installed in the app. The independent Staging project is `zuvyfeflkzlciuaauxba`, in the Naql365 organization, ACTIVE_HEALTHY. The existing other Naql365 project was not reused.

## G. Supabase Auth URLs

Site URL is the exact accepted Preview origin. Redirect allowlist contains only its `/auth/callback?locale=ar` and `/auth/callback?locale=en` entries. The previous origin was removed. Server callbacks derive from the trusted deployment origin and use the internal redirect allowlist; no unrestricted wildcard or client-selected external destination is allowed.

The maintainable initial strategy is explicit per-deployment rotation: verify READY/Preview, update the small hosted config, diff/push, then test that exact origin. Hosted config diff returned zero pending updates to declared settings. Nine provider-only defaults remained unchanged. Local Supabase config was never pushed to hosted Staging.

## H. Hosted PKCE

PASS. The technical email-link action uses the SSR client and `shouldCreateUser: false`; it stores the verifier and selects the locale callback on the server. It is gated off in Production and does not reveal account existence.

A mailbox explicitly designated by the operator was used for a temporary Staging customer identity. Real Supabase emails were opened in the same Chrome profile that initiated the flow. Verification links were checked in memory for the exact Staging host/callback and followed without printing their values.

Arabic reached `/ar/account`; English reached `/en/account`. Both displayed the protected customer shell and retained it after reload. A scoped SQL aggregate observed one S256 flow, zero sessions and no prior sign-in before the first link; after completion it observed zero pending S256 flows and one signed-in session. No code/token was selected for evidence. These were actual `exchangeCodeForSession` callbacks, not mocked responses or password-login substitutes.

## I. Hosted Authentication

PASS. Automated real password login works on Preview. Actual AR/EN PKCE, session establishment, page refresh, logout and denial after logout were separately observed. The session probe returns authorized only for a valid permitted user. Secure/SameSite=Lax cookies were verified over HTTPS. Service tests verified refresh and rejection of a signed-out refresh token.

## J. Hosted Authorization

PASS. The browser's real customer JWT cannot gain staff access, edit its membership type, read another organization or customer, or forge audit records. Synthetic SUPER_ADMIN user metadata grants no role. The mailbox address does not assign permissions; membership and role rows do.

In the final serialized desktop and mobile runs, the suspension probe explicitly returned Auth identity HTTP 200 and database permission denied. The account rendered the forbidden shell, the session endpoint returned 403, and new private-file access failed. Restoring/removing only the fixture completed normally. No client-only permission check or weakened policy was introduced.

## K. RLS and Migration Reconstruction

PASS. The three unchanged repository migrations match hosted history and hashes:

| Migration                                 | SHA-256                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- |
| 20260909000100_identity_and_domain.sql    | 2d56c2730a089a92bf604414833a580a1ad9fd7b65dc8c7526484a677bd2e9fe |
| 20260909000200_private_storage.sql        | 430c5f82d25ee8a4380cc7cd8250940bbf3387d074bfa334294d6bd1cc45f97c |
| 20260909000300_role_integrity_indexes.sql | 3caa0956772206ffb8e9ff407eae77d83d7beae186b80bee0cfebc7c0b5a5848 |

Hosted shared SQL assertions passed again after browser acceptance. All 37 public tables have RLS. Generated hosted types typecheck and produce no schema diff. The earlier fresh hosted reconstruction remains valid; final Linux CI also reconstructs from an empty Supabase instance, verifies RLS and regenerates types. No migration repair, manual schema patch or permissive policy was used.

## L. Storage

PASS. Harmless private PDF fixtures verified owner download, same-tenant peer denial, cross-tenant denial, no direct public exposure, authorized signing, unauthorized signing denial and expiry. The real hosted application file route was tested from the browser. Its 60-second signed URL worked initially and failed after 65 seconds. Suspension immediately denied authenticated reads and new signing. All uploaded fixtures were removed.

Existing signed URLs are bounded bearer capabilities until expiry; suspension does not revoke a previously issued URL before that expiry. This is documented service behavior, not an RLS bypass.

## M. Hosted Browser Tests

PASS: **12/12** in the final complete serialized run, six each on desktop and mobile Chromium. Coverage: AR/EN pages, login/root routing, robots/sitemap, real password session, refresh, account/staff denial, logout, post-logout denial, live suspension, private storage, browser assets and responsive behavior. Real email PKCE was additionally executed in Chrome in both locales on this same deployment.

Earlier diagnostic runs were not accepted: a browser fetch of provider-injected Vercel tooling was correctly denied by CSP; a vendor string literal caused a naive source-map check to report a false positive. The harness now inspects every DOM-observed script in Node and lexically checks actual comment directives, with regression tests. No assets or security assertions are skipped.

One overlapping run redirected a suspended customer to login instead of the expected forbidden shell. It granted no protected access but was not accepted. Provider throttling is a possible explanation, not a verified root cause. Hosted suites now hold an exclusive checkout lock and run sequentially. The final single run retained a valid Auth identity and passed every original authorization assertion on both viewports. No provider rate limit was relaxed.

## N. Accessibility

PASS. Hosted axe checks found no WCAG A/AA violations on AR/EN homepages, login and protected account shells across desktop/mobile. Semantic landmarks/headings, input labels, keyboard focus and RTL/LTR were checked. Page reloads and localized login/logout were exercised in the real browser.

## O. SEO

PASS. Hosted titles, locale metadata, canonical and Arabic/English alternates match the accepted origin. JSON-LD foundation is present. Non-production responses carry noindex protection, robots disallows all paths, and sitemap has no indexed URLs. Internal shells remain non-indexable. Staging is not presented as a production search property.

## P. Security

PASS for the requested smoke scope. CSP, headers, private/no-store boundaries, safe redirects, cookie flags and server-authoritative access were verified. Application assets and provider-injected scripts were inspected without sending privileged test values into the browser or forwarding the protection credential to third parties. No privileged fixture credential or actual source-map directive was found.

A bounded 1,000-record Vercel Preview log audit found zero error-level records, no secret/session-token patterns and no Auth query values; it included 18 callback records. Application code does not log provider responses, credentials or signed URLs. The tracked-file secret scan and diff review passed. These are bounded verification results, not an exhaustive penetration-test claim.

Preview toolbar was disabled using the supported project setting. Existing deployment injection may remain; CSP was not widened. Deployment Protection remains enabled. No Production data was accessed or changed.

## Q. Regression Tests

PASS: formatting, secret scan, lint, strict typecheck, **60 Unit/Integration tests**, production build and **18 local E2E tests**. Hosted migration/RLS/type verification and real Auth/Storage service tests passed again after browser acceptance. CI reconstructs fresh Supabase and runs both mandatory jobs without ignored failures.

An intermediate CI run failed formatting of a test method chain. The formatting was corrected and the subsequent full CI passed. No dependency, lint rule, TypeScript rule, RLS policy or required CI check was disabled to pass.

## R. CI and Branch Protection

Verified full code/test revision: `8746b1d579907930e61ba71eee4143f8818c701c`, [CI run 34373158208](https://github.com/Rmdn96/Naql365/actions/runs/34373158208), completed/success for both required jobs. The final documentation commit's exact HEAD and CI run are checked and supplied in delivery; this report's enclosing commit can be resolved with Git without embedding a recursive self-hash.

Fresh GitHub API read-back confirmed main/develop require PR review, strict current CI, administrator enforcement and disabled force pushes. No merge occurred. No permissions/setup blocker remains.

## S. Cleanup

The controlled mailbox identity, synthetic Auth users, profiles, organizations, customers, file registry rows and storage objects were removed. Read-back showed zero rows in each of those fixture categories. Required catalogues remain: 8 roles, 17 permissions and 63 catalogue audit records. Schema and private buckets remain intact.

The single bootstrap deployment was removed only after two READY Previews existed. Both Preview deployments remain; the accepted Preview was never removed. Temporary project automation bypass credentials are revoked after acceptance; subsequent automation must obtain a new authorized credential securely. No credentials appear in this report or Git.

## T. Final Acceptance Matrix

| Gate              | Result | Evidence                                                                 |
| ----------------- | ------ | ------------------------------------------------------------------------ |
| Repository        | PASS   | Fetched expected remote/baseline; reviewed scoped diff                   |
| Branch            | PASS   | Continued feature/phase-0-5-staging-gate; logical commits, no merge      |
| Staging Vercel    | PASS   | Independent READY/target null API result; actual Preview URL             |
| Staging Supabase  | PASS   | Independent healthy staging project, isolated configuration              |
| Fresh migrations  | PASS   | Fresh hosted baseline; current history/hash verification; fresh Linux CI |
| Generated types   | PASS   | Regenerated from hosted schema, no diff, strict typecheck                |
| Auth              | PASS   | Real AR/EN email PKCE, password login, refresh, logout                   |
| Authorization     | PASS   | Valid identity plus denied suspended permission/routes; no escalation    |
| RLS               | PASS   | 37/37 tables; shared SQL and real browser/JWT isolation                  |
| Storage           | PASS   | Hosted owner/peer/public/expiry/suspension tests and cleanup             |
| Browser smoke     | PASS   | Final complete 12/12 desktop/mobile plus real Chrome PKCE                |
| Accessibility     | PASS   | Hosted axe, labels/landmarks/focus, RTL/LTR                              |
| SEO               | PASS   | Hosted metadata/canonical/hreflang/JSON-LD/noindex/robots/sitemap        |
| Security          | PASS   | Environment isolation, CSP/cookies/redirects/assets/log audit            |
| CI                | PASS   | Both mandatory jobs successful; final delivery verifies exact HEAD       |
| Branch protection | PASS   | Fresh API read-back on main/develop                                      |

## U. Files Changed

- config/staging/supabase/config.toml
- docs/deployment.md
- docs/staging.md
- docs/staging-smoke-test.md
- docs/security.md
- docs/reports/Naql365-Phase-0-5-Report.md
- package.json
- scripts/staging/exclusive-run.mjs
- scripts/staging/verify-browser.mjs
- scripts/staging/verify-database.mjs
- scripts/staging/verify-services.mjs
- src/app/auth/actions.ts
- src/components/auth/smoke-login-form.tsx
- src/i18n/dictionaries.ts
- tests/helpers/source-map.ts
- tests/staging/auth.spec.ts
- tests/staging/public.spec.ts
- tests/staging/safe-reporter.ts
- tests/staging/security.spec.ts
- tests/unit/source-map.test.ts
- tests/unit/staging-pkce.test.ts

No migration, business workflow, production resource, dependency version or lockfile was changed.

## V. Commits and Operational Limits

| Commit  | Change                                                                           |
| ------- | -------------------------------------------------------------------------------- |
| d50bcc6 | Gated Staging PKCE initiation and boundary tests                                 |
| d3c834b | Disposable hosted acceptance fixtures and security coverage; deployed app source |
| a8d064c | Inspect provider assets without relaxing CSP                                     |
| b8e42cf | Distinguish actual source-map directives from string literals                    |
| 2ee6c67 | Serialize hosted suites and record safe suspension probes                        |
| 8746b1d | Normalize test formatting; full CI successful                                    |

Final branch: `feature/phase-0-5-staging-gate`. Final documentation commit SHA, its CI run and clean working-tree confirmation are included with delivery. Changes are pushed; develop/main are not merged.

Operational limits: Preview requires authorized Vercel access; deployment/allowlist rotation is currently manual; real email PKCE depends on a controlled mailbox/provider email quota; hosted suites must be serialized. Automatic Git deployment and production operational readiness are outside this closeout. These do not replace or weaken any passed gate.

## W. Final Decision

**GO FOR PHASE 1**

Phase 0.5 hosted acceptance is complete with zero BLOCKED and zero PARTIAL critical gates. This is permission to propose the next phase, not to begin it automatically. No Phase 1 business feature was implemented. Stop here and wait for the owner's explicit Phase 1 approval.
