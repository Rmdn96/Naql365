# Local server resume — 2026-10-21

Historical checkpoint. Superseded by [final stabilization and acceptance](FINAL-STABILIZATION-20261021.md). Earlier failures and restrictions below describe their recorded state; preserve them as history.

Status: INCOMPLETE / NOT READY FOR COMMIT OR HOSTED CI.

Branch: feature/lovable-source-integration.
HEAD remains b33693ef8da42dd216fae6b8bc8a295b0ffe4417. All existing uncommitted integration work preserved.
Original design: 2997c92bb5b00dfbf15ae0d1ccdb289d47c4d891. Nine recorded source hashes match; hero bytes unchanged.

## Proven cart failure

Owner-started server at http://127.0.0.1:3000 was used. No server was started or stopped by this investigation.
GET /api/store?kind=cart returned 500 with the generic internal error response.
Temporary bounded server-side instrumentation at createSupabaseServerClient recorded:

- public Supabase URL present: false;
- public publishable key present: false;
- public configuration validation: rejected.

The failure occurs before auth.getUser or a database RPC. This is missing local process configuration, not a demonstrated authentication/database defect. No credential values were captured. Instrumentation was removed and both shared infrastructure files have no diff.

Required action: configure the existing dev process with the isolated local Supabase URL and publishable key and restart it manually. Do not use cloud Staging/Production for these mutation tests. APP_ENV=local and APP_URL=http://127.0.0.1:3000 remain required. Do not share secrets in chat.

The API error has NOT been suppressed or relabelled as success. The imported cart now distinguishes loading, guest, unavailable and ready states. A failed read no longer presents an empty successful cart. A guest is offered the canonical login route.

## Local changes in this resume

- Explicit cart read states and unknown-count badge; existing cart writer and authority preserved.
- Restored original cm-search class, fixing lost mobile grid placement.
- Scoped original Tailwind button-reset defaults to imported UI.
- Category/search/cursor URL propagation, server initial filters and next-page navigation.
- Approved public specifications and localized gallery alt text.
- Original hero uses eager/high-priority loading and 100vw responsive sizing, without changing its image or composition.
- favicon.ico derived from the original Brand SVG paths and original light-theme primary color. HTTP 200, image/x-icon.
- Checkout/order routes retain imported chrome around existing guarded StoreExperience; the complete original checkout form/dashboard/Staff visual adaptation is NOT finished.
- Adapter regression tests check query preservation and exclusion of private supplier fields.

## Verification

- 38 focused tests across nine files PASS (Transport UUID, cart, home diagnostics, Store SSR/totals/presentation, admin presentation and new adapter).
- TypeScript PASS; focused ESLint and formatting PASS.
- Final production build PASS, including the final route wrapper.
- Secret-pattern check includes tracked and untracked non-ignored files: PASS (4493 files at scan time). This is a pattern scan, not a security certification.
- All 51 migration files byte-identical to baseline.
- Migration 51 SHA256: 7acd143c5e5a3d35ef9f6633bd26e7c346d5c42d93fdbfe6a398546c0ab99d22.
- 30 current integrated homepage captures: ar/en x 1440/1280/768/390/360 x light/dark/system. Header/search bounds, Transport CTA and configured WhatsApp route PASS. System used the browser's light preference.
- Actual unavailable cart presentation PASS.
- Initial screenshot attempt using networkidle timed out. It was replaced by explicit DOM/image conditions; no assertion timeout increase or sleep was added.

Screenshots in local-smoke/ are integrated-side evidence ONLY. They are not a completed paired visual comparison against the original source, and do not prove populated-product or authenticated UI fidelity. Earlier captures were replaced after the proven search class correction.

## Remaining work and gates

1. Configure isolated local backend for the existing server; verify its local identity before any fixture mutation.
2. Complete original checkout, customer dashboard and Staff presentation adaptation.
3. Paired original/integrated captures in equivalent authorized synthetic states; inspect drawer, product, checkout and customer/admin screens. Current screenshots are insufficient to approve exact fidelity.
4. Real authenticated Commerce 8/8, customer isolation, checkout and cleanup/credential denial. Not run because the current app process has no backend configuration. Existing harness would start another app server, which this task prohibits.
5. Final complete diff/provenance/security review and commit only after requested verification succeeds.

No push, merge, migration, cloud writes, deployment, activation or paid resource. No integration commit created.

Current npm audit: Production dependencies 0 advisories; full tree 6 High affected development packages (@next/eslint-plugin-next, braces, eslint-config-next, fast-glob, micromatch, vite). No dependency remediation performed in this resume.
