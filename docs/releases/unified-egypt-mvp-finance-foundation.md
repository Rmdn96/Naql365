# Unified Egypt MVP — Phase 1 Finance foundation

Date: 2026-10-19.

**Local implementation ready for owner review. Hosted exact-head CI is pending
authorization to push. This report does not authorize cloud migration application,
deployment, real receiving destinations, Store activation or Production.**

## Source and integrity

| Item                             | Exact reference                                                    |
| -------------------------------- | ------------------------------------------------------------------ |
| Branch                           | `feature/unified-egypt-mvp`                                        |
| Implementation commit            | `79bfcba8df04be0ee60c93925dd99506b4342f5e`                         |
| Preparation commit               | `25abea67ae4dba27911cc6904b263e984c9d3452`                         |
| Transport / remote develop       | `29baff49a143e2ed24856c80cbc08c9b65c3f941`                         |
| Reviewed catalog ancestor        | `96eb4e9047025b4cb9065e00435e6ac167063b24`                         |
| Remote main, read back unchanged | `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`                         |
| Migration 48 SHA-256, unchanged  | `0816abc8bf7ef64258adfddc7f92633786b8d30bff9c00453caecfbb37459ebd` |
| New Migration 49                 | `supabase/migrations/20261018000200_finance_market_receipts.sql`   |
| Migration 49 SHA-256             | `4869cf60cffeae5696d22d16c4d13c439c3ca07ed538a47e18ec9bee0691ca99` |

The branch retains the accepted catalog ancestor. Read-only `git ls-remote`
confirmed develop/main at the references above. Migrations 1–48 have identical
canonical Git blobs/bytes to the reviewed catalog ancestor; existing Windows
checkout line-ending differences are recorded by the integrity checker, not
rewritten. Migration 49 checkout/index bytes match its checksum above.

There are 49 migration files in this feature branch and 49 in the reconstructed
**local** migration ledger. Local reconstruction inputs match repository SQL
content, allowing existing CRLF/LF differences only. No cloud migration ledger was
modified or newly inspected. This is not evidence that Staging has migration 48
or 49 applied.

## Implementation

- `finance_market_queue` validates a single active staff organization context,
  existing effective `portal.access`/`finance.read` permissions and an active
  organization-owned Market. Organization, Market and status filtering occurs
  before bounded keyset pagination. The UI retains the status filter and starts
  a fresh cursor window on Market changes. Counts mean displayed items.
- The previously withheld Finance view now uses this scoped read model. Existing
  detail and bank-setting guards remain. No client-side/post-fetch Market
  filtering, permission broadening, posting or balance changes were introduced.
- Customer proof submission optionally captures a bounded 1–120-character
  transaction reference. It remains separate from Finance's verified provider
  receipt identity and never marks a payment PAID or clears transfer execution.
- New transfer confirmation atomically inserts an immutable private typed
  receipt claim and performs the existing confirmation, receipt and audit work.
  Conflicting claims roll back the whole transaction. Existing replay/revision,
  Guest, amount/currency and Finance permission checks remain.
- The registry has RLS enabled, no client grants/policies, typed composite
  payment/attempt/Market relationships, and restrictive actor retention. Its
  normalized channel/reference uniqueness spans destinations and tenants;
  duplicate configuration cannot be used to bypass the claim. Historical usable
  confirmed references also block reuse, without rewriting historical rows.
- Egypt Vodafone Cash and InstaPay are separately labeled using existing
  authorized destination types. Transport retains CASH/BANK_TRANSFER internally.
  There is no new real destination, provider connection or gateway activation.

The detailed [integration contract](unified-egypt-mvp-finance-contract.md) documents
the future Store typed payment/collection/entitlement/manual settlement/refund
and reversal interface. It explicitly preserves supplier CASH collection,
Naql365 verified transfer collection, EG/EGP Store scope and shared receipt
uniqueness. No Store order/payment/settlement tables or runtime routes were added.

