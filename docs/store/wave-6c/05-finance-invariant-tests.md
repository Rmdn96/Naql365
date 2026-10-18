# Finance and supplier settlement invariant test plan

**Specification only — tests have not been implemented or executed in Wave 6C.** Values below are synthetic integer arithmetic fixtures, not prices, tax policies, payment instructions, approved account data or accounting conclusions.

## Canonical invariants

Per `(organization, EG Market, EGP, supplier, fulfillment group)`:

- `P` = frozen customer obligation plus approved customer adjustments.
- `E` = earned supplier entitlement plus approved supply adjustments. A frozen cost is not earned entitlement; agreement milestone must actually occur.
- `K_S` / `K_N` = verified customer collections held by supplier / Naql365, minus verified customer refunds paid by that custodian. Unverified reports do not enter either balance.
- `T_NS` / `T_SN` = verified settlement transfers Naql365→supplier / supplier→Naql365, distinct from customer collection/refund.
- Supplier balance `B = E − K_S − T_NS + T_SN`. Positive is owed to supplier, negative owed to Naql365.
- Customer uncollected balance `P − K_S − K_N`; negative is overpayment/reconciliation liability, not margin. Refund liability is independently derived from approved customer credit/receipt reservations.

Typed entries must reconstruct these dimensions. Holds/reservations reduce executable amounts, not verified historical postings. Supplier collection is not bank receipt; customer refund is not supplier recovery; commercial spread is not statutory revenue/tax profit. Entries source unique events and cannot be edited/deleted; reversal quantities/amounts bounded by original unreversed facts.

## Deterministic arithmetic cases

| ID  | Fixture / operation                                                               | Required result                                                                                                  |
| --- | --------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| F01 | P=12,000, E=9,000, supplier COD verified K_S=12,000                               | B=−3,000; supplier owes Naql365; Customer owes 0                                                                 |
| F02 | F01, supplier remits T_SN=3,000                                                   | B=0; Customer collection remains 12,000                                                                          |
| F03 | P=12,000, E=9,000, verified K_N=12,000                                            | B=9,000; after T_NS=9,000, B=0                                                                                   |
| F04 | Supplier only reports 12,000, not verified                                        | K_S=0; report visible as unverified, no collection-based execution eligibility                                   |
| F05 | P=12,000, E=9,000, K_S=5,000                                                      | B=4,000, customer shortfall=7,000; settlement stays blocked under unresolved-shortage policy, never blind payout |
| F06 | After F02, full approved return credit sets P/E=0; supplier refunds12,000         | K_S=0, historic T_SN=3,000; B=3,000 owed back to supplier                                                        |
| F07 | After F03 supplier paid, full return, Naql365 refunds12,000                       | K_N=0, E=0, historic T_NS=9,000; B=−9,000 supplier recovery pending                                              |
| F08 | Frozen supply cost 9,000, no agreed earning milestone yet                         | E=0, no payable simply because order was placed                                                                  |
| F09 | Duplicate same-source collection/post/refund/settlement callback or manual replay | One receipt/entry/verified execution; same-key replay stable, conflicting intent denied                          |
| F10 | Partial external execution 2,000 of reserved3,000, rest uncertain                 | Post2,000 once, reserve remaining1,000; no second full3,000 intent                                               |
| F11 | Duplicate receipt source split across two order allocations                       | One receipt header, sum allocations ≤ actual receipt; no customer cross-order leak                               |
| F12 | Wrong Market/currency/supplier/account/source reference                           | Denied or explicit reconciliation, never auto-FX/netting                                                         |

Use synthetic approved policy stubs only within test-owned fixtures after implementation approval. Tests must distinguish “tax not configured” from a policy that lawfully produces zero, without choosing a real rate. Verify checked max-safe bounds, negative/decimal/fractional quantity rejection, multiplication overflow, sum overflow, largest-remainder tie stability and exact line/order equality. Generate partial return sequences until all original units are credited; cumulative rounding must never exceed frozen amounts.

## State/authority cases

| IDs     | Required assertions                                                                                                                                                                                |
| ------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| F13–F15 | Upload/submission/review/rejection never verifies money; verified receipt covers full funded release; underpayment/overpayment and unallocated late receipt enter reconciliation                   |
| F16–F18 | Order cancellation preserves received funds; delivered unit cannot retroactively cancel; return physical receipt and customer refund state stay independent                                        |
| F19–F21 | Supplier/customer refund funding and actual payer determine custody; settled batches immutable after returns; reversal/dispute opens compensating work, no posted-balance edit                     |
| F22–F24 | Maker/checker and scope denial, paused/unapproved account or policy fail closed, settlement timing/earning point missing blocks execution                                                          |
| F25–F27 | Duplicate external references across different mutation keys denied; unknown external result retains reservation; same-key replay after revoked membership denied                                  |
| F28–F30 | Multi-supplier readiness: two isolated group balances, no cross-supplier or currency offsets, future split allocations cannot double collect/refund even though V1 checkout forbids mixed supplier |

Cases concerning later multi-supplier writes remain future contract tests, not permission to enable those writes in V1. Property tests should generate sequences of approved events and compare ledger recomputation with every cached projection, reservation and obligation. Deliberate invalid sequences must fail without partial events or changed snapshots.

## Independent-connection race acceptance

Use at least two independent database connections with controlled barriers after header/scope lock acquisition, not timing-only parallel promises. Test with actual authenticated scopes. Inspect durable rows from a third independent readback after commit/rollback; assertions must count outcomes and verify all money/quantity conservation, not only HTTP responses.

| Race                                                | Required coherent outcome                                                                                               |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Same cart + same/different placement mutation IDs   | Exactly one order/group/obligation, one frozen commercial outcome; replay or safe conflict                              |
| Publish/suspend/price change versus checkout        | Entire old eligible snapshot or terms conflict; no mixed versions or placement after committed disqualifying suspension |
| Dispatch versus cancellation                        | Exactly one permitted physical outcome; canceled group never dispatched                                                 |
| Verify receipt versus cancellation                  | Receipt preserved; no lost funds or automatic canceled-order resurrection                                               |
| Two allocations of same receipt                     | Sum verified allocations cannot exceed receipt; uniqueness defeats double use of external source                        |
| Two refund reservations / return quantity cases     | Sum reserved+executed refund ≤ eligible credit and collection; return quantities never exceed delivered net units       |
| Return/credit versus supplier settlement reserve    | Same supplier financial scope serializes; eligible balance/holds recalculated before either operation executes          |
| Duplicate execution verification / partial reversal | Exactly one source posting, remaining allocation accurate, bounded reversal                                             |
| Permission revoke during lock wait                  | Post-wait effective authorization denies; no cached grant or stale replay bypass                                        |

## Future hosted evidence and cleanup

Run real approved Store commands against scoped synthetic Staging fixtures only after separate implementation/environment approval. Validate COD and proposed electronic flow with synthetic receiving configuration, not real funds/provider calls. Preserve Transport manual pricing/Finance clearance, Customer/Guest and Driver isolation regressions. Record application SHA, fixture ledger, money/source counts, failures/interruption history and independent cleanup/credential reuse denial. This plan supplies no current hosted PASS, financial API integration or legal eligibility evidence.
