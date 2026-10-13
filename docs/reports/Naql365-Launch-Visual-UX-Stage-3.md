# Naql365 Launch Visual & UX Stage 3 — Staff / Operations / Finance

## Decision

`LAUNCH VISUAL & UX STAGE 3 PARTIAL — REMEDIATION REQUIRED`

Current deployed application: `1b1e02fc6c316950d53d70e671faeeca82be004e`, protected canonical Stage 3 Preview. The six canonical CUSTOMER/SUPER_ADMIN/DRIVER localized session groups and ten hosted business regression groups passed. The populated staff visual/state matrix remains incomplete. Current migration count is 47, including the owner-approved support read projection. Earlier checkpoints below retain their original scope and outcomes and are not current deployment claims.

This delivery is pre-production polish only. It does not deploy Production, modify `main`, change DNS, configure Hostinger Production, start Stage 4, or start Phase 8.

## Historical initial baseline and scope

- Accepted `develop` baseline: `3f5a80e2a4373f20c0cd57fdae73977ae2c0c52f`
- Stage 3 branch: `feature/launch-visual-ux-stage-3-staff-operations-finance`
- Application/report candidate SHA: `6306f5a` (full SHA is recorded by Git)
- Migrations: 46, unchanged
- Source changes: staff workspace presentation only; no schema, RPC, RLS, RBAC, lifecycle, pricing, payment, or authority changes
- Preview: not deployed in this pass; hosted staff regression and visual evidence remain open

## Before / after

The staff portal previously presented Sales, Operations, and Finance as separate technical lists with inconsistent headers, equal-weight actions, and limited context about the next action. The Stage 3 changes add a shared workspace navigation pattern, page headers with workspace context, bounded panels, compact queue metadata, semantic status/action grouping, responsive action placement, and explicit Finance review actions. Existing server data and authorization checks are reused.

## Changed surfaces

- `src/components/shell/staff-workspace-nav.tsx` — shared Sales/Operations/Finance workspace navigation
- Sales quote queue — PageHeader, work-queue count, request/customer/route grouping, next-action affordance
- Finance queue — PageHeader, status filter toolbar, payment method/status/proof/amount grouping, review action
- Operations workspace entry — shared workspace navigation before the existing authoritative workspace
- `src/app/globals.css` — staff queue/panel/filter/navigation responsive styles
- `docs/launch-visual-ux-stage-3-gap-analysis.md` — findings and accepted presentation scope

## Preserved authority

No new data query, write path, RPC, migration, role, permission, commercial field, payment rule, or lifecycle state was introduced. Finance proof and confirmation remain authoritative in the existing Finance actions. Manual pricing remains the only launch mode. No guest capability, private Driver data, payment destination, or internal pricing authority is exposed.

## Verification

- Formatting: PASS (`prettier --check .`)
- Strict TypeScript: PASS (`next typegen && tsc --noEmit`)
- Lint: PASS (`eslint . --max-warnings 0`)
- Production build: PASS (`npm run build` with local guard configuration)
- Secret/history scan: PASS (`Secret-pattern scan passed for 1268 tracked files`)
- Unit/integration: PASS — 50 files, 279 tests
- Local E2E: PASS — 40 tests, desktop and mobile projects
- Migration count: PASS — 46 files
- SQL/RLS: BLOCKED in this environment; `supabase test db` could not connect to local Postgres at `127.0.0.1:54322` because the local database service was not running
- Hosted staff regression: NOT RUN — no protected Stage 3 Preview was deployed in this pass
- Stage 3 visual matrix/screenshots: NOT RUN — requires the protected Preview and run-owned staff fixtures
- Accessibility smoke: NOT RUN against hosted staff routes; existing semantic labels/focus primitives were preserved

## Matrix plan

The required matrix remains pending and will cover Sales queue/request review/quote editing/sent/accepted/rejected; Operations planning/assignment/active/completed/issue/reassignment; Finance cash due/transfer review/rejected/resubmitted/confirmed; and shared empty/loading/validation/server-error/retry/success states in Arabic RTL and English LTR at 360, 390, 768, 1280, and 1440 pixels. Screenshots must use synthetic run-owned data and exclude credentials, tokens, cookies, guest capabilities, private proof URLs, and real payment destinations.

## Deferred items

