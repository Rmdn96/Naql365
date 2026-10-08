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
