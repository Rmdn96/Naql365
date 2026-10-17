# Payments and supplier settlement architecture

This is an operational control design, not an accounting, tax, licensing or merchant-of-record determination. All examples use invented minor-unit amounts with no live destination or tax-rate assumption. [Open decisions](09-open-decisions-risks.md) block live collection.

## Collection paths

**Supplier COD:** placement records an expected customer obligation and supplier collection responsibility. Staff records supplier-reported collection with delivery/receipt evidence; authorized Finance reconciles actual amount, currency, date and source reference. A delivered fulfillment can still have unpaid/disputed cash. A supplier collection is not a deposit into Naql365's account. Do not reuse Transport `confirm_cash`, whose authority and payment semantics belong to Transport Orders.

**Naql365 electronic collection:** after explicit Market/account approval, checkout selects a versioned eligible Naql365 destination. Egypt may offer Vodafone Cash and InstaPay; this is not permission to use a personal wallet, assume merchant eligibility or implement provider APIs. Saudi methods remain undecided. The destination must be approved for that legal entity, Market, currency and purpose; inactive/expired/unapproved configuration is unavailable. Selection and proof upload do not verify funds.

Proposed proof flow: reserve file → upload to private Storage → verify immutable object metadata → submit → Finance review → verify receipt or reject. Authorized Finance checks independently available receiving-account evidence, not merely the customer's screenshot. Rejected proofs stay in history; retry creates a new attempt. Overpayments, underpayments, duplicates, wrong destination/currency and unallocated receipts enter reconciliation work; never silently satisfy a different order. Already-issued account/price snapshots are not rewritten when account configuration changes.

Public APIs never list destinations. Approved checkout exposes only the selected eligible customer-facing transfer instructions after order authorization. Supplier cost, Finance notes and settlement accounts are excluded. PDFs remain private downloads with bounded signed access; reuse existing screening patterns without calling structural PDF checks malware scanning. A separate Store policy must authorize every file access.

## Payment release and cancellation

Proposed V1 release: COD may proceed through staff validation without prior collection; electronic orders are held before supplier handoff until the full due amount is Finance-verified. This policy needs owner approval and is independent of placement; supplier availability confirmation is not added to checkout.

Cancelling an unpaid attempt preserves an immutable cancelled attempt with no received-funds fact. Cancelling a funded order creates refund liability/work; it never erases verified collection. A late transfer on a cancelled order is recorded and reconciled, not discarded or used to resume fulfillment. Payment review, cancellation and fulfillment release use locks and expected revisions to avoid dispatch/refund races.

## Supplier economics and balance convention

Maintain a separate control account per **organization + Market + currency + supplier**, with every posting allocated to a fulfillment group/order line. Never net SA against EG, SAR against EGP or one supplier against another. Batches may aggregate approved same-supplier groups only with explicit allocations; no ambiguous balance on the parent order.

For a group, define:

- `P`: net customer obligation after approved selling discounts/return/cancellation credits, including applicable snapshotted charges/tax only after their treatment is approved.
- `E`: supplier's current contractual entitlement: line supply amounts + supplier delivery entitlement + approved adjustments − supplier-funded discounts − approved supplier return/cancellation credits. Tax treatment is part of the approved agreement, not guessed.
- `K_S`: Finance-verified customer collections held by supplier, minus verified customer refunds paid by that supplier. Reported/unverified collection is excluded and shown separately.
- `K_N`: verified customer collections held by Naql365, minus verified customer refunds paid by Naql365.
- `T_NS`, `T_SN`: verified internal settlement transfers Naql365→supplier and supplier→Naql365 respectively. These are not customer collections or refunds.

Supplier balance **`B = E − K_S − T_NS + T_SN`**. Positive B means Naql365 owes supplier; negative B means supplier owes Naql365. Outstanding customer collection is **`P − K_S − K_N`**; a negative value is an overpayment/refund reconciliation liability, not available margin. Holds/reservations reduce executable amounts, not historical verified balances.

The commercial spread `selling consideration − supplier entitlement − other allocated operating costs` is a management calculation with a documented basis. It is not automatically recognized revenue, net profit or taxable profit. Principal/agent presentation, taxes, delivery income and expense treatment, rebates and credit notes require legal/Finance decisions. These operational books are not asserted to be a statutory general ledger; later GL mappings need separate review.

## Worked controls (synthetic, no tax assumptions)

A frozen supplier unit cost is not itself earned entitlement or permission to pay. E postings occur only at the approved agreement's entitlement milestone (open decision D05); supplier failure before that milestone does not create an earned payable merely because checkout froze a cost. The examples below assume the stated entitlement has already been earned. Approved later credits change entitlement through new postings, never by editing its original snapshot.

