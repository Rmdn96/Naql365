# Naql365 — Unified Egypt MVP implementation proposal

**NAQL365 — UNIFIED EGYPT MVP PLAN READY FOR OWNER APPROVAL**

18 October 2026. Planning only. Transport **and** Store launch together in Egypt,
in EGP, with CASH, Vodafone Cash and InstaPay. No required service or payment method
is deferred by this plan. No SQL, application implementation, payment setup, cloud
write, deployment, merge or public activation is authorized by this document.

## 1. Verified history and safe integration

| Reference                                | Verified state                                                                                                                                    |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Remote develop / accepted Transport      | `29baff49a143e2ed24856c80cbc08c9b65c3f941`                                                                                                        |
| Remote catalog branch                    | `feature/store-wave-6d-1a-catalog-foundation` at `96eb4e9047025b4cb9065e00435e6ac167063b24`                                                       |
| Catalog parent                           | Exactly the accepted develop SHA; integration is already cumulative                                                                               |
| Local recovery documentation/harness tip | `a8342089e273189d3ab4e499ef0f46c3b642e0fe`, descendant of catalog; only recovery documents/evidence and the local recovery harness added after it |
| New preparation branch                   | `feature/unified-egypt-mvp`, created from `a8342089...`; no merge, cherry-pick, rebase, overwrite or force-push                                   |
| Remote main                              | `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`, untouched                                                                                             |
| Migrations                               | 47 original Git blobs unchanged; one separate reviewed catalog addition; no later migration file created                                          |

Migration 48 remains `20261018000100_store_catalog_foundation.sql`, SHA-256
`0816abc8bf7ef64258adfddc7f92633786b8d30bff9c00453caecfbb37459ebd`.
It contains ten private catalog tables, seven public RPCs and seven permission
definitions, with zero role grants and no scope/product/price seeds.

The branch preserves accepted Stage 3 and UI Waves 1–5 through develop's squash
integration. No need to merge their historical feature branches again. Keep Store
and Transport migrations/release notes distinguishable, but use one tested release
candidate for the unified launch. Preserve every existing branch. No push or PR
creation is part of this planning task.

## 2. Smallest complete launch scope

- **Transport:** accepted request wizard, manual verified distance and final Sales
  Quote, customer decisions, checkout/payment, Dispatch, Driver execution and real
  POD. Cairo is the only launch pickup hub; destination cities/services require an
  approved list enforced server-side using existing directional coverage.
- **Store:** public categories/catalog, approved product detail/images, registered
  Customer cart, checkout, independent Store Order/history/status, supplier handoff,
  delivery/exception/cancellation and basic manual money reconciliation.
- **Both:** EG/EGP, CASH, Vodafone Cash and InstaPay, authorized Finance receipt
  verification, safe private evidence and clear pending/confirmed distinctions.
- **UI:** reuse canonical Next.js components and Design System V2, AR/EN, RTL/LTR,
  Light/Dark/System and mobile-first layouts. No visual rewrite or new runtime.
- **Excluded:** supplier portal, owned inventory, pre-checkout supplier confirmation,
  Guest Store checkout, multi-supplier checkout, automated settlement/payment gateway,
  analytics, ETA/GPS promises and automatically creating Transport Trips for Store.

Only owner-approved products, images, retail prices, sourcing offers and agreements
may be published. None have been supplied/approved by this task. Test fixtures are
clearly synthetic, isolated on Staging and never published as a real catalog or
copied to Production. Existing supplier approval/publication controls remain.

## 3. Actual reuse and verified gaps

The existing `public.bank_accounts.destination_type` already supports BANK,
VODAFONE_CASH and INSTAPAY, guarded to EG/EGP for the latter two. Existing selected
destination/proof snapshots record that type. Transport's internal payment method
remains CASH or BANK_TRANSFER: the two Egypt channels can remain manual transfers
internally while appearing as **distinct named customer choices**. No gateway or
replacement payment engine is needed.

Existing Finance verification checks exact accepted amount/currency and authority,
records receipt/audit history, and prevents two receipts for one Transport payment.
It does not itself establish a unique external receipt across two different Orders
or across Transport and Store. Customer transaction-reference capture also needs a
bounded contract: existing Finance `bank_reference` is not automatically customer
submission evidence. Do not equate the two without explicit fields/authority.

`finance_queue(p_org,p_status,p_offset)` paginates organization-wide before any
Market filter. The accepted Finance list is deliberately server-blocked; scoped
payment detail and bank configuration remain implemented. A narrow server-side
Market-scoped list is required; client or post-fetch filtering is not a remedy.

Catalog Migration 48 returns empty media and implements **no** cart, Store Order,
checkout, delivery or Store payment. Its agreement/policy contracts cannot be
silently interpreted as numeric delivery/tax/settlement rules.

