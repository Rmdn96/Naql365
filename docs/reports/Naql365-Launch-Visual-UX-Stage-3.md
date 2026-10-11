# Naql365 Launch Visual & UX Stage 3 — Staff / Operations / Finance

## Decision

`LAUNCH VISUAL & UX STAGE 3 PARTIAL — DEPLOYMENT-WIDE AUTH REGRESSION UNDER INVESTIGATION`

This delivery is pre-production polish only. It does not deploy Production, modify `main`, change DNS, configure Hostinger Production, start Stage 4, or start Phase 8.

## Baseline and scope

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
