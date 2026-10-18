# Store V1 product requirements

Design proposal; see the [approval contract](README.md). No implementation authorization is implied.

## Product and operating model

Naql365 Store is one branded customer-facing storefront for supplier-fulfilled goods. Naql365 controls presentation, selling prices, checkout and customer order management. Suppliers retain their inventory, prepare orders and deliver physically. Naql365 neither purchases warehouse stock nor runs an owned-stock system in V1. Product sourcing cost is a contractual commercial obligation, not proof of stock ownership or a conclusion about legal title.

Launch uses one configured supplier, selected through validated agreements/offers rather than a hardcoded identifier. Suppliers cannot self-register, log into a supplier portal or independently publish. Naql365 staff administer all supplier communications. Multiple suppliers/offers are modelled for future expansion; V1 validates that every line can use the same single fulfillment supplier.

The initial supplier's fulfillment commitment permits positive requested quantities without a stock-reservation counter or availability-confirmation step before checkout. This is not a guarantee of infinite physical supply. Technical quantity/order-value limits protect against abuse and arithmetic overflow; they must not be presented as warehouse inventory. Actual shortfalls create exceptions and cancellation/refund work, not retrospective deletion of orders.

## Scope and functional acceptance

| Capability           | Required V1 behavior                                                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Discovery            | Localized Store homepage, categories, bounded search, product detail, approved images and clear Market/currency                               |
| Publication          | Naql365 staff publish/suspend per Market; only approved selling information is public                                                         |
| Cart                 | One organization/Market/currency; server validates products, quantities, current price revisions and sourcing eligibility                     |
| Checkout             | Delivery/contact details, transparent amounts and delivery charges, enabled payment methods, final review and versioned terms acknowledgement |
| Order placement      | Transactional, idempotent, immutable commercial snapshots; no supplier availability-confirmation prerequisite                                 |
| Payment              | Supplier COD or separately approved Naql365 electronic collection; proof submission is never verified funds                                   |
| Fulfillment          | Staff records supplier dispatch/preparation/delivery and exceptions with evidence; no invented live tracking                                  |
| Account              | Store order history, current next action and safe detail/tracking, separately labelled from Transport                                         |
| Cancellation/returns | Customer requests and staff decisions, item quantities/reasons/evidence and independent refund progress                                       |
| Finance              | Verified collection, supplier balances, partial/final settlement, refund reservations and reconciliation history                              |

Use existing confirmed Customer identity, profile and active organization membership where applicable. Opening Store must not bootstrap extra Customers/roles or convert STAFF/DRIVER identities. Guest checkout is **not enabled by default**: review and explicit approval of [the Store-specific contract](05-security-rbac-rls.md#guest-checkout-contract-proposed-gated) precede any implementation.

## Markets and commercial policy

The operating storefront organization is configured by Naql365, resolved server-side and checked against authenticated ownership. Customers cannot select a tenant through form fields. A Market switch selects that Market's separate cart; it never converts prices or rewrites an existing cart/order. Proposed V1 permits one OPEN cart per authorized owner, organization and Market; checkout revalidates that context independently of public preference cookies.

SA and EG are isolated Markets. Selling prices are explicitly authored in each Market's currency; locale does not determine Market and automatic FX is not authoritative pricing. A single supplier may be eligible in one Market and not another. Do not advertise nationwide Store delivery based on Transport coverage or silently activate cities. Store supplier delivery geography/fees need their own approved configuration and address validation; existing geography identifiers may be referenced.

Egypt's proposed transfer methods are Vodafone Cash and InstaPay, subject to account/provider/legal approval. Saudi methods, including launch eligibility of COD there, need separate owner decisions. Absence of an approved method/tax/merchant policy blocks checkout in that Market rather than supplying a guessed default. No rates, wallet identifiers or account instructions are specified here.

Store has explicitly set retail prices; it does not invoke or alter Transport's MANUAL/AUTOMATED pricing engine. Supplier cost, selling price, quantity, discount funding and delivery allocation are distinct. Confirmed line terms remain frozen after product, price, agreement or supplier suspension changes. Gross commercial spread is an operational measure, not automatically accounting revenue or taxable profit.

## Customer promises and non-goals

Customer copy must distinguish “Order placed / تم استلام الطلب”, payment awaiting verification, preparation, supplier-reported dispatch and actual delivery. No guaranteed ETA, GPS, Driver identity, verified-payment claim on upload, or inventory count without an authorized source. Show unavailable methods and recoverable errors honestly.

Out of scope: open marketplace, supplier portal/self-publication, procurement/warehouses, Transport order conversion, combined Store/Transport checkout, automated wallet payouts/refunds, background tracking, global analytics, new Auth, legal publication and Production. No changes to existing Transport Orders, Payments, Finance clearance, Driver/POD or Guest security.

Success is established by the [roadmap gates](08-implementation-roadmap.md), not by fabricated orders or screenshot-only successful commands. The full Store experience must support Arabic/default RTL, English/LTR, SA/EG, Light/Dark/System and 360/390/768/1280/1440px.