## 4. Minimal additive migration proposal — separate review required

Retain files 1–48 exactly. Propose **two** additional migrations, provisionally
49 and 50, only after schema review and a fresh migration-tip check. These numbers
are planning labels, not created/reserved files or permission to apply anything.

### Proposed 49 — Market-safe Finance and manual collection receipt boundary

- Add versioned `finance_queue_v2` requiring canonical active staff organization,
  selected active Market and `finance.read`. Apply tenant/Market/status filters
  **before** ordering, page bounds and counts; use a bounded deterministic cursor.
  Return safe existing fields; proof access still needs its separate authorization.
- Preserve the old RPC for compatibility; switch new UI loaders to v2, retain
  filters/Market in navigation, and remove containment only after its tests pass.
- Add bounded customer transaction-reference capture to transfer attempts; keep it
  distinct from the Finance-verified external receipt/reference and private notes.
- Add one private shared `manual_collection_receipts` registry. Initially attach
  each verified receipt by a typed composite FK to a Transport payment. Store
  attachment is added only when the Store payment table exists in proposed 50.
- Finance atomically claims a verified incoming receipt before confirming funds.
  Unique canonical provider/receiving-destination/verified-external-receipt identity
  prevents reuse across Orders and later across the two services. No uniqueness
  decision is based on an uploaded proof or an untrusted customer-entered string.
  Require unambiguous receiving-account ownership in the launch organization; never
  leak another tenant's receipt details in conflict responses.
- Reuse existing exact amount, currency, revision, idempotency, receipt and execution
  clearance rules. Never rewrite historical confirmed payments or fabricate missing
  historical references. New rules apply to new confirmation actions.
- Review actual owner-provided destination identifier types. If current validated
  fields already represent them, reuse them unchanged. If an approved InstaPay
  identifier does not fit the existing restricted account-number contract, propose
  the smallest **typed** extension; do not loosen all destinations or accept URLs.

No money is transferred by the application. Definition of the provider's unique
receipt identifier and receiving-account eligibility requires actual owner evidence.

### Proposed 50 — Store purchase, fulfillment and reconciliation core

Nine Store-specific private tables plus the shared receipt registry above replace
the earlier broader 31-relation implementation proposal for this MVP. This proposed
reduction needs owner acceptance; it does not remove required commercial safeguards.

| Proposed table                 | Minimum purpose                                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `store_product_media`          | Product, approved version, ordered bilingual alt text and allowlisted owned static image path/hash; no arbitrary remote URL or public proof upload  |
| `store_delivery_options`       | Versioned approved supplier/agreement + EG city/region eligibility, customer fee and supplier delivery entitlement; immutable selection snapshot    |
| `store_carts`                  | One active registered-customer cart in the approved Store org/EG context; revision                                                                  |
| `store_cart_items`             | Product/listing/selected version and positive bounded quantity; unique cart/product, no invented stock                                              |
| `store_orders`                 | Customer, one supplier, organization/EG/EGP, immutable address/fee/tax/terms totals; separate order, fulfillment and cancellation/return dimensions |
| `store_order_items`            | Immutable product/retail/quantity/approved offer/agreement/cost bindings; explicit customer projections exclude sourcing fields                     |
| `store_payments`               | One Store Order obligation, three distinct channel choices, exact expected amount, selected destination snapshot, review/collection state           |
| `store_payment_proofs`         | Private purpose-bound upload attempts, transaction reference, reservation/submission/rejection/verification facts and safe metadata                 |
| `store_reconciliation_entries` | Append-only verified collection, entitlement, manual supplier transfer, refund and linked reversal facts; no auto-payout                            |

Use one fulfillment per Store Order, represented by separate fields and audited
transitions, rather than another supplier-group/trip subsystem. Cancellation/return
requests retain typed append-only events and one current resolution state. If the
approved policy requires multiple simultaneous partial-item cases, add only the
necessary bounded case structure in review; do not silently implement complex
returns or prohibit a legally required customer remedy.

Reuse Migration 48's events/command-receipts infrastructure by explicitly extending
typed parent FKs, command families and constraints in the **new** migration. Do not
edit Migration 48. Add strictly typed, immutable approved checkout commercial policy
versions where needed; display-only policy bodies are not machine authority for tax
or fees. No invented zero-tax/default-fee interpretation.

Store payment proofs get their own private, purpose-scoped Storage authorization;
general `files.read`, Transport proof access and Support do not imply Store access.
For launch product images, use approved licensed static assets plus approved media
metadata; defer the media-upload administration feature, not product images.

All parent/child relationships carry organization/Market/currency as applicable;
use restrictive FKs, integer EGP minor units, bounded pagination and explicit DTOs.
Define narrow Store Orders/Fulfillment/Payments/Reconciliation permissions, but
grant none automatically. Finance commands require their Store grant **and** existing
Finance authority in the canonical organization. Customer commands require Auth,
existing Customer ownership and Store scope; never staff permissions or email.