## Verification results

Environment: Node `v24.18.0`, npm `11.16.0`, isolated local Supabase/PostgreSQL test
stack. Existing cloud operator credentials were excluded from local CLI children.
No credentials or real financial destinations were test fixtures.

| Gate                                    | Result / evidence                                                                                                                                                                                                |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full unit/integration                   | **368/368 PASS**, 73 files, final bounded two-worker run, 176.37 seconds                                                                                                                                         |
| SQL reconstruction                      | **PASS**, clean local 1–49 reconstruction; repository/local source and ledger comparison                                                                                                                         |
| SQL/RLS                                 | **111/111 TAP PASS**, 10 files; includes catalog, Finance, Guest, Driver, tracking and Transport assertions                                                                                                      |
| Populated 48 → 49 upgrade               | **PASS**, included in the final 368: historical confirmed payment, attempts, invoices, transactions, bank configuration, audit and role grants preserved                                                         |
| Official generated DB types             | **PASS**, CLI-generated public types match the committed file                                                                                                                                                    |
| Payment concurrency                     | **9 race batches PASS**, independent PostgreSQL connections, including duplicate submission/replay, confirmation versus rejection/start, same receipt against different payments, and method switch versus start |
| Receipt race outcome                    | Exactly one durable claim and one PAID payment; the losing confirmation rolls back                                                                                                                               |
| Restricted staff browser                | **12/12 local journeys PASS**, SUPER_ADMIN, SALES, OPERATIONS, DISPATCHER, FINANCE, CUSTOMER_SERVICE × AR/EN                                                                                                     |
| Finance browser coverage                | Populated SA/EG queue, status filtering, refresh, Market switching with filter retention, wrong-Market detail denial, authorized detail, role-safe links, login/logout and protected-route denial                |
| General E2E                             | **60 unique cases verified**: initial full run 58 PASS / 2 timeout; the same two desktop cases then passed unchanged, with one worker and the original 30-second timeout                                         |
| Responsive/focus/axe smoke              | Existing staff harness assertions passed; no claim of WCAG certification or fresh hosted visual acceptance                                                                                                       |
| ESLint / strict TypeScript / formatting | **PASS**                                                                                                                                                                                                         |
| Production compilation                  | **PASS**, local optimized Next.js build; no Production deployment                                                                                                                                                |
| Tracked/history secret-pattern scans    | **PASS**, heuristic coverage; no claim that this proves absence of every possible secret                                                                                                                         |
| Migration integrity                     | **PASS**, accepted 1–48 unchanged; only additive 49                                                                                                                                                              |
| Independent cleanup                     | **PASS**, post-run local counts zero for organizations, auth users, customers, orders, payments, proof files and receipt claims; zero Store products and Store role grants                                       |

The existing accepted Customer/Driver/UI evidence is preserved, not relabeled
as new hosted acceptance. Existing payment/Guest/Transport tests were rerun where
the payment command changed. Auth source, session/callback handling, existing
RBAC/RLS, execution-clearance functions, POD and lifecycle commands were not
modified.

### Historical attempts and evidence limits

- An initial unbounded parallel unit run exhausted local resources and was
  interrupted. It is not a PASS.
- A subsequent full run exposed an old successful Guest transfer fixture that
  omitted the newly required verified receipt identity. The fixture now supplies
  a synthetic Finance identity; negative authorization/state/currency assertions
  remain. Final full-suite result is the 368 PASS above.
- Earlier staff runs stopped at a Market interaction and a generic Support alert
  assertion. Their exact original failure causes were not conclusively captured.
  The harness now waits for the real controlled Market handler and targets the
  actual workspace error component. Final 12/12 passed without application Auth
  or Support changes; no denial assertions were removed.
