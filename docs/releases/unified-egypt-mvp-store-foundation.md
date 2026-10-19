# Unified Egypt MVP — Migration 50 local delivery

## Baseline and boundary

Database implementation: `62daa53d3d04c1c22fb10a1c8fb55bfd9a302dd7`.
Canonical application implementation: `6f96b4eec048c1835da589fb6470a6f68f256f02`.

Branch: `feature/unified-egypt-mvp`. Accepted starting delivery:
`6ab494c7dc703bba6f2e3f0afb8796b3791ed13d`.
Its accepted hosted runs were Foundation `39177849686` and database types
`39177849680`; those are baseline evidence, **not CI for this new change**.

This delivery is local only. No push, PR, merge, deployment, cloud DDL/DML,
real destination configuration, product publication or automatic permission
grant occurred. Staging and Production remain untouched. Store remains inactive.

Migration: `20261019000100_store_purchase_fulfillment.sql`.
SHA-256: `179c4b9aca3e097146fe0638453efd24b73cf05b7b06954d748547f74081e3b6`.
All 49 accepted predecessor migration files remain byte-identical.

## Delivered capabilities

The [implementation contract](unified-egypt-mvp-store-contract.md) describes
the ten private tables, five public RPCs, six permission definitions with zero
grants, private proof bucket, immutable commercial snapshots and M49 typed
receipt-registry extension. The implementation includes:

- Approved EG catalog/category/search and product detail; no fabricated stock.
- Registered Customer cart, version-safe/idempotent checkout and owned history.
- Independent CASH/Vodafone Cash/InstaPay obligations and protected proof flow.
- Explicit Finance receipt verification; shared Transport/Store uniqueness.
- Separate supplier execution, cancellation/return requests and whole-order returns.
- Verified supplier cash collection, contractual entitlements/receivables,
  manual partial settlement/refund recording and linked reversals.
- Pending/unknown outcome protection; no external payout or gateway execution.
- Narrow catalog, order, Finance and reconciliation workspaces; existing themes,
  localization, membership authority and Transport implementation reused.

Customer DTOs exclude supplier costs, margins and internal reconciliation facts.
Store administration requires explicit Store grants, not Transport role labels.
Missing supplier/pricing/policy/delivery/tax authority fails closed.

## Verification evidence

| Gate                                | Result                                                                  |
| ----------------------------------- | ----------------------------------------------------------------------- |
| Local PostgreSQL 17 reconstruction  | All 50 migrations applied locally                                       |
| SQL/RLS                             | 173/173 PASS across 11 files, including existing Transport suites       |
| Generated public database types     | Official local Supabase CLI output, trailing whitespace normalized only |
| Independent Store concurrency       | 5/5 PASS; disposable database independently verified absent             |
| Local authenticated browser journey | 6 grouped checks PASS; 6 synthetic captures                             |
| TypeScript / ESLint / formatting    | PASS                                                                    |
| Tracked secret scan                 | PASS, 4,375 files at implementation preparation                         |
| History secret scan                 | PASS, 2,062 text blobs at implementation preparation                    |
| Full unit/integration               | 383/383 PASS, 77 files, serial run 182.28 seconds                       |
| Full E2E                            | 64/64 PASS, desktop/mobile, 2.5 minutes                                 |
| Optimized production build          | PASS; local artifact only, no deployment                                |
| Hosted exact-head CI                | Not run; feature-branch push requires separate authorization            |

The real local browser journey used normal Supabase password login, approved
synthetic catalog/contract, cart, Vodafone Cash selection, normalized private
proof upload, unverified review state, independent Finance verification and
separate supplier execution through delivery. Another Customer was denied
access. Refresh and direct-login session recognition passed for Customer and
Staff. No simulated successful financial commands were used.

Risk-based captures covered English catalog/light/1280, checkout/dark/390,
review/System-dark/1280, Arabic delivery/dark/360 and light/1280, and Arabic
reconciliation/System-dark/390. Keyboard focus, page overflow and scoped axe
smoke passed; this is not WCAG certification or hosted acceptance. Local
artifacts: `test-results/store-local-1792388958378/` (hash index and ledger),
`test-results/store-purchase-concurrency/result.json`.
The six captures and sanitized indexes are preserved in
`docs/evidence/unified-egypt-mvp-store-local/`; all six SHA-256 values were
independently rechecked before preservation. Evidence was captured from the
uncommitted implementation subsequently committed as the application SHA
above; its recorded baseline SHA is not misrepresented as the final commit.

Concurrency tested identical checkout replay, different mutation IDs on one
cart, two Store payments competing for one receipt, actual Transport versus
Store verification, and revoked staff authority. SQL/security suites cover
three payment methods, stale commercial versions, missing/revoked/ambiguous
membership, organization/Market/Customer/Driver denial, private cost/table
protection, independent collection, unknown outcomes, reversal/refund and
history access after storefront withdrawal.

## Reproduction commands

Use only a disposable local Supabase stack with all 50 migrations. This run used
PostgreSQL 17 and local API/DB ports 55321/55322 via the existing temporary
workdir; no linked cloud reset or cloud migration command was used. The CI
workflow runs the equivalent local reconstruction and official type generation.

```text
npm run test:unit -- --maxWorkers=1 --no-file-parallelism
npm run lint
npm run typecheck
npm run format:check
node scripts/verify-store-catalog-migration.mjs
node scripts/test-store-purchase-concurrency.mjs
node scripts/test-store-workspace.mjs
npm run build
npm run test:e2e -- --workers=2
npm run check:secrets
node scripts/check-secret-history.mjs
```

