# Unified Egypt MVP — Store purchase and fulfillment contract

## Scope and activation

Migration 50 is an additive local implementation on the accepted Finance
foundation delivery `6ab494c7dc703bba6f2e3f0afb8796b3791ed13d`.
Migrations 1–49 are immutable. No cloud application, publication, permission
grant, real receiving destination or Store activation is authorized here.

The Store is EG/EGP, registered Customer only, with one supplier per order.
Suppliers own, prepare and deliver goods. There is no inventory ownership,
supplier portal, gateway, automated payout or automatic Transport Trip creation.

## Schema and contracts

Ten private, RLS-enabled tables separate checkout authority, mutable carts,
immutable order facts, payment obligations and reconciliation:

| Table                    | Purpose                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| store_checkout_contracts | Versioned, independently approved commercial authority            |
| store_carts              | Bounded requested quantities and saved listing revisions          |
| store_orders             | Customer-owned order, independent lifecycle dimensions            |
| store_order_items        | Immutable retail, supplier entitlement and sourcing snapshots     |
| store_payments           | Independent Store payment obligation and receiving-party snapshot |
| store_payment_proofs     | Purpose-scoped reserved/submitted/abandoned evidence              |
| store_purchase_receipts  | Durable command intent and replay result                          |
| store_purchase_events    | Immutable, bounded safe audit events                              |
| store_money_operations   | Manual refund/settlement/reversal outcome tracking                |
| store_money_entries      | Immutable collection, obligation and reversal facts               |

Clients receive no direct table grants. Security-definer entry points use fixed
search paths, canonical active membership, organization and EG Market checks.
Staff require explicit Store permissions; Transport grants do not imply Store
authority. Six new permission definitions have **zero role mappings**:
`store.orders.read`, `store.orders.manage`, `store.fulfillment.manage`,
`store.payments.read`, `store.payments.verify`, `store.settlements.manage`.
Finance verification also requires `finance.verify`; settlement requires it
and `store.supplier_cost.read`. Existing catalog permissions remain unchanged.

Public RPCs are `store_shop_v1`, `store_purchase_read_v1`,
`store_purchase_command_v1`, `store_proof_path_v1` and the narrow delegating
`store_catalog_ui_command_v1`. Catalog search/category and organization/Market
filters precede bounded pagination. Customer DTOs exclude sourcing costs,
margin, internal entries and other Customers' records. No global statistics
are manufactured from capped results.

Checkout contracts explicitly specify supplier agreement, delivery regions,
delivery allocation, tax mode/rate/recipient and whether delivery is taxable,
COD release authority, financial recognition, cancellation/return permissions,
full-refund rule, approved destination IDs, AR/EN terms, evidence/legal
references and effective window. Draft and approval actors must differ.
There are no synthetic defaults for missing commercial authority.

## Checkout and execution

Checkout rechecks current publication, retail price, sourcing offer, supplier,
agreement, policy and contract revisions under transaction locks. A cart
revision creates at most one order even with different mutation IDs. Mutation
replays preserve exact intent and repeat authorization. Immutable snapshots
retain what was approved when purchased. Money uses bounded integer minor
units; application previews use BigInt and never replace SQL authority.

Order acceptance, supplier execution and payment are separate. Execution moves
through awaiting release, sent to supplier, preparing, out for delivery and
delivered. Exceptions recover to awaiting release, repeating release checks.
Transfer orders cannot be sent without Finance-confirmed payment. CASH needs
explicit approved COD release authority. Delivery alone never means payment.
Supplier suspension/agreement withdrawal prevents a new release.

## Collection and reconciliation

| Method        | Intended collector   | Verification                                                           |
| ------------- | -------------------- | ---------------------------------------------------------------------- |
| CASH          | Supplier on delivery | Report remains unverified until independent Finance reconciliation     |
| Vodafone Cash | Naql365              | Actual external receipt verified by authorized Finance                 |
| InstaPay      | Naql365              | Separate approved channel/destination and Finance receipt verification |

Proof and customer-entered reference are never confirmed funds. A private
`store-proofs` bucket uses purpose-specific access. Image proofs are normalized;
PDFs are screened and served as short-lived attachments. Reservations bind
content digest, type and size, support retry without overwrite, and can be
explicitly abandoned. These controls are not malware certification.

Migration 50 extends the Migration 49 receipt registry with typed Store targets.
Its global `(channel, external_identity)` uniqueness and normalization are
unchanged. Transport and Store confirmations use the same organization lock
and unique registry: one verified receipt cannot fund both. Refund does not
release an identity for reuse. Provider-reference namespace/collision semantics
remain an operational decision requiring evidence, not an assumed policy change.

Approved recognition determines when frozen supplier entitlement or Naql365
receivable is recorded. These are operational facts, not legal conclusions
about revenue recognition, taxable profit or merchant of record. Cancellation
and full return append linked obligation reversals. Partial refunds/settlements
are bounded by independently verified amounts. Pending or unknown outcomes
block duplicate same-kind execution until independently resolved. Existing
settlement must be resolved/reversed before refund where required. No command
sends money: a human/provider can still duplicate an external transfer outside
this application's controls.

## UI integration and limitations

Next.js routes cover catalog/product, cart/checkout, Customer order history and
detail, plus explicitly authorized catalog, order, Finance and reconciliation
workspaces. Existing AR/EN, RTL/LTR and theme infrastructure is reused. The
public Store link appears only when the catalog reports an approved active
scope; absence of Migration 50 does not break Transport navigation. Existing
orders remain readable when storefront scope is paused.

This slice supports full-order returns under an explicit FULL_REVERSAL
contract. Partial merchandise returns, deductions, subsidized delivery,
automated settlement, supplier onboarding and advanced inventory are outside
this contract. Catalog images are approved local static assets, not an
unrestricted remote-image or upload service.

## Before Staging or operations

Obtain separate migration-application authorization for 48–50 and review
recovery readiness. Supply independently approved supplier/agreement, catalog,
retail/sourcing prices, images, commercial policies, delivery regions/fees,
tax/legal treatment, COD/return/recognition rules and Store-specific receiving
destinations. Establish provider receipt identity semantics and explicit Staff
grants. None is seeded or activated by this implementation. Production,
Hostinger, DNS and main/develop integration remain unauthorized.