New operational KPIs, live location/ETA, route optimization, new projections, new authority, new lifecycle states, and any schema or RPC change are deferred. They require separate backend/product review and are not visual defects.

## Cleanup and release safety

No fixtures, temporary credentials, Production configuration, DNS, Hostinger configuration, or `main` changes were created by this pass. The working tree is intended to be committed only with the documented Stage 3 source and report changes.

## Closeout condition

Stage 3 can move from PARTIAL to PASS only after a protected Preview is available and the hosted staff regression, SQL/RLS verification, accessibility smoke, and complete visual matrix pass with run-owned fixture cleanup.

## Owner login investigation — 2026-10-11

Stage 3 acceptance is paused. No authentication source or identity was changed.

The reported `naql365-staging-naz32x8x1-naql365.vercel.app` is READY Preview deployment `dpl_3DZmJNfNZUZCu7hBbNgMbEZUwCff`, application SHA `23c3ab7d22b3f103069f852010b2b0fba2aaaf72`, from Stage 2. The authenticated Vercel dashboard associates it with the alias `naql365-staging-ux-stage2-naql365.vercel.app`. It is not a deployment of this Stage 3 branch.

An isolated browser tab submitted identical deliberately invalid-format diagnostic email input on both hostnames, without using a real account or owner password. The deployment hostname returned the account-service error; the accepted alias returned the email/password-format validation error. No signup/reset or fixture was created.

The login action checks exact request Origin against `appUrl().origin` before creating the SSR client and before Zod validation or `signInWithPassword`. Non-Zod exceptions become the generic server message. These action/config/client files are unchanged between the deployed SHA and current Stage 3 HEAD. The differential result isolates the diagnostic failure before password authentication and strongly identifies noncanonical-origin rejection. It does not establish whether the owner's credentials are valid. Membership resolution and redirect occur later.

Bounded Vercel logs showed POST `/ar/login` HTTP 200 at 09:52:03.495Z and 09:52:21.814Z with no surfaced exception message; a Server Action can return an error state with HTTP 200. The raw hostname also showed `/api/public/analytics` HTTP 403. No request bodies, keys, headers, cookies, or tokens were extracted.

Actual owner password login on the accepted alias passed after owner-only entry. The Arabic Customer account rendered; public homepage navigation retained My account; direct `/en/login` redirected to `/en/account`; refresh retained the Customer account. `/en/portal` showed Access denied. Explicit Sign out returned to `/en/login`; browser Back did not restore the Customer account; direct `/en/account` after logout returned to login. No owner password/session/cookie values were inspected. This proves normal Customer authentication on the accepted alias without a reset or account change; the observed raw-host failure is not evidence of invalid credentials.

Fresh account readback is still blocked: local Supabase administration rejected its existing credential, and the current Chrome Supabase account does not expose the Naql365 organization. The owner was asked to restore the authorized dashboard session without sharing credentials. Historical account evidence is not substituted for fresh readback.

### Closeout continuation: fresh identity verification and staff attempt

The preceding access blocker is historical. Supabase dashboard access was restored, and the existing stored CLI credential also worked after excluding the invalid environment-variable credential from that child process only. No persistent credential or account setting was changed.

Read-only aggregate queries against verified `naql365-staging` confirmed:

- Owner Customer: exactly one confirmed Auth identity, not banned, one profile, one Customer, zero Driver records, exactly one active customer membership in the configured enrollment organization, and exactly one CUSTOMER role. No staff/driver role or duplicate relationship was present.
- Intended administrator: confirmed Auth identity, not banned, one profile, zero Customer/Driver records, one active staff membership in the configured enrollment organization, and SUPER_ADMIN role only.

The owner was asked to enter the administrator password interactively on the accepted alias. The observed Chrome login page returned the localized invalid-credentials message and remained there after the owner reported a second attempt. This message maps to `signInWithPassword` returning `invalid_credentials`; it differs from the original generic account-service error. No password was inspected, exported, reset, or logged. Redacted input observations cannot independently prove what email/password the owner submitted. Administrator portal/session/logout acceptance therefore remains incomplete, and this result must not be retrospectively assigned as the cause of the original Customer incident.

DRIVER regression has not run. No disposable identity, business fixture, temporary privilege, Storage object, or automation credential was created during this closeout continuation. Staff acceptance remains blocked, so Stage 3 visual acceptance remains paused.