## 5. Payment contracts for both services

| Customer choice | Internal mechanism                                                 | Required release/confirmation condition                                                     |
| --------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| CASH            | Existing Transport cash rules; separate Store COD obligation       | Named collector reports actual collection; authorized Finance verifies it; unpaid stays due |
| Vodafone Cash   | Existing EG manual transfer destination type and proof primitives  | Actual receipt verified by Finance, exact EGP amount and unique external receipt claimed    |
| InstaPay        | Same manual transfer engine, distinct approved destination/channel | Same verification, privacy and idempotency; no gateway or automatic provider claim          |

Freeze selected receiving destination/channel and commercial terms for new payment
instructions; later destination edits must not silently change an existing payment.
Permit safe explicit reselection before funding according to a reviewed transition.
Do not alter historical snapshots or claim unavailable history was captured.

Proof states distinguish RESERVED, SUBMITTED/UNDER_REVIEW, REJECTED, replaced and
VERIFIED. Upload never means funds received. Confirmation locks the payment and
receipt claim, rechecks permission after waits, then atomically records the payment,
audit event and idempotent result. Reject replay with changed intent. A receipt
cannot fully fund both a Transport Order and a Store Order. V1 does not introduce
partial-payment allocation, combined checkout or a shared generic Order UUID.

Store's shared receipt registry has exactly one typed domain attachment. Transport
payments keep Transport FKs and existing payment transactions; Store payments keep
Store FKs and entries. One Finance UI can show two clearly labeled tabs/sections
without merging their Orders, lifecycle, permissions or amounts.

## 6. Supplier fulfillment and cash reconciliation

Supplier prepares and physically delivers Store Orders; Naql365 staff administers
handoff and status. No supplier portal or implicit Driver/Trip authority. Distinct
order/fulfillment/payment/settlement states remain independent:

- Order placed → accepted/cancelled, according to approved terms.
- Fulfillment awaiting release → sent to supplier → preparing → out for delivery
  → delivered, with exception/cancellation/return branches.
- Transfers cannot release funded Store fulfillment until Finance verifies funds.
  CASH can follow only the separately approved COD release rule.
- Supplier availability is not a pre-checkout gate. A genuine failure becomes an
  exception, suspension where appropriate, and an authorized cancellation/refund.
- A delivery report or supplier cash report is evidence, not payment confirmation.

Store COD collection by the supplier follows the accepted supplier-delivery model;
the exact handoff/evidence/reconciliation process remains an owner decision.
Transport's actual cash collector must be named separately, with no new Driver
Finance authority. Supplier-held verified cash is not falsely recorded as a
Naql365 bank receipt.

Per Store Order/supplier, freeze retail obligation and agreed supplier entitlement,
including approved delivery-fee allocation. Record who actually holds collections,
refunds and verified supplier transfers. Reconciliation shows a directional amount
owed, not an ambiguous combined supplier balance or automatic accounting revenue.
No percentage commission, FX authority or tax/profit conclusion is introduced.

Manual refunds/settlements need a durable request/reference and unknown-outcome
state, followed by verified external evidence. Block duplicate internal verification;
reversals reference original entries and cannot exceed unreversed amounts. The app
does not execute external transfers or guarantee that a human cannot independently
make a duplicate transfer outside the system. Escalate disputed/unknown outcomes
instead of suggesting another payment.

## 7. Owner decisions required — one practical decision packet

1. Exact launch organization, Transport Cairo pickup code and approved destination
   cities/services. Store delivery cities, supplier dispatch origin, actual delivery
   responsibility and fee/entitlement per delivery option; no nationwide promise.
2. Approved product/category/SKU/unit content, licensed images, retail EGP prices,
   supplier identity, offer costs and evidence-backed supplier agreements. No stock
   quantities or availability guarantees are inferred.
3. Eligible Vodafone Cash and InstaPay receiving destinations, permitted identifiers,
   actual external receipt identity/reference, account ownership and authorized
   Finance reviewers. Submit actual financial values privately, never in Git.
4. Transport CASH collector/time/evidence; Store supplier COD evidence, shortage
   handling, reconciliation frequency and supplier entitlement/settlement timing.
5. Legal seller/responsibilities, invoice issuer, tax treatment/inclusive price
   meaning, delivery promises, cancellation/returns/refund policy and privacy/terms.
   No rates, periods, deductions or merchant/provider eligibility are invented.
6. Exact Store Staff grant matrix, approval-record/evidence retention and whether
   maker/checker separation is mandatory. Current schema records approval actors
   but does not enforce two-person approval. No automatic SUPER_ADMIN grant.
