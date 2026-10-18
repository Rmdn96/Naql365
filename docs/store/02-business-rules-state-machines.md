# Business rules and state machines

All names below are proposed Store concepts, not additions to Transport enums.

## Authoritative rules

1. Resolve organization and ownership from the authenticated Customer or approved Store guest context. Validate explicit Market against the cart, active listing, agreement and permitted delivery geography. Never accept client-selected supplier cost, tax, total, collection authority or fulfillment status.
2. Product publication, price and supplier agreement are separate versioned decisions. Global or Market suspension blocks new placement. It does not erase historical orders or automatically rewrite/cancel existing obligations; staff opens an exception case for affected placed orders.
3. No warehouse balance or supplier availability confirmation gates checkout. An active eligible offer with the supplier's fulfillment commitment is sufficient. V1 rejects a cart requiring different suppliers with a safe explanation; it must not silently drop items or choose a more expensive substitute.
4. Checkout revalidates cart revision, price/offer/agreement revisions, delivery policy and approved tax/commercial policy in one transaction. Changed terms return a conflict/new review before placing; never silently reprice. Lock the selected revisions so publication/suspension races cannot mix old and new terms.
5. Money uses integer minor units, checked multiplication/sums and explicit currency. Quantities are positive integers within approved technical bounds. Tax rounding is policy-versioned and subject to review, not an assumed copied Transport rate. No automatic FX.
6. Placement/confirmation here means accepted Store order facts, not funds received, supplier acknowledgement or legal acceptance terminology. Legal must approve customer-facing contractual wording. Immutable order-line selling and private supply snapshots are created atomically at placement.
7. One mutation identifier plus canonical intent produces one durable outcome. Same identifier/same authorized intent returns that result; different intent conflicts. Stale expected revisions fail. Database constraints/row locks, not browser state, prevent double placement, collection, refund or settlement.
8. Payment evidence, fulfillment evidence and verified cash movements are independent. Staff cannot manufacture a successful provider transfer, physical delivery, receipt or refund by changing a visual label.

## Independent dimensions

| Dimension        | Proposed states and meaning                                                                                                                                                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cart             | OPEN → CHECKED_OUT or EXPIRED/ABANDONED; only OPEN can be edited                                                                                                                                                                            |
| Order            | PLACED → CONFIRMED → CLOSED; PLACED/CONFIRMED → CANCELLED after authorized cancellation; closure needs terminal fulfillment and resolved customer money obligations, not necessarily final supplier settlement                              |
| Fulfillment      | NOT_SENT → SENT_TO_SUPPLIER → PREPARING → OUT_FOR_DELIVERY → DELIVERED; an active state may enter DELIVERY_EXCEPTION; authorized undelivered cancellation ends in CANCELLED; fully physically returned delivered groups may end in RETURNED |
| Transfer attempt | PENDING → PROOF_SUBMITTED → UNDER_REVIEW → VERIFIED or REJECTED; PENDING/SUBMITTED/REVIEW may be CANCELLED only while no verified receipt is attached                                                                                       |
| COD collection   | EXPECTED → REPORTED → VERIFIED or DISPUTED; verified actual amount may be partial and records the supplier as custodian, not Naql365's bank                                                                                                 |
| Refund           | REQUESTED → APPROVED → RESERVED → EXECUTION_REPORTED → VERIFIED; rejection/cancellation before external execution; uncertain execution remains reconciliation pending                                                                       |
| Settlement batch | DRAFT → APPROVED → RESERVED → EXECUTION_REPORTED → RECONCILED; rejection/void before execution, DISPUTED for uncertain/contested results                                                                                                    |
| Return case      | REQUESTED → APPROVED → RECEIVED → RESOLVED, or REJECTED/WITHDRAWN; financial refund remains independent                                                                                                                                     |

Order payment summaries may display PENDING, PROOF_SUBMITTED, UNDER_REVIEW, REJECTED, VERIFIED, PARTIALLY_REFUNDED or REFUNDED based on underlying facts. They are projections, not a replacement for attempt, receipt and refund records. Cancelling an order never converts received money into a cancelled/unpaid receipt. Rejected proof remains immutable; resubmission creates a new attempt.

## Transition guards and exceptions

Partial returns remain item quantities and derived summaries; RETURNED applies only after all eligible delivered quantities in the group are physically received. A return request or approved refund does not establish physical receipt. CANCELLED groups cannot dispatch. These terminal facts preserve their preceding delivery/cancellation audit history.

| Event                            | Guard / effect                                                                                                                                                                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Place order                      | Valid current cart and approved commercial/payment policy; atomically snapshot lines, create one fulfillment group and payment obligation. No supplier confirmation wait                                                                          |
| Confirm/release to supplier      | Proposed V1: COD placement can release after normal staff validation; transfer orders require Finance-verified funding covering the due amount. Owner must approve this release policy. Checkout itself is not blocked on supplier confirmation   |
| Record supplier handoff          | Staff uses an existing authorized Store command and records channel/time/reference; “sent” is a staff attestation, not an automated guarantee that supplier read it                                                                               |
| Preparing / dispatch             | Correct supplier group, expected revision, actor permission, no cancellation/return conflict and required collection policy satisfied                                                                                                             |
| Delivered                        | Evidence, event time and actor recorded; missing COD cash is still a collection exception, not implicit payment verification                                                                                                                      |
| Fulfillment failure              | Supplier inability, damaged goods, refusal, loss or unavailable product opens a reasoned exception with affected quantities and responsible party; staff chooses retry, approved cancellation or return/refund process                            |
| Resume exception                 | Explicit allowed resume target and new evidence; do not roll completed events backward or erase failed delivery attempts                                                                                                                          |
| Cancellation                     | Customer request is distinct from staff approval. Proposed immediate pre-handoff handling remains policy-gated; after handoff, coordinate supplier/interception first. Already delivered quantities require returns, not retroactive cancellation |
| Return                           | Cumulative received/approved quantities cannot exceed delivered quantities minus earlier returns; lock affected lines and reserve outstanding cases to prevent concurrent over-return                                                             |
| Refund                           | Reason/entitlement and verified original receipts, remaining refundable allocation and payer identity required. Approval does not prove external refund execution                                                                                 |
| Late transfer after cancellation | Finance records/reconciles actual receipt into refund/review work; do not resurrect canceled fulfillment automatically                                                                                                                            |
| Reversal                         | Append a linked compensating event/posting with approval; no deletion of confirmed receipt, commercial line or reconciled settlement                                                                                                              |

An order with partial cancellation or return retains its original lines and amounts. Adjustment/return lines record quantities, approved credits, tax-credit policy references and funding responsibility. Customer status derives from all fulfillment groups and cases, rather than one mutable “everything done” status.

## Consistency and audit

Lock order → fulfillment/line → payment/refund/settlement allocations in a documented common order. Recheck membership and state after waiting on locks. Deny backwards transitions, stale revisions, over-collection allocations and excessive refund/settlement reservations. Concurrent cancellation versus supplier dispatch must yield exactly one authorized outcome and an actionable conflict for the loser.

Each successful command atomically writes actor category, organization/Market, business aggregate/revision, mutation ID, event type/time, reason and relevant snapshot references. Separate customer-safe event payloads from internal financial/audit metadata. Do not log tokens, payment destinations, proof paths or private customer contact. Supplier communication uses manual recorded actions in V1; a future outbox can coordinate external sends without pretending a database commit is external delivery.
