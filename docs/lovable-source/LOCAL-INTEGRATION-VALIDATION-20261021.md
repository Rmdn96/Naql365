# Local validation — 2026-10-21

Historical checkpoint. Superseded by [final stabilization and acceptance](FINAL-STABILIZATION-20261021.md). Earlier failures and restrictions below describe their recorded state; preserve them as history.

INCOMPLETE. Preserve uncommitted integration; no commit or push until final verification passes. This supersedes the old missing-local-backend blocker.

## Source and environment

- Branch feature/lovable-source-integration, starting/current HEAD b33693ef8da42dd216fae6b8bc8a295b0ffe4417.
- Original Design Lab 2997c92bb5b00dfbf15ae0d1ccdb289d47c4d891; nine source-file hashes in import-manifest.json match its clean Windows checkout (text hashes include checkout line endings).
- Existing owner-managed Next server http://127.0.0.1:3000; isolated Supabase http://127.0.0.1:55321. Ignored .env.local retained. Anonymous cart returns 401, not missing-configuration 500.
- Temporary reference server on 4173 stopped; its generated route file restored. Original source and canonical application worktrees remain clean. Owner server not stopped/restarted.

## Working-tree integration

Original Commerce header/hero/search/categories/product cards/gallery/cart drawer/badge/mobile navigation use canonical services. Original checkout stepper/address/payment-radio/summary layout wraps unchanged contracts, calculations and commands. Customer dashboard/order list uses source navigation/record cards and canonical queries. Staff catalog uses source administration shell with existing permission-scoped editors. Actual order events replace fictional milestones.

Restored original commerce/staff navigation tokens, source theme-control order and RTL arrows. Product cards now retain approved bilingual image alt metadata. Category images come from their matching category. Owner approved a minimal contrast exception: primary action buttons use the source light-theme blue in dark mode. Both unchanged source and integration had 3.65:1 white-label contrast; accessibility assertions remain enabled.

No demo payments, fictional commercial records, new backend, migration or pricing defaults imported.

## Test evidence

- Production build after current application edits: PASS, Next.js 16.3.8.
- TypeScript, ESLint, focused formatting: PASS.
- Focused presentation/cart/SSR/management suite: 39 PASS; adapter plus Transport UUID regression: 3 PASS; new actual imported-component SSR tests: 3 PASS. Subsequent affected five-file run: 16 PASS (overlapping tests, not additional unique coverage).
- Store catalog, catalog-management and purchase SQL integration suites PASS. Security suite initially timed out during parallel database setup; isolated rerun passed all 5 assertions without timeout changes.
- Bilingual homepage/Store E2E: 8/8 PASS. Temporary mobile config initially omitted isMobile; corrected config passes with assertions retained.
- Commerce runs store-local-1792579842821 and store-local-1792580762972: 8/8 PASS. Latter adds customer dashboard, customer catalog-write denial, Staff catalog shell, product detail and order-list checks.
- Latest Commerce store-local-1792581384543: FAIL after four groups, route assertion while at /en/store/checkout. Final browser verification is not completely green.
- Broad Store store-local-1792581119303: 11 groups PASS, including new product management, versioned retail, approved media, immutable order snapshots, checkout, private proofs, Finance verification and separate supplier delivery. Final Staff login redirect assertion failed; navigation to /en/portal was pending. Root cause unproven. Added explicit navigation wait, no sleeps/custom timeout increase.
- Final sequential Store store-local-1792581509920: FAIL waiting for newly created synthetic product heading. Commerce was not started after that failure. No speculative application fix made.
- All reported fixture runs completed cleanup and deleted-credential reuse denial.
- All 51 migration blobs unchanged. Migration 51 SHA256: 7acd143c5e5a3d35ef9f6633bd26e7c346d5c42d93fdbfe6a398546c0ab99d22.
- Secret-pattern scan of 4496 tracked/untracked non-ignored files: zero findings at scan time; not a security certification.
- npm production audit: zero known advisories. Full audit: six High affected development packages (braces, micromatch, fast-glob, @next/eslint-plugin-next, eslint-config-next, vite), not remediated.

## Visual evidence

test-results/lovable-paired/pairs.json and PNGs contain 30 homepage pairs: 1440/1280/768/390/360, AR/EN, light/dark/system (system resolves light). Header/hero dimensions match; no horizontal overflow recorded. Real Store captures also cover gallery, checkout, under-review and delivered orders, reconciliation.

Not blanket pixel-perfect approval: original uses fictional catalog data; canonical uses approved synthetic fixtures or empty/paused data. One pair overlapped fixtures; later token/RTL corrections postdate some captures. Equivalent-state paired checkout/customer/Staff/drawer review remains incomplete. Dev indicator and authority-driven content differences must be recorded separately from layout defects.

## Remaining gates

1. Capture bounded product-create response/refresh and late Staff redirect evidence; distinguish timing from functional/session failure without speculative Auth changes.
2. Obtain clean sequential Store + Commerce results on final working tree.
3. Finish final equivalent-state visual comparisons of authenticated surfaces.
4. Complete diff/provenance review and commit only after these gates. Hosted CI: NO-GO.

No push, merge, deployment, alias change, cloud database access/write, migration, real product/Store activation or payment configuration performed.