Original transient account-service failure root cause not conclusively established.

The independently reproduced raw-host versus canonical-alias differential is evidence for an origin/runtime configuration boundary; the original owner POSTs lack a recorded safe exception code tying them conclusively to that boundary. There is no established evidence of Supabase network transience, membership RPC failure, or cookie failure in those original attempts. Do not relabel the incident as a credentials problem. Application source and all 46 migrations remain unchanged; these are uncommitted report updates, not a new deployed application or a new CI PASS.

### Deployment-wide investigation supersedes account-specific investigation

The owner's multi-account evidence is retained as deployment-host failure evidence. Account-specific credential investigation is stopped. No password reset or identity mutation is authorized or performed.

Fresh scoped Vercel CLI API readback on 2026-10-11 establishes the following two URL references. They resolve to the SAME immutable deployment, not two different application artifacts:

| Reference                             | URL                                                    | Deployment                         | Application SHA                            |
| ------------------------------------- | ------------------------------------------------------ | ---------------------------------- | ------------------------------------------ |
| GOOD (owner Customer sequence passed) | `https://naql365-staging-ux-stage2-naql365.vercel.app` | `dpl_3DZmJNfNZUZCu7hBbNgMbEZUwCff` | `23c3ab7d22b3f103069f852010b2b0fba2aaaf72` |
| FAILING (owner multi-account report)  | `https://naql365-staging-naz32x8x1-naql365.vercel.app` | `dpl_3DZmJNfNZUZCu7hBbNgMbEZUwCff` | `23c3ab7d22b3f103069f852010b2b0fba2aaaf72` |

Both are READY, Preview (CLI inspect), branch `feature/launch-visual-ux-stage-2-customer`, created `2026-10-09T07:50:59.939Z` / 10:50:59.939 Asia/Riyadh. This creation timestamp supersedes any earlier dashboard build-completion timestamp used as creation time. There is no build/SHA/branch difference between these references. Current Stage 3 source has not been deployed here. The source diff from this deployed SHA to current Stage 3 HEAD contains only Finance/Sales/Operations page presentation, staff navigation, and CSS; inspected Auth/server-client/environment/guard/identity/proxy paths have no changes.

Both deployment build/runtime environment name lists include APP_ENV, APP_URL, STAGING_AUTH_SMOKE_ENABLED, NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Project-level variables are Preview-scoped with no branch-specific restriction; APP_URL is absent at project level but present in deployment metadata. Project protection is `all_except_custom_domains`; both references are vercel.app hosts. Authenticated CLI fetch reached the application on both hosts. No protection change was made.

Effective values and a valid plaintext publishable-key fingerprint have NOT yet been independently retrieved: API environment responses returned encrypted/redacted values, which were not treated as plaintext or hashed as though they were keys. Project-level current settings are not proof of historical build values. The same immutable deployment rules out a different public build artifact between these two URLs, but does not by itself prove the intended backend or effective APP_URL. Existing successful Customer login and exact-origin differential remain supporting runtime evidence, not a fabricated environment dump.

The new connector returned scoped 403; the mapped existing CLI fallback succeeded. Browser control then became unavailable, so a fresh owner-operated same-account A/B attempt and safe live attempt correlation remain pending. No deployment/environment/source change was made. SUPER_ADMIN and DRIVER acceptance are not PASS. The investigation cannot close or resume Stage 3 acceptance until the requested repaired-Preview checks are complete.

### Same-deployment origin isolation — read-only continuation

Fresh private-context CUSTOMER A/B is PENDING. Previous normal-browser success is not substituted for this gate. The available browser API did not expose an established private-context/network-cookie inspection workflow and reported the user unavailable. The owner was asked to test sequential clean Incognito sessions, closing all private windows between origins; simultaneous Incognito windows may share a cookie store. No passwords, request bodies, cookie values, or HAR exports were requested. No STAFF/DRIVER tests or fixtures were started.