| Case                                       | Facts                                                                                                                       | Result                                                                                                                                        |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| COD                                        | P=12,000; E=9,000; verified supplier collection K_S=12,000                                                                  | B=−3,000: supplier owes Naql365 3,000; no claim of 3,000 accounting revenue                                                                   |
| COD settlement                             | Supplier then remits 3,000; T_SN=3,000                                                                                      | B=0; customer collection remains 12,000, not 15,000                                                                                           |
| Electronic                                 | P=12,000; E=9,000; K_N=12,000; K_S=0                                                                                        | B=9,000 owed to supplier; Naql365-held customer cash is recorded independently                                                                |
| Partial collection                         | P=12,000; E=9,000; K_S=5,000                                                                                                | B=4,000, customer balance 7,000; proposed V1 blocks settlement execution pending collection/exception review rather than blindly paying 4,000 |
| COD full return after settlement           | Original COD settled above; approved E credit reduces E to 0; supplier refunds 12,000 so K_S=0; historic T_SN remains 3,000 | B=3,000 now owed back to supplier; append new postings, do not delete the settled batch                                                       |
| Electronic full return after supplier paid | E becomes 0; Naql365 refunds 12,000 so K_N=0; historic T_NS=9,000                                                           | B=−9,000 recoverable from supplier; customer refund is not itself supplier recovery                                                           |

If delivery fees, discounts or tax are present, allocate them once by the frozen policy and funding party before computing P/E. A return may refund only some charges; no automatic full fee refund or nonrefundability is assumed. A late supplier cost dispute cannot silently change confirmed line supply terms; use a separately approved adjustment linked to evidence.

## Ledger and settlement operations

`store_settlement_entries` is append-only. Each typed event posts a signed B effect: entitlement +E; supplier customer collection −K_S; supplier customer refund +refund; Naql365→supplier settlement −T_NS; supplier→Naql365 settlement +T_SN; approved entitlement credit reduces E. Naql365 customer collections/refunds affect their separate custody/payment book, not B a second time. Keep collection, entitlement, transfer and refund books typed; do not sum unrelated dimensions into one invented balance.

Every entry references one immutable source event, supplier, group, currency, amount, effective timestamp, actor, reason and optional original/reversal entry. A unique source/posting-kind/group constraint prevents double posting on replay. Balance projections must reconstruct from posted entries; cached totals are transactionally updated and independently reconciled. No direct staff table update of a balance is permitted.

Settlement lifecycle: prepare eligible allocations → independent approval → lock/reserve executable balance → record external execution → Finance reconcile → release reservation and post verified movement. V1 execution is manual outside the application with approved channels; no payout API is implied. An uncertain transfer remains reserved/under reconciliation, not automatically failed and re-executed. A retry reuses the durable intent and external reference. Partial executions post only the verified amount; remaining reservation is explicitly resolved. Final means the selected allocations are reconciled, not that future returns can never create a new balance.

Reconciled batches are immutable. Reversal, return, dispute or late receipt creates compensating entries/new work and may reopen the supplier account projection, while the original batch remains reconciled. Disputed amounts and approved refunds create scoped holds. Other undisputed amounts may be settled only under an approved policy. No cross-order offset, credit limit, negative-margin tolerance or automatic netting policy is invented.

## Refund and double-execution defenses

Use typed source relations for postings: collection, approved entitlement/credit, verified refund or verified settlement execution, with mutually exclusive source-kind constraints and tenant/Market foreign keys. An unchecked polymorphic identifier or free-text reconciliation reference alone is insufficient source integrity.

Customer cancellation/return request is not refund approval. Finance validates entitlement, verified original receipt allocations, prior refunds and outstanding reservations under row locks. Sum of active approved/reserved/verified refund allocations cannot exceed eligible net verified collections/approved entitlement; excess or unidentified funds use a separate reconciliation process. Currency and receiving party cannot be supplied as unchecked customer authority.

Refund approval and external execution require separate permissions and proposed maker/checker separation. Execution records payer (supplier or Naql365), exact amount, evidence and reference; independent verification closes it. Supplier-funded refunds adjust both entitlement and cash custody according to actual facts. Naql365 refunds before supplier recovery remain a receivable/exception, not a fictitious recovered settlement.

Use durable mutation dedupe, unique external execution references, locked allocation limits and append-only compensation together. Test simultaneous refunds, duplicate receiving references, split receipts, cancellation versus verification, return versus settlement reservation and uncertain external execution. A successful database response must never be treated as proof a manual external refund or settlement occurred.
