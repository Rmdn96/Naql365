# Architecture review summary

## Outcome and architectural decisions

**NAQL365 STORE — WAVE 6A ARCHITECTURE READY FOR OWNER REVIEW**.

Store fits as a separate bounded module in the existing Next.js application/Supabase project. Reuse identity, organization/Market primitives, permission resolution, safe HTTP/error patterns, localization/theme infrastructure, private Storage mechanisms and testing discipline. Add separately reviewed Store projections, commands and financial contracts later. No rewrite, replacement backend, open marketplace, owned inventory or supplier portal is needed for V1.

Recommended decisions for review:

1. Keep Store Orders/Payments/fulfillments/settlements separate from Transport; only deliberately shared identity/geography/infrastructure references cross the boundary.
2. Use staff-managed supplier agreements/offers and explicitly authored Market retail prices, with private cost snapshots and immutable selling snapshots at placement.
3. Launch with one supplier per order, retaining group/item allocations and supplier foreign keys for future expansion; no hardcoded supplier ID.
4. No availability-confirmation gate or warehouse/reservation model. Handle real supply failure through auditable exceptions, cancellation/return and financial recovery.
5. Separate order/payment/fulfillment/settlement dimensions. Finance alone verifies funds; append-only balances distinguish supplier COD custody, Naql365 collection and internal settlement.
6. Registered Customer checkout first; Store Guest remains a separately approved capability design. Existing Transport grants are not a shortcut.
7. Treat legal/accounting/collection/Market activation decisions as gates, not technical defaults or a migration seed.

## Inspected living sources (accepted baseline)

The older `docs/architecture.md` records early foundation ADRs and some intentionally unimplemented Phase 0 behavior. This review uses current source/migrations as authority rather than treating those historical statements as current product limitations.

| Existing path                                                                                                       | Observed contract                                                                                                      | Reuse / Store limitation                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `src/infrastructure/supabase/server.ts`, `browser.ts`; `src/infrastructure/identity/login-destination.ts`           | Existing Supabase SSR/browser clients and canonical role destination; no Store role exists                             | Reuse verified session infrastructure; do not change login/PKCE/cookies or infer role by email                             |
| `src/infrastructure/identity/staff-context.ts`, `access.ts`; `src/domain/identity/authorization.ts`                 | Active staff context fails closed on ambiguous organizations; effective permissions use `has_permission`               | Extend permission-driven shell only after Store grants/projections approved; no cross-organization union                   |
| `src/infrastructure/requests/service.ts`                                                                            | `customerClient` verifies Auth, Customer relationships and `account.access`                                            | Reuse registered identity checks with explicit Store organization selection; do not create Transport Requests for products |
| `src/domain/markets/model.ts`; `src/infrastructure/markets/public.ts`                                               | Market currency/timezone/geography and public preferences; locale is separate                                          | Reuse identity/presentation, not Transport service coverage as Store delivery entitlement                                  |
| `src/infrastructure/requests/http.ts`                                                                               | Exact-origin mutations, bounded input, safe error categories/no-store responses                                        | Reuse pattern for new Store adapters; no wildcard Preview origin or broader authorization                                  |
| `src/domain/payments/model.ts`; `src/infrastructure/payments/service.ts`, `proof.ts`                                | CASH/BANK_TRANSFER Transport state model; Finance commands, versioned destinations and reserved proof lifecycle        | Reuse techniques, not Transport RPCs/records: payment details/commands take a Transport order ID and clearance gates Trips |
| `supabase/migrations/20260921000100_payment_finance_schema.sql`                                                     | Existing payments FK Transport orders, one payment per order, received-facts checks, bank/proof-purpose authorization  | Cannot attach Store obligation by replacing IDs or widening existing proof policies                                        |
| `src/domain/guest/capability.ts`; `src/infrastructure/guest/session.ts`, `secret.ts`; guest migrations              | `g1_` capability, Transport guest cookie/header, hash verifier, expiry/revocation/rate limits and Request-bound grants | Reuse security principles only; new Store sessions/grants must not authorize Transport or create fake Auth users           |
| `supabase/migrations/20261012000100_support_request_queue.sql`                                                      | Migration 47 is bounded/read-only; active staff plus BOTH `support.read` and `requests.read`; validates Market         | Store Support needs its own explicit safe projection, not unfiltered Sales/Finance loader reuse                            |
| Existing customer/guest, portal and Driver route groups; `src/components/shell`, `src/styles`                       | Accepted UI V2, localized navigation, semantic themes, separate role shells                                            | Later integrate actual Store routes with proper authority; no fictional live route in Wave 6A                              |
| Existing audit/immutable mutation patterns, `scripts/test-*-concurrency.mjs`, SQL tests and scoped hosted harnesses | Durable commands, database tests, independent connection races, synthetic cleanup                                      | Patterns to extend; current Transport tests do not constitute Store acceptance                                             |