Credential-free authenticated CLI HEAD probes establish the effective `appUrl().origin` as `https://naql365-staging-ux-stage2-naql365.vercel.app`: `/auth/callback` without any code returns HTTP 307 to that origin's `/ar/login` from BOTH hosts. The deployed route constructs this redirect solely with `appUrl()` and skips Supabase exchange when no code exists. This safely establishes runtime origin behavior, not a direct build-environment dump. Both login pages return HTTP 200, private/no-store caching, matching security headers, and no Set-Cookie in these unauthenticated probes. CSP has `form-action 'self'` and identical HTTPS/WSS connect-src for `zuvyfeflkzlciuaauxba.supabase.co`. Nonces were redacted; cookie values were never printed.

Read-only `supabase config diff` against the exact Staging ref shows remote Site URL remains the historical `https://naql365-staging-l2et1jst5-naql365.vercel.app`. Remote redirect URLs contain exact AR/EN confirmation and recovery callbacks for that historical origin and the GOOD Stage 2 alias. No raw `naz32x8x1` callback and no wildcard is present. The command only compared configuration; nothing was pushed.

| Boundary                                    | GOOD         | FAILING         | Relevance                                                            |
| ------------------------------------------- | ------------ | --------------- | -------------------------------------------------------------------- |
| Deployed manifest Staging canonical origins | ALLOWLISTED  | NOT ALLOWLISTED | Validates configured APP_URL at build; not an incoming-host wildcard |
| Exact login action Origin equality          | ALLOWLISTED  | NOT ALLOWLISTED | Runs before input parsing and signInWithPassword                     |
| Supabase email callbacks                    | ALLOWLISTED  | NOT ALLOWLISTED | NOT RELEVANT to password-token issuance before any email redirect    |
| CSP form-action self                        | ALLOWLISTED  | ALLOWLISTED     | Each host posts to itself                                            |
| CSP backend connect-src                     | ALLOWLISTED  | ALLOWLISTED     | Same approved Staging backend                                        |
| Next custom allowedOrigins override         | NOT RELEVANT | NOT RELEVANT    | No override found; standard Next protection retained                 |

APP_URL also constructs confirmation/recovery destinations and callback completion redirects, supplies HTTPS detection for SSR/guest cookie security, and is checked by the deployment guard. SSR/browser auth cookies use Path `/`, SameSite lax and HTTPS Secure; source does not configure a shared Domain. Guest cookies are separately SameSite strict. Proxy forwards incoming headers and refreshes cookies without canonicalizing the host. Actual server-observed X-Forwarded-Host/X-Forwarded-Proto cannot be inferred from response headers and remain unobserved.

The earlier invalid-format credential-free action differential is consistent with the explicit exact-origin check rejecting the raw hostname before Supabase Auth. However, fresh same-account private-context outcomes, first-request live status, session issuance, and membership RPC execution remain UNVERIFIED. Do not report origin-specific CUSTOMER A/B PASS, do not blame the Supabase callback allowlist for password authentication, and do not claim the original owner attempt's exact exception was logged. No source/configuration/account/deployment changes were made.

### Dedicated Stage 3 Preview preparation (owner authorized)

Reconciliation: Stage 3 presentation application commit is `6306f5a9af23754200d78d1e6e5e071abbc99759`; delivery HEAD `5c6f6bdcd2b0b49865e3dfb1e1fce263d3b31b31` differs only in this report. Neither is deployed by the existing Stage 2 deployment. Stage 2 runtime evidence cannot certify Stage 3.

The owner authorized one dedicated Stage 3 canonical Preview. The manifest adds only `https://naql365-staging-ux-stage3-naql365.vercel.app` to the Staging origins. This requires a new exact release SHA containing the approved presentation code plus the exact-origin deployment configuration; it does not alter Auth, cookies, origin checks, RLS, RBAC, or migrations. The rejected raw Stage 2 hostname is not added. Production remains unapproved and Hostinger remains deferred.

Predeployment local checks: 279 unit/integration PASS, strict TypeScript PASS, lint PASS, formatting PASS, build PASS, tracked/history secret-pattern scans PASS. All 46 migrations are identical to accepted develop. Public Supabase project configuration readback matches `zuvyfeflkzlciuaauxba`; publishable-key SHA-256 is `818b0ed06a8a4ad0f02a032e4974b5cc9790a989c7e2521b74f28e03ab2d4d0d` (no key value recorded). Deployment creation, callback updates, hosted three-role smoke, and fresh private-context Stage 2 owner login are still pending at this checkpoint. This preparation is not an Auth closeout or Stage 3 acceptance PASS.

