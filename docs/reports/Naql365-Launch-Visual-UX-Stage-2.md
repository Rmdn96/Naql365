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

## Verification checkpoint

- Local build and strict TypeScript passed during implementation.
- Local E2E: 40 passed (36 existing plus four Stage 2 locale/device cases).
- Local database: fresh reconstruction, official generated types unchanged, seven SQL/RLS suites passed.
- Full unit/integration initially hit existing 30-second timeouts while heavy local processes ran; this is retained as failed execution evidence, not a PASS. Final rerun pending.
- Remaining gates: final source quality/build, full unit/integration, concurrency, secret/history scans, exact-head CI, protected hosted customer/guest regression, safe screenshots and visual inspection, logout/session, cleanup.

Automated accessibility checks are not WCAG certification. No hosted acceptance claim is made at this checkpoint. Existing scoped owner acceptance of the development-only `braces` advisory remains unchanged; it remains technically unresolved upstream.

## Evidence

The hosted suite must use run-owned synthetic fixtures and its existing ledger cleanup. Capture no credential fields containing values, cookies, JWTs, guest capabilities, confirmation tokens or private file URLs. Application and documentation SHAs, CI links, screenshot index, cleanup and limitations will be recorded after execution.
