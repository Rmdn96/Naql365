# Unified Staff and Store Admin — Phase 5

## Source and scope

Baseline: `3df7069445a2b84677c0d81e8dbc5005a3ba1fe5` (Next.js 16.4.1). Implementation branch: `feature/unified-design-system-phase-5`.

Approved visual source: `Rmdn96/naql365-design-lab@2997c92bb5b00dfbf15ae0d1ccdb289d47c4d891`. File hashes and technical adaptations are recorded in `STAFF-SOURCE.json`; all actual routes and unsupported preview concepts are listed in `STAFF-ROUTE-MAPPING.md`.

The original Staff shell, table, state, spacing and responsive CSS is imported in `staff-source.css`. `staff-admin.css` bridges only the Staff family to the centralized Phase 1 tokens and canonical form structures. Original Lucide icons and the official shared Brand/BrandMark are reused. Customer, Auth, Transport and Driver presentations are unchanged.

## Implemented presentation

- Role-filtered Staff sidebar, mobile dialog and navigation; existing organization/Market identity, locale, theme and logout controls retained.
- Shared dashboard/page headings; original queue-table structure for Sales with all original fields, latest-status selection and review links preserved.
- Shared Staff surfaces, forms, filters, operational tables, Finance/private-proof views and Store operational pages use the same scoped palette and focus treatment.
- Existing Store catalog navigation, product/category drafts, A/B/C pricing, supplier/policy grants, publication/media controls and versioned actions remain authoritative. The existing real catalog is reused.
- Loading, safe error and unavailable membership states adopt the original Staff state language. Unavailable membership displays the official brand and no operational navigation.
- Explicit RTL/LTR attributes ensure the correct Arabic/English fonts. Canonical theme selects retain full localized labels instead of inheriting the source Market-select width.

No demo role/state selector, simulated Finance action, fictional catalog, unsupported route or new authority is imported. No service, API, RPC, domain, Auth action, Store command, RLS helper, migration or database type changes.

## Accessibility and compatibility corrections

Legacy Staff CSS used `--muted` as text ink; the Lovable contract uses it as a surface. The adapter keeps those meanings separate. Dark-theme links and selected Store tabs use approved text tokens with sufficient contrast; primary actions keep the previously approved contrast correction. Logo geometry/colors and the approved layout composition are retained.

The Staff browser's Support-denial check selected the obsolete error-panel CSS class. It now requires the localized alert heading inside the workspace and still requires zero support records. Its sanitized diagnostic uses the same semantic boundary. No permission assertion, timeout or retry was relaxed.

## Local acceptance evidence

Evidence is outside Git: `deliverables/naql365-staff-phase5-20261023/` at the workspace root.

- Full unit/integration: **497/497 PASS**, including the Transport UUID and bilingual CustomerAccount regressions. New checks cover state semantics, queue accessibility/escaping and locale attributes.
- Unchanged generic E2E: **90/90 PASS**, one worker, zero retries.
- Staff: all six roles × AR/EN, 60 responsive captures, normal login/refresh/logout, effective modules, denied routes, Market/Finance boundaries, keyboard drawer, axe and owned cleanup PASS.
- Store: **13/13 PASS**, including dynamic product management, price/media operations, snapshot preservation, customer/proof isolation and cleanup/credential reuse denial.
- Commerce: **8/8 PASS**; approved RPC/SSR/DOM product count **1/1/1**, cart/checkout/isolation/paused denial and cleanup/credential reuse denial.
- Local PostgreSQL 17: **12/12 original native SQL/RLS assertion bodies PASS**, rollback transactions. The local stack lacks pgTAP display functions, so only plan/pass/finish display calls are omitted; no assertion body is weakened. No new local pgTAP total is claimed.
- All eight concurrency suites and full 209-assertion pgTAP result are reused from exact-baseline Foundation CI **39882075608**. Database/command/security contracts are unchanged; the owner-managed local database is not treated as a disposable concurrency target.
- Production build PASS. TypeScript, ESLint, formatting, source/history secret scans and integrity evidence are retained externally.
- Fresh dependency audit: **0 runtime findings**. Existing development-only findings remain **8 packages: 6 High / 2 Moderate**. Braces is not remediated. Dependencies and lockfile are unchanged.

## Visual evidence and deliberate differences

- **108 original-source captures** from the unchanged approved Lovable checkout; its generated routing bytes are restored and source cleanliness verified afterward.
- **208 before/after captures** (104 per phase), covering dashboard, queue table, catalog, forms, orders, loading/empty/error/unavailable states and mobile drawer.
- AR/EN, RTL/LTR, Light/Dark/System; dashboard/catalog cover 360, 390, 768, 1280 and 1440px. Other states use representative mobile Dark and desktop Light/System captures. System screenshots use the OS dark preference; unchanged generic tests cover System preference behavior.
- **102 updated page-state axe scans: zero violations**. Mobile drawer focus/visible-focus checks pass in both phases and both languages.
- The local `VISUAL-COMPARISON.html` indexes matching baseline/integrated/original views. Real local Staff/Store/Commerce screenshots are separate from synthetic component-only comparisons.

Pixel equality is not claimed. The reference includes design-lab controls and placeholder data. Canonical pages retain required real fields, references, permission-filtered modules, native preference controls and independent guarded detail routes. Those are functional/security differences, not substitutes for the approved visual identity.

No standalone user/role administration, report, warehouse or supplier-portal routes exist in the baseline. They are not invented. Full Driver migration remains Phase 6.

## Hosted verification and release boundary

Foundation CI adds the Staff presentation harness and its failure artifacts. The harness supports standalone CI mode without a neighboring baseline checkout; local before/after comparisons opt into the exact accepted baseline. Existing workflow timeouts, permissions, pinned actions and assertions remain unchanged.

Final local commit identity, exact check receipts and any observations are recorded in the external acceptance report. Hosted CI requires separate exact-SHA push authorization. No deployment, cloud database operation, role/account change, Store activation, payment configuration, merge or DNS/Hostinger operation is authorized or performed.