Live deployment-specific APP_ENV/APP_URL, backend build/runtime coherence, and fresh SUPER_ADMIN/DRIVER session/logout results remain to be verified. Anonymous HTTP probes on both deployment and alias hosts returned 302 to Vercel protection. No overall fix PASS is claimed. No deployment, environment, account, protection, migration, main, Production, DNS, or Hostinger mutation occurred. Migration count remains 46. This update is documentation only, with no new application SHA or CI claim.

### Dedicated Stage 3 Preview — deployed checkpoint

Authoritative application/configuration SHA: `afc34a5cdffa5392e490a8e7259f9214dfd961b4`. This adds the exact Stage 3 manifest origin to the earlier presentation application; Auth/RLS/RBAC source is unchanged. Delivery is not confused with the Stage 2 deployed artifact.

- Canonical origin: https://naql365-staging-ux-stage3-naql365.vercel.app
- Deployment: `dpl_7vY6iez2wXj8pmD2raHuaZiPvho6`, READY / Preview, exact SHA verified.
- Branch-scoped Preview settings: APP_ENV staging, APP_URL exact canonical origin, STAGING_AUTH_SMOKE_ENABLED false. Staging public backend configuration is inherited; no service-role runtime credential was added.
- Historical automatic attempt `dpl_Gz8QTE2pUMb8nK1sn54FTERjP7ux` failed with `ENV_STAGING_ORIGIN_NOT_APPROVED` before branch configuration completion. It remains a failed deployment, not PASS. A fresh build of the same SHA after configuration succeeded.
- Canonical unauthenticated probe: 302 to Vercel protection. Authorized CLI login-page probe: 200, CSP present, private/no-store cache policy. No-code callback: 307 to the exact Stage 3 canonical /ar/login?notice=confirmation-link, proving effective APP_URL routing. These probes do not prove password login/session issuance.
- Supabase Staging: four exact Stage 3 callbacks appended (AR/EN confirmation and recovery); eight existing callbacks preserved. Minimal config diff showed one update only; post-push readback showed zero declared configuration drift and fourteen unchanged remote-only settings. Site URL and other Auth/security settings were preserved.
- Local E2E: 40/40 PASS. Exact-head CI: 38164851603 PASS on afc34a5cdffa5392e490a8e7259f9214dfd961b4. All 46 migrations remain unchanged.
- Fresh owner-operated Incognito Stage 2 login/refresh/logout remains pending. Stage 3 CUSTOMER, SUPER_ADMIN and DRIVER password/session/role smoke remains pending. No fixture/account mutations or temporary automation credentials were created in this checkpoint.

Status remains: LAUNCH VISUAL & UX STAGE 3 PARTIAL — AUTH REGRESSION UNDER INVESTIGATION. The dedicated Preview is ready; Auth closeout and visual acceptance are not claimed.

### Frozen-candidate Auth control continuation

Application remains afc34a5cdffa5392e490a8e7259f9214dfd961b4; no source/configuration changes in this continuation. Fresh Stage 2 private-context owner login is pending; it is neither STAGE2_CONTROL_PASS nor STAGE2_CONTROL_FAIL without execution evidence. No Stage 3 role fixtures were created before this control.

Read-only Supabase config comparison confirms all twelve exact accepted callback entries match (four Stage 3 plus eight prior), no callback drift. Remote Site URL remains the historical l2et1jst5 Preview. Browser navigation on the canonical Stage 3 hostname exercised AR/EN callback and AR/EN recovery callback paths without a code. All four reached the same Stage 3 localized login path with notice=confirmation-link and localized safe error copy; none redirected to Stage 2. This verifies invalid/missing-code routing only, not successful confirmation/recovery exchange. Default Site URL fallback remains distinct from explicit application callback routing.

CUSTOMER/SUPER_ADMIN/DRIVER hosted session matrices and live cookie-attribute inspection remain pending. No owner record mutation, no synthetic fixture, no temporary credential, and no new code commit/CI claim. Investigation remains PARTIAL pending the fresh private-window control.

### Approved staff-shell implementation — local verification in progress (2026-10-12)

This checkpoint supersedes the frozen UI scope after the owner's explicit backend decision. The previous afc34a5 deployment and CI remain historical; the new uncommitted staff implementation is not deployed and must not inherit that PASS.

