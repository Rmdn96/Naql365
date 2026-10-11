# Launch Visual & UX Stage 2 — Customer Experience

Status: LAUNCH VISUAL & UX STAGE 2 PARTIAL — REMEDIATION REQUIRED

Baseline: `62ebec4228c50210af741023bb9c87b0364d2fb0` (Stage 1 closed through PR #12). Branch: `feature/launch-visual-ux-stage-2-customer`. This is pre-production presentation work, not Phase 8 or permission to merge or release.

## Before and after

- Final Quotes previously presented route, amount and validity as an undifferentiated vertical document. A pickup/delivery route block and separate final-price panel now give these facts a clear hierarchy. Existing authorized Quote items, tax and expiry remain the sole source of monetary facts. Internal verified-distance wording is removed from the customer view.
- Checkout now distinguishes payment-method choices from transfer-proof history and describes review, rejection/resubmission and confirmed payment separately. Uploading proof is explicitly not payment confirmation. Finance uses its existing workspace presentation and commands.
- Customer account includes a bounded recent-request list using the already-fetched projection, with Quote actions and the latest journey ahead of profile settings. No extra query, fabricated KPI or new Order projection is added.
- The eight-step wizard has contextual AR/EN help, clearer optional service selections and grouped review details. Existing save/retry/conflict/submission commands and validations are untouched.
- Signup, recovery and onboarding explain the next step; guest continuation emphasizes safe-link privacy without rendering the capability. Authentication, role routing and logout authority are unchanged.
- Public payment guidance explains cash versus transfer without destinations or amounts. Hero tracking remains a secondary action; available service/coverage catalogues and the route motif remain authoritative.
- Tracking adds a progress element from existing completed/total Stop counts and separates loading from an empty response. No new location, Driver, Finance or assignment information is fetched.

## Design and boundaries

Deep Navy, Electric Blue, Cyan accents, white surfaces, Alexandria/Inter and accessible action blue are retained. Customer-scoped CSS adds restrained 12–16px content surfaces, 20px public sections, logical-direction spacing and responsive commercial summaries. Staff workspace styles are not broadly redesigned.

All 46 migrations remain immutable. No database, RPC, RBAC/RLS, pricing/Finance authority, capability, session or lifecycle implementation is changed. The manual pricing guard remains server/database authoritative. AUTOMATED mode is preserved for future configuration; MANUAL/missing configuration does not expose preliminary monetary values. The guarded preliminary projection is not removed or reimplemented by the UI.

Some desired account information (a consolidated Order/payment/completed-history dashboard) is not in the current account projection. Stage 2 links to existing authorized Quote/Order journeys instead of broadening query authority. No legal copy, MFA, Production catalogue/payment values, Hostinger acceptance, DNS or main changes are authorized.

## Verification and release identity

Application SHA: `fbd355aacc0952db9101d6fff6fe8a0e1c93d13a`.
Application CI: [37796140216](https://github.com/Rmdn96/Naql365/actions/runs/37796140216), PASS for both required jobs.
Protected Preview: https://naql365-staging-ux-stage2-naql365.vercel.app
Deployment: `dpl_Bg1zGn2bJttYJknDnk3ucGjcyhkC`, Preview/READY with exact application SHA metadata. Staging smoke authority is disabled. Unauthenticated access returns the Vercel protection redirect.

| Gate                                             | Result                    | Evidence                                                                                    |
| ------------------------------------------------ | ------------------------- | ------------------------------------------------------------------------------------------- |
| Formatting, lint, strict types, production build | PASS                      | Application exact-head CI                                                                   |
| Unit/integration                                 | PASS                      | 271 tests, 49 files; bounded-worker local rerun and required CI                             |
| Local E2E                                        | PASS                      | 40 tests, including existing 36 and four Stage 2 locale/device cases                        |
| Database/RLS/generated types                     | PASS                      | Fresh 46-migration reconstruction, seven SQL/RLS suites, official types unchanged           |
| Independent-connection concurrency               | PASS                      | 44 assertions across Operations, Driver, Tracking, Payment, Guest and manual pricing suites |
| Migration immutability                           | PASS                      | No migration blob differs from accepted develop                                             |
| Secret scans                                     | PASS at application HEAD  | Tracked-file and history heuristic scans; rerun required for delivery commit                |
| Hosted business regression                       | PASS                      | First run: 10/10, exact application Preview                                                 |
| Responsive/axe                                   | PASS for exercised states | AR/EN, RTL/LTR; 360/390/768/1280/1440 widths, no page overflow; keyboard/dialog regression  |
| Full state-by-state visual matrix                | PARTIAL                   | Remaining coverage listed below; representative screenshots do not certify every state      |

The first hosted run includes SA Guest CASH through delivery/POD; EG Guest BANK_TRANSFER with private proof, Finance rejection/reupload/confirmation and delivery/POD; guest Quote rejection without an Order; SA/EG registered manual Quote/CASH; public AR/EN responsive/axe/SEO/Market/WhatsApp; capability isolation; AR/EN normal SUPER_ADMIN session, direct-login routing, refresh, logout and Back denial. CUSTOMER and DRIVER logout/protected-route denial are exercised inside their journeys. No preliminary amount authority was changed. SA and EG Staging pricing mode was read back as MANUAL.

Two early local unit runs hit existing 30-second test timeouts while heavy processes ran. Those executions remain failed timing evidence; no timeout or assertion was weakened. The isolated rerun passed all 271, followed by exact-head CI PASS.

## Visual review

Inspected representative public, Quote, checkout, account, wizard and tracking captures. The initial mobile How-it-works composition separated descriptions from their nodes; the application follow-up commit paired each title and description within its route step. Final captured Quotes clearly separate route, line items, tax, total, validity and response actions. Checkout distinguishes selection, proof and verification; synthetic test destinations are shown only in authorized checkout. Tracking uses actual authoritative completion counts, not invented progress.

Screenshots use public or run-owned synthetic records only. Browser chrome is excluded; no credential-entry step, raw capability, private proof URL, cookie or token is included. Empty login/signup forms are checked before capture. Some captures retain the focused skip link after accessibility inspection; this is intentional focus behavior.

Automated axe smoke is not WCAG certification. The [evidence index](evidence/launch-ux-stage2/index.json) identifies 17 representative files and SHA-256 hashes.

Bounded runtime log sample: 50 records in the last-hour window (requested cap 200); 45 carry response status 200 and five carry status 0 (not classified as HTTP success). The sampled output matched none of the JWT/secret-key/Bearer patterns. No raw logs are included; this is not an exhaustive log-privacy certificate.

## Remaining remediation / limits

- Complete the full hosted visual matrix for email-sent/confirmation, recovery, profile completion and loading/error/retry/empty/success states in both languages and all requested widths. The current suite proves representative journeys, not every listed state.
- Public signup presentation is captured, but a fresh external-mailbox confirmation was not repeated for this Stage 2 candidate. Previous Phase 7 acceptance remains historical evidence only.
- Consolidated account Orders/payment/completed-history data is not available in the current account projection. This candidate uses existing authorized journey links. Any projection expansion must be separately approved; no backend work is smuggled into this visual branch.
- No claim of exhaustive long-Arabic-text permutations or full assistive-technology certification is made.

Dependency security closeout remains PASS through documented scoped owner risk acceptance for the development-only braces advisory. It remains technically unresolved upstream; the audit is not described as fully clean.

## Cleanup and scope

First-run ledger cleanup passed; all 16 owned Auth identities and their scoped business/file/role fixtures were removed, temporary policy/configuration restored, and existing catalogues retained. Existing Customer/Quote-version/Order preservation digests matched the pre-run baseline (3/0/0). The owned automation credential was revoked and its reuse returned protection redirect 302. The second same-application evidence run also passed 10/10 and captured tracking in both languages at all five widths. Its ledger cleanup passed and its owned automation credential was revoked (reuse: 302). Final readback confirms zero automation credentials and unchanged protection. Preservation digests again match all three original Customers and the original Quote-version/Order baseline. Thus 20 successful case executions represent two runs of the same ten cases, not twenty unique cases.

Main remains `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`; develop remains `62ebec4228c50210af741023bb9c87b0364d2fb0`. No merge, Production, DNS, Hostinger, Stage 3 or Phase 8 work was performed.

Delivery evidence is a separate commit containing this report, screenshot index and test-only capture adjustment. Its exact SHA and CI are reported in the delivery response, avoiding a self-referential report SHA.

## Final decision

LAUNCH VISUAL & UX STAGE 2 PARTIAL — REMEDIATION REQUIRED

## Final remediation checkpoint — 2026-10-09

Release reconciliation: `d8e8868ffdc76e705e90623bceb7f04b6c717279` differs from deployed `fbd355aacc0952db9101d6fff6fe8a0e1c93d13a` only in report/evidence (17 PNGs and two JSON indexes) and one tracking capture test line. The exact file list is in `evidence/launch-ux-stage2-remediation/release-reconciliation.json`. The delivery HEAD was never treated as the deployed application SHA.

A subsequent read-only hosted identity matrix captured 50 cases: signup initial, login, recovery request, native required-field validation, and missing/invalid confirmation callback, each AR/EN at 360/390/768/1280/1440. No fixture or business mutations occurred. Overflow and axe checks passed, but invalid callback feedback was absent in all ten locale/width combinations. This is historical PARTIAL evidence, not a full matrix PASS. The owned automation credential was revoked and rejected with 302.

The smallest required application correction adds a fixed, localized failed-email-link notice on Login. Existing successful confirmation/recovery destinations, code exchange, role routing and permissions are unchanged; no provider message, code, token or arbitrary query value is echoed. Eight callback regression tests verify missing/rejected and successful flows in both locales. Existing login-routing tests now supply the framework search-parameter prop and still assert authenticated redirects before a form can render. Full local unit/integration rerun: 279/279 PASS. Build/types PASS. Full E2E/CI and redeployment remain pending at this checkpoint, and the original Preview still represents fbd355a until replacement is independently verified.

The owner's first proposed mailbox already existed and was preserved. The replacement mailbox's read-only pre-signup check returned zero Auth/profile/Customer/membership/role records. No public signup, admin link generation, confirmation or bootstrap was performed. Password and mailbox steps await the owner on the final reviewed Preview. The overall Stage 2 decision remains PARTIAL.

Local remediation rerun completed: 279 unit/integration, 40 E2E (two workers, original assertions/timeouts), fresh 46-migration reconstruction, seven SQL/RLS suites, exact official types and all six concurrency suites PASS. Earlier failures are retained: missing search-parameter input in the unit harness; old exact redirect expectation in E2E; concurrent local load/timeouts and streamed-title readiness; stale local test functions and inherited database-password environment. Harness inputs/expected fixed notice were corrected; no authorization assertion, axe rule or timeout was removed. Production/Staging credentials were not changed. Final exact-head CI and hosted replacement remain required.

## Remediation continuation — 2026-10-09

Current application SHA: `23c3ab7d22b3f103069f852010b2b0fba2aaaf72`. Both required jobs in [CI 37900983354](https://github.com/Rmdn96/Naql365/actions/runs/37900983354) PASS. The protected Preview now represents this exact application, deployment `dpl_3DZmJNfNZUZCu7hBbNgMbEZUwCff`; it supersedes the earlier application only after the localized callback-feedback correction. No further application change was made during this continuation. The 46 migration files remain identical to accepted develop.

The repeated five-state hosted matrix passes 50 locale/width cases (AR/EN; 360/390/768/1280/1440), including visible invalid-confirmation guidance. All indexed captures have verified SHA-256 hashes, zero page overflow and zero axe violations. See [remediated capture index](evidence/launch-ux-stage2-remediation/remediated/index.json). Representative Arabic 360px and English 1280px captures were visually inspected. This is five states, not completion of the entire requested state matrix or WCAG certification.

The matrix's immediate post-revocation probe returned 200 despite API revocation. That failed protection probe is retained historically. A separately scoped read-only propagation probe observed 200 immediately and denial 302 after five seconds, with zero remaining automation credentials and unchanged protection. Revocation verification now waits a bounded interval for denial rather than treating API revocation alone as sufficient.

The next business run was interrupted before its final summary/cleanup. Its log contains an SA guest timeout at helpers.ts:115; neither that failure nor the unfinished suite is represented as PASS. Recovery verified that the owning process was absent, selected precisely its ledger's 16 synthetic identities and isolation organization, reused the existing cleanup sequence, and restored the documented Staging guest quota. The associated uniquely identified automation credential was revoked; reuse was denied with 302. The same-application business retry completed 10/10 PASS, including both guest delivery journeys, registered Customer/manual-pricing, Finance, Driver, capability isolation and AR/EN SUPER_ADMIN session/logout/Back regression. Scoped fixture cleanup passed; the owned automation credential was revoked and reuse returned 302. See evidence/launch-ux-stage2-remediation/hosted-business-retry.json. The earlier failed/interrupted attempt remains historical.

The original three Customer records still match the original aggregate digest exactly; original Quote-version and Order counts remain zero. A fourth Guest Customer predates this interrupted run and is outside its fixture ledger. It was preserved, not deleted or attributed to this run; consequently the old all-Customers aggregate check differs and is not reported as PASS. No owner record was altered by recovery.

Read-only zero-state for the owner's newly selected external mailbox remains Auth/profile/Customer/membership/role = 0. The public registration page is ready, but owner password entry, submission and delivered-email confirmation have not yet occurred. No administrator confirmation/link generation or identity bootstrap was substituted. Overall decision remains LAUNCH VISUAL & UX STAGE 2 PARTIAL — REMEDIATION REQUIRED.

Owner public signup progressed on 2026-10-10: public submission and localized email-sent guidance were observed. Read-only state moved from all zero to one unconfirmed Auth identity and one profile, with zero Customer/membership/role rows. Five safe Arabic email-sent captures at all required widths are indexed under evidence/launch-ux-stage2-remediation/owner-public-signup/. Visible email/password fields were cleared before capture; no tokens, cookies or mail links were collected. Actual received-link confirmation remains pending owner action; no admin confirmation or generated link was used.

Real mailbox confirmation attempt — 2026-10-10: the owner opened the delivered message and the identity became confirmed. Readback: Auth=1 confirmed, profile=1, Customer/membership/role=0. The browser landed on the historical l2et1jst5 Preview, so this is a wrong-destination failure, not a current-candidate confirmation PASS. Live config diff confirmed the repository Staging redirect list matched the hosted setting and contained only the old origin. The current application correctly requests its APP_URL callback, but that URL was missing from the Staging allowlist. The prior fixture-based business tests bypass email delivery and therefore did not exercise this configuration boundary. Four exact current-Preview AR/EN confirmation/recovery callbacks were added and read back; old callbacks and Site URL were retained, no wildcard introduced, no Production setting touched. This is Staging configuration only; deployed application bytes remain 23c3ab7. Actual confirmation on the corrected configuration still requires a fresh-mailbox public flow; the confirmed owner account was preserved and normal login can test its canonical bootstrap separately.

Normal password login on the corrected current Preview succeeded for the confirmed owner identity. The account renders initial onboarding and the public header recognizes the session. Direct /ar/login redirects to /ar/account. Empty onboarding captures cover AR/EN at all five widths without overflow. Customer/membership/role remain zero before profile submission, consistent with the existing transactional onboard_customer operation invoked by Save profile. Profile persistence, canonical membership and second-login checks remain pending; no manual database provisioning was performed. Browser access became unavailable before the refresh check, which is not claimed as PASS.

Owner profile-save readback confirms exactly one confirmed Auth identity, complete profile, ACCOUNT Customer, active customer membership and canonical CUSTOMER role in the enrollment organization; zero staff/driver roles. The owner-visible save URL was the historical Preview, so current-candidate profile submission is not claimed. The current Stage 2 Preview independently recognizes the saved account, survives refresh, denies staff portal access, redirects authenticated /en/login to /en/account, and after explicit logout denies /ar/account by redirecting to Login. Second password login remains pending. No private profile values were recorded.

Second normal password login on the current Preview passed. Read-only canonical counts remain exactly one confirmed Auth identity/profile/Customer/active CUSTOMER membership/CUSTOMER role and zero staff/driver roles. Account renders normally and its Request link reaches the authorized Market-selection entry. No Request draft was created during this check; full wizard completion is not claimed for this owner identity. This proves login idempotency, but does not replace the outstanding corrected-origin fresh email-confirmation gate or remaining full state matrix.

Replacement external-mailbox flow on the corrected Stage 2 origin: read-only zero-state preceded public signup. The owner completed actual delivered-email confirmation on the current Preview, saved the profile there, and performed two normal password logins. Readback after the second login confirms exactly one confirmed Auth identity, complete profile, ACCOUNT Customer, active CUSTOMER membership and canonical CUSTOMER role in the enrollment organization, with zero staff/driver roles and no duplicates. No admin confirmation, generated link or direct provisioning was used. Refresh, AR/EN navigation, authenticated direct-login redirect, Request entry, staff-portal denial and explicit logout/protected-account denial were observed. Evidence: owner-public-signup/replacement-*.json. Owner records are preserved; no Request draft was created in these checks. A subsequent responsive account screenshot attempt failed at browser capture and is not counted as visual PASS. The remaining full visual/state matrix is still incomplete; overall Stage 2 remains PARTIAL.

## Visual matrix closeout checkpoint — 2026-10-10

Real-mailbox Customer gate and second-login/idempotency are PASS, accepted and closed by the owner. They were not repeated. Application SHA remains `23c3ab7d22b3f103069f852010b2b0fba2aaaf72`; no application or migration changes occurred. Evidence/tooling changes are uncommitted, so there is no new delivery SHA or exact-head CI claim yet.

The prior capture failed inside the in-app browser screenshot operation before evidence writing. Classification: browser/test-runner issue; the tool returned no lower-level diagnostic, so a precise internal browser cause is not established. Protected Playwright captures now work on the same application. Historical failure remains in capture-failure-diagnosis.json. An initial deterministic-run failure selected a hidden framework input for focus and expected alert rather than status on recovery success; both test selectors were corrected. Neither failure is relabeled PASS.

The new deterministic matrix defines 31 states × 2 locales × 5 widths = 310 combinations. Current index: `evidence/launch-ux-stage2-matrix/index.json`. 140 combinations passed automated capture/hash, direction, overflow, focus and axe smoke; zero N/A entries; 170 missing combinations correctly fail the completeness command. This is not complete visual acceptance or WCAG certification. Representative Arabic 360px login/profile-error and English 1440px recovery-success images were inspected; exhaustive clipping/overlap review is pending.

Public batch: 16 tests/80 captures PASS. Synthetic identity batch: one scenario/60 captures PASS, covering onboarding, its confirmation landing (not a new email-flow claim), profile validation/success, empty account and authenticated password form (no password mutation). The existing ledger cleanup removed the run-owned fixtures and retained catalogues. Both scoped automation credentials were revoked, reuse returned 302, and final readback found zero automation credentials with all_except_custom_domains protection. The retained real Customer was not used or modified.

Changed tooling formatting, lint and strict TypeScript PASS. Tracked/history secret scans PASS before final additions; a final scan including new evidence remains required before commit. All 46 migrations remain unchanged. Remaining states include signup email-sent normalization, Request/loading/review states, populated account, Quote, Checkout and Tracking matrix coverage. No N/A substitutions were invented. Final decision remains LAUNCH VISUAL & UX STAGE 2 PARTIAL — REMEDIATION REQUIRED.

## Matrix resume checkpoint — Batch A complete

Application SHA remains `23c3ab7d22b3f103069f852010b2b0fba2aaaf72`. The original 140 entries were preserved. Batch A added 50 captures, completing all 60 Request/Account combinations (including ten previously accepted empty-account entries). Hash/index validation: 190 PASS, zero N/A, 120 missing out of 310. Batch A fixture cleanup completed and the owned automation credential was revoked; reuse returned protection redirect 302. See `evidence/launch-ux-stage2-remediation/batch-a-cleanup.json`.

Batch B did not start: its first read-only deployment lookup failed. Safe diagnostics reproduce ENOTFOUND for api.vercel.com, registry.npmjs.org and the accepted Preview hostname from this runner. This is a runner DNS/network failure, not evidence of an application defect; the underlying resolver cause is not established. No Batch B credential, identity, business record or Storage object was created because execution stopped before those operations. The failed attempt is retained in `batch-b-infrastructure-failure.json` and is not relabeled PASS. Current live protection cannot be freshly rechecked while the runner cannot resolve Vercel.

Test-only Batch B TypeScript correction passed strict TypeScript; no application source or migration changed. No new delivery commit or exact-head CI is claimed. Real-mailbox and second-login/idempotency gates remain accepted PASS. Remaining 120 entries and final delivery checks are still required.

LAUNCH VISUAL & UX STAGE 2 PARTIAL — REMEDIATION REQUIRED

## Matrix continuation — 2026-10-11

Network access initially recovered in the unrestricted runner: DNS succeeded for the exact Preview, Vercel API and npm registry; HTTPS returned 302/308/200 respectively. Vercel readback confirmed zero automation credentials and unchanged Preview protection before restarting. The prior interrupted run never reached fixture creation. No application/network configuration changed.

Batch B added 60 captures: Quote loading/final/rejected and Checkout selection/pending/retry, each in both locales and all five widths. One scenario passed; the transfer lifecycle timed out clicking the second upload after capture navigation. The test lacked an enabled-state wait before setInputFiles on the hydration-guarded control. The harness now waits for that control; corrected reupload has not yet been rerun, so resolution is not claimed. The historical failure remains in batch-b-first-attempt.json. All owned fixtures were cleaned; credential revocation was verified by a denied 302 reuse attempt.

The runner then switched back to restricted-network mode, and all three DNS probes again returned ENOTFOUND. No additional mutating suite started. This runner-policy transition explains the observed access boundary; no application or Vercel protection defect is established.

Current matrix: 250/310 PASS, zero N/A, 60 missing. Accepted 190 capture hashes remain unchanged. Batch A remains 60/60; Batch B is 60/70. Remaining: payment confirmed (10), Tracking (40), signup email-sent presentation (10). See matrix-resume-20261011.json and launch-ux-stage2-matrix/index.json. Representative narrow Arabic Quote and English Checkout captures were inspected without a new visual defect.

Application remains 23c3ab7d22b3f103069f852010b2b0fba2aaaf72; 46 migrations unchanged. Real-mailbox and second-login/idempotency remain accepted PASS. Test-only Batch C preparation and the Batch B hydration wait are pending hosted validation. No new delivery commit or CI claim. No merge, main, Production, DNS, Hostinger, Stage 3 or Phase 8 changes.

LAUNCH VISUAL & UX STAGE 2 PARTIAL — REMEDIATION REQUIRED

## Final visual matrix closeout — 2026-10-11

The acceptance runner was stabilized for the remaining execution. Bounded preflight confirmed DNS and HTTPS reachability for the exact protected Preview, Vercel API, and npm registry. The prior ENOTFOUND interruptions and the direct-fetch Vercel bypass preflight failure remain historical evidence; neither changed application behavior.

C1 Payment Confirmed: PASS, 10/10 captures. The test-only hydration wait was validated before file upload; no application source change was required. C2 Tracking: PASS, 40/40 captures using authoritative run-owned SA order/trip progression, including loading, active, completed and safe empty/error states. C3 Signup Email-Sent: PASS, 10/10 nondisclosing UI captures using a run-owned synthetic existing identity; the accepted real-mailbox confirmation gate was not repeated.

Final matrix validation: **310/310 PASS, 0 N/A, 0 missing, 0 failed** across Arabic/English, RTL/LTR and 360/390/768/1280/1440 widths. Every screenshot hash and application SHA was verified; the matrix completeness assertion passed. Existing 250 captures were not regenerated. Automated checks covered overflow, direction, axe smoke, focus and sensitive-content guards. This is not a claim of full WCAG certification.

Each sub-batch completed scoped cleanup. Temporary automation credentials were revoked after C1, C2 and C3 and reuse returned protection redirect 302. Final Vercel readback reports zero automation credentials and all_except_custom_domains protection. No fixture identities, business records or Storage objects from these runs remain; owner records and catalogues were preserved.

Application SHA remains 23c3ab7d22b3f103069f852010b2b0fba2aaaf72; migration count remains 46 and no application or migration file changed. Real-mailbox confirmation and second-login/idempotency remain PASS. Test/evidence delivery changes are ready for final secret scan, commit and exact-head CI.

## Final decision

LAUNCH VISUAL & UX STAGE 2 PASS