7. Accept/revise proposed migrations 49/50 and table consolidation. Approve any cloud
   apply separately. Scope remains unprovisioned; a later EG/EGP scope starts PAUSED.
8. Final Production/Hostinger setup, key custody/backups and activation remain a
   separate release authorization; the reserved Production project is never a test target.

These decisions can be supplied together; no new serial approval bureaucracy or
paid PITR/additional Supabase project is required. Schema approval is still distinct
from permission to enter financial destinations or activate commerce.

## 8. Short implementation sequence after approval

1. Freeze this combined scope/owner decisions; reuse accepted baseline CI and
   recovery drill. Resolve trusted database CA/backup readiness for the data present
   before any later authorized Staging apply; do not repeat unchanged visual evidence.
2. Implement/review proposed 49 locally: Market-safe Finance, receipt registry,
   bounded transfer references and any proven destination-validation gap.
3. Implement/review proposed 50 locally: Store data/commands/security, customer cart
   and immutable placement, delivery rules, private proofs and reconciliation.
4. Integrate lean catalog/detail/cart/checkout/history/admin UI in canonical Next.js,
   with all three payment methods working for both services. Preserve existing
   Transport and Driver screens; one combined release candidate, small commits.
5. Run required repository CI and focused cross-domain security/concurrency tests;
   request separate Staging apply/configuration approval for exact reviewed artifacts.
6. Use isolated synthetic Staging fixtures for the combined acceptance; clean and
   verify them. Owner-approved genuine catalog/configuration follows a separate
   controlled publication path. No fixtures or database clone go into Production.
7. Prepare a clean Production schema/configuration release and focused Hostinger
   runtime acceptance; return for explicit deployment/public-activation approval.

## 9. Focused acceptance — no repeated visual explosion

- Six real authoritative primary payment journeys: **two services × three methods**,
  including supplier fulfillment/Store status and Transport Dispatch/Driver/POD.
- Reject/reupload, wrong amount/currency/destination, duplicate reference across
  services, simultaneous verification, permission loss, cancelled-order funding,
  unknown external outcome and linked refund/reversal cases.
- Checkout double-submit produces one immutable Store Order; stale product/price/
  delivery/policy versions require an explicit safe retry, not silent price change.
- Cross-tenant/Market/customer/role denial; catalog suspension; private supplier cost
  and proof confidentiality; no Store grants from existing Transport permission alone.
- Local full reconstruction/upgrades/types/RLS, full required unit/integration and
  E2E CI, and financial races on actual changed commands. Reuse unchanged 6/6 session
  evidence and accepted Driver/visual evidence; rerun affected critical journeys only.
- AR/EN, RTL/LTR, Light/Dark/System; representative checkout and Finance forms at
  360/390/768/1280/1440, key pages mobile/desktop. Check overflow, keyboard, focus,
  labels and axe smoke. Do not multiply every state by every theme/width.
- Run-owned fixtures and private files only; independent cleanup and credential
  disposal where used. Do not send customer secrets or real payment details to Lovable.

## 10. Effort and critical path

For one experienced implementation engineer with QA/reviewer availability, estimate
**18–26 engineering working days (approximately 4–6 weeks)** after essential owner
inputs arrive: Finance/payment boundary 3–4, Store schema/commands 6–8, UI/admin 5–7,
combined acceptance/release preparation 4–7. Some work overlaps; these are planning
ranges, not a delivery commitment or assurance that legal/provider access is ready.

Critical path: approved commercial/catalog/delivery inputs → reviewed purchase and
receipt contracts → Store/Finance security implementation → all six payment journeys
→ clean Production configuration and authorized hosting release. Owner/legal/provider
waiting, missing CA/access, unexpected legacy conflicts and any mandatory partial
returns or maker/checker addition are outside that estimate and must be re-estimated.

## 11. Actual work performed by this task

Read-only repository/remote-head and source-contract review, ancestry/integrity
checks, creation of the authorized preparation branch, and this plan only. No new
migration, application feature, payment configuration, role grant, cloud query/write,
merge, push, deployment or Store selling. Earlier accepted evidence remains historical
evidence, not falsely claimed new execution. Old architecture documents are retained;
this scoped MVP proposal supersedes their broader implementation sequence only if approved.

Key inspected sources: `docs/store/wave-6d-1a/CONTRACTS.md`,
`supabase/migrations/20260927000400_transfer_destinations.sql`,
`supabase/migrations/20260921000300_payment_storage_projections.sql`,
`src/domain/payments/model.ts`, `src/infrastructure/payments/staff-views.ts`,
`src/app/[locale]/(portal)/portal/finance/page.tsx`, and accepted Wave 6C/6C-F
contracts. The Lovable design revision is an external design artifact, not a Git
ancestor; no generated runtime or uninspected implementation was imported.