- Persistent/collapsible staff sidebar, mobile dialog navigation, compact Market/locale/logout bar and bounded role-safe attention queues added. Existing Sales/Operations/Finance loaders remain the data authority. No global metrics were introduced.
- One active STAFF organization context gates navigation and staff loaders; ambiguous contexts fail closed. CUSTOMER_SERVICE gets no pricing, Finance, Dispatch or guest-link mutation grants.
- Migration 47: `20261012000100_support_request_queue.sql`. Authenticated active STAFF + support.read AND requests.read, tenant/active Market validation, paired keyset cursor, stable createdAt/UUID ordering, max 30 rows. Approved support contact/reference/service/city/journey/timestamp fields only. No changes to existing business records or policies. Official types add the one RPC.
- Local verification: 293/293 unit/integration PASS; 40/40 existing browser E2E PASS; SQL test suite PASS; official local types generated; all six independent-connection concurrency suites PASS. Populated 46→47 additionally preserves every existing table record, policy and role grant in the upgrade test. Migrations 1–46 have no diff against afc34a5.
- Historical local E2E start attempt failed `ENV_BUILD_RUNTIME_MISMATCH` because the build omitted APP_URL while Playwright supplied the loopback origin. Rebuilding and starting with the same loopback configuration resolved this; guard unchanged.
- Restricted staff browser harness is new, local-only and uses normal password login with scoped synthetic identities. Initial selector assumptions failed; the first cleanup also hit the tenant audit-log foreign key. Scoped recovery completed and independently verified identity removal. Subsequent interrupted runs cleaned their own fixtures. These attempts are not PASS; their ledgers remain under test-results/staff-local-*.
- First successful dashboard captures exposed presentation cascade conflicts (desktop drawer trigger and oversized empty panels). CSS ordering/density correction is under renewed local browser verification, not yet accepted hosted evidence.
- No new hosted fixture, Preview automation credential, Staging migration application or deployment was performed in this checkpoint. Owner accounts are untouched. Full canonical hosted CUSTOMER/SUPER_ADMIN/DRIVER matrices and populated staff visual/state matrix remain open. No exact-head CI claim for the uncommitted changes.

Current result remains **LAUNCH VISUAL & UX STAGE 3 PARTIAL — REMEDIATION REQUIRED**.

Restricted-role local browser checkpoint: 12/12 role×locale groups PASS (SUPER_ADMIN, SALES, OPERATIONS, DISPATCHER, FINANCE, CUSTOMER_SERVICE × AR/EN), with 60 indexed/hashed empty-dashboard captures across 360/390/768/1280/1440. Normal password login, refresh, direct-login recognition, permission-derived module visibility, granted module route smoke, drawer Escape/return-focus, RTL/LTR, overflow, axe smoke, explicit logout and protected-portal denial passed. Evidence: `test-results/staff-local-1791794431131/index.json`; ledger confirms owned tenant/identities removed. These are LOCAL empty-state checks, not the required populated hosted matrix or WCAG certification. Earlier interrupted harness runs remain historical. The logout harness was corrected to await the application's redirect before navigating, with no Auth source change. Repository database CI now runs this local restricted-role harness and retains its safe evidence artifact.

A repeat SQL run after concurrency encountered leftover local concurrency fixtures (existing test helper and duplicate synthetic reference). A fresh local reconstruction restored isolation and all eight SQL files/TAP reports passed. This is retained as a local test-order/environment interruption, not relabeled application PASS. Git blob comparison proves all 46 accepted migration blobs unchanged; nine working files differ in Windows CRLF representation only, with no normalized-content differences.

Post-checkpoint reruns: a concurrent heavy local run timed out the existing market-fixture isolation test at 30s (292 passed, one timeout). Its isolated rerun passed in 8.24s without source/timeout changes. Expanded direct forbidden-route browser checks first expected a redirect from payment configuration; that page correctly returns 404, so the harness assertion was corrected to its established denial behavior. Application authorization was not changed for this mismatch. Generated official types still match the staged RPC-only type diff.

The final restricted-role harness also verifies direct forbidden module navigation, including localized not-found denial for payment configuration and read-denied support. No page is authorized merely because its sidebar link is hidden. Captures remain synthetic empty-state local evidence; hosted populated-state acceptance is still required.