Existing permissions include `account.access`, `portal.access`, request/quote/order/fleet/trip permissions, `support.read`, `finance.read/verify/accounts.manage` and command-specific commercial/execution scopes added in accepted migrations. They remain Transport/current-domain authority. The proposed Store namespace is not seeded/granted here.

## Required modules and proposed API/action surface

Use the existing separation: pure `domain/store` money/state/contracts, application orchestration, user-scoped infrastructure adapters and Next.js UI/routes/actions. Names below are conceptual future operations, **not existing or newly implemented endpoints/RPCs**.

| Proposed operation family           | Server/database authority and inputs                                                                          | Safe output                                                                                                       |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Catalog browse/search/detail        | Validated organization/storefront + Market, public publication rules, bounded cursor/query                    | Only approved retail content/price/delivery meaning; no offers/costs                                              |
| Catalog/source/price administration | Canonical staff scopes, expected entity revisions and mutation IDs                                            | Permission-scoped draft/publication results; private economics only with cost grant                               |
| Cart read/change                    | Customer ownership or approved Store guest session, cart revision, product/quantity intent                    | Recomputed safe cart and changed-price/unavailable conflicts                                                      |
| Checkout/place                      | Trusted cart/authority, expected revisions, address/method choice, terms consent, mutation ID                 | One order/reference and safe snapshots; derives organization/Market/currency/supplier/cost/retail/tax/fees itself |
| Order/history/tracking              | Ownership or explicit Store staff/read-only support scope; bounded cursor                                     | Customer-safe status/events and permitted actions, not raw financial rows                                         |
| Proof reserve/submit/read           | Authorized Store order/attempt, immutable file binding, size/type limits                                      | Reservation used only for private upload; short-lived read after reauthorization, no general proof path           |
| Verify/reject collection            | Store Finance scope, expected revision, actual receiving evidence, amount/currency/source reference           | Durable receipt/review outcome, no automatic supplier dispatch without guarded release                            |
| Supplier fulfillment/exception      | Store Operations scope, group/revision, allowed transition/evidence                                           | Real event and next authorized actions; no Trip creation or fake provider acknowledgement                         |
| Cancellation/return/refund          | Customer request versus privileged decision/execution scopes, line/receipt allocations and revision           | Independent case/refund progress and safe reason; execution not implied by approval                               |
| Settlement/reversal/dispute         | Supplier-scoped Finance grants, locked eligible allocations, intent/source references and approval separation | Append-only balance/reconciliation facts and explicit unresolved execution                                        |

Prefer narrow versioned command/projection functions with explicit schemas over generic table editors or unrestricted JSON actions. All write adapters retain origin/payload checks, all database commands independently reauthorize, and every direct-table/Storage boundary remains tested. Supplier communication is manual staff administration in V1, with no automatic messaging in this task.

## Review of alternatives

| Alternative                                                                         | Decision / reason                                                                                                          |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Reuse Transport `orders`/`payments` with a Store flag                               | Reject: existing FKs, immutable Quote lineage, execution clearance, Guest and Finance contracts have incompatible meanings |
| Put cost on customer-readable product/order rows and hide it in UI                  | Reject: row security and frontend hiding do not establish column confidentiality                                           |
| Single supplier singleton/one balance on order                                      | Reject: cannot safely distinguish future supplier custody/entitlement/refunds                                              |
| Marketplace/warehouse system now                                                    | Reject: not this operating model; adds unapproved stock, identity and publication authority                                |
| Supplier approval before checkout                                                   | Reject: contradicts the owner's availability policy; exceptions handle actual failure                                      |
| Reuse Transport Guest token for Store                                               | Reject: grants are Request-bound and could create cross-domain authority                                                   |
| Automated FX/tax/commission defaults                                                | Reject: retail/cost agreements are Market-specific; margin model and legal/accounting questions remain distinct            |
| Dedicated Store module, scoped money journals and staff-mediated supplier lifecycle | Recommend for owner review; smallest coherent boundary without changing Transport                                          |

## Approval and evidence scope

Review D01–D13 in the [decision register](09-open-decisions-risks.md), particularly legal/payment eligibility, supplier entitlement, refund funding, geography and Guest policy. Approval may authorize a later detailed backend/schema design, but no application or migration implementation follows automatically. Future implementation must meet [the roadmap](08-implementation-roadmap.md).

Wave 6A changes only documentation under `docs/store/` on its new branch. No SQL was executed, no Supabase account/configuration or fixtures were touched, no Lovable generation occurred, and no deployment, merge, main/develop/DNS/Hostinger/Production/Phase 8 work was performed. Documentation checks are format, local-link validation, secret/history scans and repository-tree integrity; application/business/hosted tests are not re-labelled as newly run for this package.