The authenticated Store harness builds against local Auth/Storage and cleans
its ledger-owned fixtures. The general E2E suite uses a separate local build
with no backend configuration. Do not reuse that artifact as a Staging build.

## Failed and interrupted development attempts

These attempts are historical, not relabelled successful runs:

- A local SQL text-edit replacement expanded JavaScript replacement tokens;
  the file was repaired before successful reconstruction.
- An early generic trigger referenced a field absent on some tables; fixed
  with table-specific checks and reconstructed again.
- A denial test reused an aborted transaction; fixed with a savepoint without
  relaxing the denial assertion.
- A concurrency attempt overlapped local database reset; rerun separately.
- Cross-service concurrency fixtures initially used a stale Transport revision
  and omitted required confirmation fields; corrected to use the real command
  contract, retaining unique-winner assertions.
- Initial lint rejected JSX constructed in a try/catch. Loading/error capture
  was separated from rendering; no lint rule was disabled.
- Browser axe found inherited dark-theme link/eyebrow contrast errors. Scoped
  semantic-token CSS fixed them; the real browser journey then passed.
- A full unit rerun contended with builds on the 8GB machine and hit existing
  timeouts; stopped and rescheduled with lower concurrency, without changing
  assertions or timeout configuration.

## Cleanup and security

The browser ledger records cleanup PASS and deleted-credential reuse denial.
Owned proof objects, application fixtures and six local synthetic identities
were removed; independently queried Store table counts returned zero. The
concurrency database was dropped and independently checked absent. The local
Supabase stack was stopped without retaining a backup. No cloud identities or
business records were created or modified.

The [dependency assessment](../security/npm-dependency-audit-m50-20261019.md)
records five High affected development-package nodes from one advisory, with
no compatible patched version identified. Production-only audit found zero
known advisories. Dependencies remain unchanged; this is an unresolved tooling
risk, not a claim of remediation.

## Operational decisions and recommendation

Local implementation verdict: **READY FOR OWNER REVIEW**. Recommend normal
feature-branch push and exact-head hosted CI only after separate explicit
authorization. All final local mandatory checks passed; hosted validation and
cloud migration remain pending, not PASS.

Before Staging application, obtain separate approval for migrations 48–50,
review recovery readiness and run exact-head hosted CI after authorized push.
Supply actual approved supplier/agreement, prices and catalog images,
commercial/legal/tax/delivery/return/COD/recognition contracts, Store-specific
receiving destinations and narrowly scoped Staff grants. Confirm receipt
reference namespace guarantees with the providers. No real checkout defaults
or operational activation is supplied by this change.

Production is **NO-GO** pending these decisions, security risk assessment and
separate release authorization. Local implementation review does not authorize
cloud migration, Store selling, Production or main/develop integration.

## Changed-file inventory

- `.github/workflows/ci.yml`
- `docs/evidence/unified-egypt-mvp-store-local/ar-1280-light-delivered.png`
- `docs/evidence/unified-egypt-mvp-store-local/ar-360-dark-delivered.png`
- `docs/evidence/unified-egypt-mvp-store-local/ar-390-system-reconciliation.png`
- `docs/evidence/unified-egypt-mvp-store-local/browser-evidence.json`
- `docs/evidence/unified-egypt-mvp-store-local/concurrency-evidence.json`
- `docs/evidence/unified-egypt-mvp-store-local/en-1280-light-catalog.png`
- `docs/evidence/unified-egypt-mvp-store-local/en-1280-system-under-review.png`
- `docs/evidence/unified-egypt-mvp-store-local/en-390-dark-checkout.png`
- `docs/releases/unified-egypt-mvp-store-contract.md`
- `docs/releases/unified-egypt-mvp-store-foundation.md`
- `docs/security/npm-dependency-audit-m50-20261019.md`
- `scripts/test-store-catalog-concurrency.mjs`
- `scripts/test-store-purchase-concurrency.mjs`
- `scripts/test-store-workspace.mjs`
- `scripts/verify-store-catalog-migration.mjs`
- `src/app/[locale]/(portal)/portal/layout.tsx`
- `src/app/[locale]/(portal)/portal/store/[[...path]]/page.tsx`
- `src/app/[locale]/store/[[...path]]/loading.tsx`
- `src/app/[locale]/store/[[...path]]/page.tsx`
- `src/app/api/store/catalog/route.ts`
- `src/app/api/store/proof/route.ts`
- `src/app/api/store/route.ts`
- `src/components/shell/public-shell.tsx`
- `src/components/store/catalog-admin.tsx`
- `src/components/store/catalog-controls.tsx`
- `src/components/store/controls.tsx`
- `src/components/store/experience.tsx`
- `src/domain/store/model.ts`
- `src/domain/store/totals.ts`
- `src/i18n/store.ts`
- `src/infrastructure/store/access.ts`
- `src/infrastructure/store/catalog.ts`
- `src/infrastructure/store/proof.ts`
- `src/infrastructure/store/service.ts`
- `src/infrastructure/supabase/database.types.ts`
- `src/styles/store.css`
- `supabase/migrations/20261019000100_store_purchase_fulfillment.sql`
- `supabase/tests/store_catalog.test.sql`
- `supabase/tests/store_purchase.test.sql`
- `tests/e2e/store.spec.ts`
- `tests/integration/deployment-attestation.test.ts`
- `tests/integration/store-purchase-security.test.ts`
- `tests/integration/store-purchase.test.ts`
- `tests/unit/store-presentation.test.ts`
- `tests/unit/store-totals.test.ts`