Final expanded local role run: 12/12 groups PASS including direct forbidden module routes; 60/60 captures indexed and hashed at `test-results/staff-local-1791808823601/index.json`, scoped cleanup PASS. Lint and strict TypeScript PASS after harness correction. This is the current local role evidence; earlier 60 captures remain historical. No cloud migration or deployment is claimed by this implementation checkpoint.

### Protected hosted staff-shell checkpoint — 2026-10-12

Application SHA: `1b1e02fc6c316950d53d70e671faeeca82be004e`. Exact-head Foundation CI `38250748681` passed both required jobs; official generated-types workflow `38250748882` passed. Local results remain 293 unit/integration, 40 E2E, SQL/RLS/types, populated 46→47 preservation and six concurrency suites PASS. The earlier isolated test-order/timeout failures remain historical above.

The approved migration `20261012000100_support_request_queue.sql` was applied to **Staging only** after an exact-project check and a dry run listing only that file. Readback: 47 migrations, anonymous RPC execution false, authenticated execution true (the function additionally enforces active STAFF plus both permissions). Existing migrations 1–46 remain unchanged. The first dry-run reader stopped without writing because it inspected stdout while the CLI wrote its pending list to stderr; this was an operator-tool reading issue, not a schema change.

The exact application deployment is `dpl_HkTcKrgynRZoSpduca5JX5oE8hDu`, READY / Preview. Canonical acceptance URL: https://naql365-staging-ux-stage3-naql365.vercel.app . Its immutable deployment URL is not an approved Auth acceptance origin. The stable Stage 3 alias now points to this deployment. Authorized login-page HTTP probe returned 200 with private/no-store and CSP scoped to Staging HTTPS/WSS; no-code callback returned 307 to the same canonical Stage 3 /ar/login. Anonymous access returned 302 to Vercel protection. These checks do not substitute for role session tests.

Hosted empty-workspace smoke now covers **12/12 role×locale groups**, 60/60 dashboard captures at 360/390/768/1280/1440: SUPER_ADMIN, SALES, OPERATIONS, DISPATCHER, FINANCE, CUSTOMER_SERVICE × AR/EN. Normal password login, refresh, direct-login recognition, authorized module routes, forbidden module denial, drawer Escape/return focus, direction/overflow, axe smoke and explicit logout/protected denial passed. This is not WCAG certification and not the populated business/state matrix.

Hash-verified evidence index: `docs/reports/evidence/stage3-staff-shell/index.json` (60 synthetic PNGs preserved alongside it; original run indexes remain under test-results). Contributing run-owned ledgers: `staff-hosted-1791812240274` (SUPER_ADMIN only), `staff-hosted-1791812598686` (SALES/OPERATIONS/DISPATCHER only), `staff-hosted-1791812911843` (FINANCE/CUSTOMER_SERVICE). Each contributing ledger confirms owned tenant and Auth identity cleanup. No owner identity or existing catalogue was changed; these runs created no business/payment/Storage fixtures.

Historical hosted interruptions are retained: an over-broad alert selector matched both the rendered denial and an additional alert, so its assertion was narrowed to the actual denial section; the denied SALES support page returned no support cards. A FINANCE 360px responsive assertion failed once but did not reproduce in the isolated rerun; no application root cause is claimed. Temporary platform credential requests initially hit API input validation (length and revoke-regenerate field); the issued credential was recovered by its exact run note, revoked, and reuse denied. One immediate post-revocation probe did not yet show denial; later runs wait for propagation and verified reuse denial. All these attempts remain failures/interruptions, not overall PASS. No application Auth or authority change was made to accommodate the harness.

The new hosted harness files are test-only and do not change the deployed application. Canonical CUSTOMER/SUPER_ADMIN/DRIVER extended session checks, populated staff workflows/state captures and complete hosted business regression remain open at this checkpoint. The final role/session result and delivery-head CI must be reported separately. **LAUNCH VISUAL & UX STAGE 3 PARTIAL — REMEDIATION REQUIRED** remains the overall result.

