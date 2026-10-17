# Multi-supplier expansion strategy

## V1 constraint, future-compatible identities

Use supplier/offer/agreement foreign keys from the first order. Do not embed a singleton supplier UUID in application code, use product ID as supplier identity, or assume one global settlement account. The launch supplier is staff-configured and eligible per Market; multi-supplier preparation does not mean open marketplace access or supplier self-publication.

V1 selects one eligible sourcing offer per line, then validates one supplier for the whole order. Several active offers may be retained privately for future use, but public APIs expose a single Naql365 product/retail presentation. Supplier selection is server authority and snapshotted; cart input cannot pick a private cost or cheaper supplier entitlement. A mixed-source cart returns a clear restriction or owner-approved separate checkout option, never a silently split financial contract.

## Expansion without breaking accepted orders

| Step                            | New capability                                                                                           | Preserved contract                                                                                    |
| ------------------------------- | -------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Additional supplier catalogue   | Staff enrolls another supplier and Market agreement                                                      | No supplier Auth/publication portal, no reinterpretation of old lines                                 |
| Offer selection                 | Approved deterministic sourcing policy may choose among offers                                           | Retail price remains Naql365-controlled; cost hidden; choice/version frozen at placement              |
| Mixed-supplier checkout         | Explicit customer review of group charges, delivery promises and partial cancellation                    | One parent Store order/currency, multiple stable fulfillment group IDs and immutable line allocations |
| Split fulfillment               | A line's units may be allocated across supplier groups only under a new versioned checkout contract      | Sum of allocated units equals ordered units; no double collection, delivery or refund                 |
| Supplier replacement            | Before irreversible fulfillment, approved exception/novation/change record and revised supply allocation | Original commercial/supplier terms remain historical; no silent FK rewrite after dispatch             |
| Independent supplier operations | Optional later portal/API after separate security/privacy review                                         | Staff-mediated V1 events remain valid; supplier identity never inherits staff-wide Finance rights     |

Keep a `checkout_contract_version` and explicit fulfillment allocations even when V1 has one group. New consumers can accept arrays of fulfillment summaries from the beginning; existing consumers must not assume array length one forever. Version public projections when adding split quantities/refund allocation semantics. Preserve V1 snapshot interpretation and enforce its rules for old orders after expansion.

## Financial and operational isolation

Each fulfillment group has exactly one supplier and currency matching its order/Market. Supplier settlements always reference group/line allocations. A customer's single transfer may fund several future groups, but one verified receipt is allocated across them once; total allocations cannot exceed receipt. Partial return/refund reserves affected line/group amounts. Never make supplier B liable for supplier A's shortfall merely because both are in one customer order.

Customer delivery charges, discounts and applicable tax are allocated by a versioned deterministic policy. Adding groups must not duplicate a fee, shift an old discount bearer or introduce automatic FX. Group refunds and collection/settlement entries keep original allocation references. Cross-supplier netting and cross-Market/currency settlement are excluded; any future treasury conversion is a separately approved financial event, not hidden pricing.

Parent order progress is a projection of independent groups: partially preparing/delivered/returned is not universally “delivered”. Customer UI shows group-level events without private supplier economics. Operations may handle a failed group while other groups continue under an approved partial-order policy; no automatic all-or-nothing behavior is inferred.

## Expansion gates

Approve sourcing priority/fallback, customer disclosure and fee allocation, split cancellation, supplier liability, payment/refund funding and contract wording before enabling mixed-supplier carts. Test two suppliers with colliding SKU/external references, concurrent split allocation, duplicate receipt allocation, group-specific refunds, supplier replacement disputes and historical V1 replay. No retroactive backfill of single-supplier orders into new economics; add explicit allocations only if commercially equivalent and independently verified in a future reviewed migration.