- The first general E2E run had two 30-second timeouts during the unchanged
  five-viewport homepage/axe scenarios under concurrent local test load. They
  were not visual assertion failures. Isolated unchanged reruns passed in
  10.1/9.2 seconds. The initial 58/2 result remains a failed attempt, not a clean
  60/60 single-run claim. No timeout or application source was changed to pass.
- Standard Playwright output cleanup removed earlier transient `test-results/`
  logs/captures. Final unit, SQL, focused E2E, migration/type-source and cleanup
  evidence was retained outside Git at
  `C:/Users/DELL/AppData/Local/Temp/naql365-finance-49-evidence/`.
  The completed staff result is recorded from captured runner output; its 60
  transient local diagnostic captures are not claimed as a retained acceptance
  matrix. Existing tracked visual evidence was not changed.
- Synthetic identities/business fixtures were deleted and independent counts
  checked. No new credential-reuse-denial test is claimed. The owned local
  Supabase test stack was stopped after verification.

## CI and remaining owner decisions

**Exact-head GitHub CI: NOT RUN / authorization blocked.** This task authorizes
local implementation and feature-branch commits only. There was no push, PR,
remote workflow dispatch or deployment. Historical baseline CI is not reused as
proof for migration 49. The existing required workflow remains unchanged and will
run its quality and database jobs after a separately authorized feature push.

Before proceeding:

1. Review this local implementation and authorize a normal feature-branch push
   if hosted exact-head CI is desired. No merge is authorized.
2. Review the conservative receipt identity policy and supported provider formats.
   Global channel/reference uniqueness can reject legitimate identifier collisions.
   Do not work around a conflict by inventing an identity. A receiver-scoped
   namespace requires separate design review if provider guarantees require it.
   Historical missing/unusable references remain a manual reconciliation gap.
3. Separately authorize any Staging migration application after the applicable
   preflight/recovery checks. Do not deploy the new Finance view against a backend
   lacking migration 49 and do not fall back to the unscoped queue.
4. Approve actual recipient eligibility/destinations and Finance procedures before
   real collection. None are configured here. Store supplier entitlement/margin,
   delivery, settlement, returns/refunds and legal responsibilities still require
   their approved operational terms before activation.
5. Review Migration 50 separately. This phase does not implement Store checkout,
   Store payments, supplier settlement execution or refunds.

## Changed files

Implementation commit: 26 files, 1,329 insertions / 63 deletions. This report is
a separate documentation-only follow-up; its delivery SHA is the branch HEAD
reported at handoff.

```text
docs/releases/unified-egypt-mvp-finance-contract.md
scripts/test-payment-concurrency.mjs
scripts/test-staff-workspace.mjs
scripts/verify-store-catalog-migration.mjs
src/app/[locale]/(portal)/portal/finance/page.tsx
src/components/payments/checkout.tsx
src/components/payments/proof-upload.tsx
src/components/payments/staff-market-unavailable.tsx
src/domain/payments/model.ts
src/i18n/payments.ts
src/infrastructure/payments/proof.ts
src/infrastructure/payments/service.ts
src/infrastructure/payments/staff-views.ts
src/infrastructure/supabase/database.types.ts
supabase/migrations/20261018000200_finance_market_receipts.sql
supabase/tests/finance_foundation.test.sql
tests/integration/deployment-attestation.test.ts
tests/integration/finance-foundation-upgrade.test.ts
tests/integration/finance-foundation.test.ts
tests/integration/guest-quotes.test.ts
tests/integration/payments.test.ts
tests/unit/customer-checkout-presentation.test.ts
tests/unit/finance-market-containment.test.ts
tests/unit/finance-market-queue.test.ts
tests/unit/payment-proof.test.ts
tests/unit/payments.test.ts
```

No changes were made to main/develop, dependencies, existing migrations,
Production, Supabase cloud data/configuration, receiving accounts, Hostinger or
DNS. No Store activation or cloud DDL/DML occurred.

**NAQL365 — UNIFIED MVP FINANCE FOUNDATION READY FOR OWNER REVIEW**