Canonical session follow-up: **6/6 hosted role×locale cycles PASS** on the same application SHA for CUSTOMER, SUPER_ADMIN and DRIVER. Every cycle used a fresh Playwright context and normal password login with a scoped synthetic identity. Verified destination, refresh, public navigation/services, AR↔EN, SA↔EG, direct-login recognition, cross-role page denial, explicit logout, Back without restored authenticated shell, refresh and protected-route denial. Cookie assertions inspected attributes only: Secure, SameSite Lax, Path /, exact canonical host. Readback found one membership and one role for each test identity. Evidence: `docs/reports/evidence/stage3-staff-shell/session-results.json`; run `stage3-auth-1791837265195`. Owned Customers/Driver/member/role/tenant/Auth rows were removed; temporary platform credential revoked and reuse denied. Existing owner accounts were untouched.

The first two session harness attempts matched both desktop and mobile identity links, causing strict locator failure after successful login. The harness now checks desktop-link destination and the visible mobile-drawer link separately. Those failed attempts remain historical, with cleanup/revocation PASS. No application Auth source changed. This closes the reproduced canonical login/session failure path; the previously rejected noncanonical deployment origin is not an approved acceptance URL. Full assigned-trip isolation/execution and populated staff workflow/visual acceptance remain separate pending gates; neither empty-shell screenshots nor session checks substitute for them.

Hosted database verification also passed after the role/session fixtures were cleaned: 47/47 migration versions match the repository; all 60 public tables retain RLS; the transactional SQL/security assertions (including support permission/tenant/field/pagination checks) passed; hosted generated public types match canonical CLI types. Evidence: `test-results/stage3-hosted-database.json`. This check uses rollback-scoped SQL fixtures and does not activate or modify Production configuration.

### Hosted business recovery and regression — 2026-10-13

Application source remains `1b1e02fc6c316950d53d70e671faeeca82be004e`; no application/Auth/migration changes were made. Previous delivery `48173086cb8e7aade20bcee50ca16bde4a152914` has exact-head Foundation CI `38305927564` PASS. New test/evidence edits require their own CI and do not inherit that result.

The October 12 business runner disappeared before finalization. Its SA/EG snapshots showed the guest wizard shipment step with a validation message. This interrupted attempt remains INCOMPLETE, not PASS. Recovery removed its 16 run-owned identities and associated fixture data; independent readback found zero identities/profiles/customers/memberships/roles/bank fixtures/file metadata/owned Storage objects/isolation organizations. The temporary credential was revoked and reuse returned 302. The temporarily raised guest quota was restored to the documented 30/hour, preserving enabled=true and 30-day lifetime. Recovery evidence and original snapshot hashes: `evidence/stage3-staff-shell/interrupted-business-recovery.json`.

The existing guest journey harness advanced immediately after editing an item, unlike the previously successful visual harness which waits for Saved. A test-only Saved assertion and next-step visibility assertion now bound that transition. No application behavior was altered. Playwright outputs now have a dedicated `test-results/phase7-playwright` directory, preventing deletion of unrelated evidence/helpers. Stage 3 business mode stops after its first failed test. The 60 previously accepted staff-shell captures remain hash-valid.

Rerun `1791874031495` passed all 10 hosted groups on the same canonical protected deployment: SA guest CASH through delivery, EG guest synthetic transfer/proof rejection/reupload/Finance confirmation through delivery, guest Quote rejection without Order, SA/EG registered manual Quote/CASH, AR/EN public responsive/axe/security contact checks, capability replay/isolation, and AR/EN SUPER_ADMIN navigation/logout/history denial. Transient polling assertions logged by the safe reporter were followed by successful authoritative state transitions; no final test failed. Result: `evidence/stage3-staff-shell/business-results.json`.

Scoped fixture cleanup passed; independent readback confirmed zero Auth fixtures in the run window and guest quota 30/hour. Temporary credential revoked, reuse denied, hosted lock released. Owner records/catalogues were preserved. Formatting, targeted ESLint, strict TypeScript, 30 focused staff/session tests, tracked secret-pattern scan and history scan passed. Secret scans are heuristic, not proof that every possible secret format is absent.

Remaining launch gate: populated restricted-role staff visual/state evidence across the approved locale/viewport matrix, including loading/validation/error/retry/success and detailed Sales/Operations/Finance/support screens. The empty-shell captures, role session tests and business regressions do not replace that visual matrix. Stage 3 remains PARTIAL; no merge, main, Production, DNS, Hostinger or Phase 8 action occurred.
