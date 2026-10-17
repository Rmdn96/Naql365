# Customer and admin UX sitemap

Proposed routes only; none exists merely because listed here. Do not generate Lovable designs during Wave 6A. Reuse Design System V2, semantic Light/Dark/System tokens, Arabic/default RTL, English/LTR and mobile navigation patterns after owner design approval.

## Public and Customer journeys

| Proposed route/pattern              | Purpose / primary action                                                              | Safe state requirements                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `/{locale}/store`                   | Store home: Market, categories, approved products and fulfillment explanation         | Honest unavailable/empty Market, no fake inventory/customer totals                                         |
| `/store/categories/[slug]`          | Category listing and bounded filters                                                  | Localized labels, contained mobile filters, no unsupported category promises                               |
| `/store/search`                     | Bounded product search                                                                | Loading, no matches, retry, stable pagination; never expose offer/cost fields                              |
| `/store/products/[slug]`            | Product/specifications, selling price/currency, delivery/returns summary, add to cart | Suspended/unavailable product, quantity validation; no supplier-cost or invented delivery ETA              |
| `/store/cart`                       | Quantity edits, fees/discount preview, next step                                      | Empty, invalid/suspended line, changed-price review, mixed-supplier restriction and safe cart conflict     |
| `/store/checkout`                   | Existing Customer recognition, delivery/contact, method and final review              | Preserve entered non-secret fields; explain unapproved method/Market and policy configuration blocks       |
| `/account/store/orders`             | Authorized Store history and next actions                                             | Bounded actual results, not combined invented Transport history                                            |
| `/account/store/orders/[reference]` | Safe placed order snapshot, fulfillment/payment/case summaries                        | Reference is a label; server maps it only within authenticated ownership                                   |
| Order payment panel                 | COD responsibility or approved transfer instructions/proof status                     | Pending, submitted, under review, rejected/resubmit, verified, refund pending/confirmed all distinguished  |
| Order tracking panel                | Customer-safe supplier fulfillment events and timestamps                              | Exception, cancelled/returned and completed; no GPS/Driver/private supplier history or Transport POD link  |
| Order cancellation/return panel     | Submit case, affected items/quantities/reason; follow decisions/refund                | Request is not approval; physical return is not completed refund                                           |
| Store guest continuation            | Equivalent scoped order journey only after security approval                          | No raw secret display, reference-only authorization, Transport guest link or automatic identity conversion |

Route nesting shown without locale prefixes in some rows is shorthand. Exact URLs and reference-versus-UUID internal routing need implementation review, not a router replacement. Existing Transport `/request`, `/guest`, `/checkout`, `/track` and account contracts remain unchanged. Customer account can later add a clearly labelled Store section using new authorized projections; existing data must not be repurposed to manufacture Store history.

Delivery address is a Store address, not a Transport pickup/delivery pair. Use existing geographic identifiers and approved supplier delivery coverage; do not impose Riyadh/Cairo Transport origin rules on Store delivery without a separate business decision. Currency is Market-derived; a locale change preserves safe Store task/Market context, never a guest capability fragment.

## Staff/admin sitemap

| Proposed workspace                  | Data / actions                                                                                | Authority boundary                                                                                |
| ----------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `/portal/store`                     | Bounded “needs attention” queues with actual displayed counts                                 | Effective Store permissions from the same selected organization; no global KPIs                   |
| `/portal/store/catalog`             | Categories, products, retail price/publication review                                         | Catalog permissions; supplier cost not implicitly visible                                         |
| `/portal/store/sourcing`            | Supplier offers/agreements and restricted economics                                           | Sourcing + cost permissions; no supplier portal                                                   |
| `/portal/store/orders` and detail   | Customer-safe order, supplier handoff/preparation/delivery, exceptions and cancellation cases | Store order operations; no funds verification controls                                            |
| `/portal/store/payments` and detail | COD collection reports, transfer proof review and actual receipts                             | Store Finance permissions, not Transport permission aliases                                       |
| `/portal/store/settlements`         | Supplier/group balances, holds, allocations, partial/final execution and reconciliation       | Separate read/prepare/approve/execute permissions; no organization-wide cross-currency net figure |
| `/portal/store/returns-refunds`     | Return decision and physical receipt versus Finance refund progress                           | Split operations/Finance duties; high-authority confirmation and clear payer/amount               |
| `/portal/store/collection-accounts` | Future approved account eligibility/configuration                                             | Explicit accounts-management permission only; no public/general dashboard destination values      |
| `/portal/store/support`             | Read-only contact/journey/case information                                                    | Narrow support projection; no cost, proof, settlement or guest-link mutation                      |

Navigation is permission-driven, not role/email labels. Keep Driver experience separate; Store supplier delivery does not create Driver assignments, Trips or POD. Existing staff shell may later receive Store links only when the new destination authority and data source exist.

## UI contracts and acceptance

Show order, payment, fulfillment and refund/settlement as separate labelled dimensions. “تم إرسال الإثبات / Proof submitted” must not look like “تم التحقق من الدفع / Payment verified”. A supplier-reported cash collection must identify reconciliation pending; no bank-received claim. Customer-facing “returned” and “refunded” are distinct.

Provide loading, empty, filtered-empty, validation, stale/conflict, error/retry, pending upload, success and disabled/unconfigured states for actual implemented surfaces. Use existing authorized facts; do not create fake state selectors in canonical UI. High-authority actions show exact amount/currency/party and consequences before confirmation; ambiguous external execution offers reconciliation, not a new pay/refund button.

Future visual acceptance is risk-based across AR/EN, SA/EG, three themes and 360/390/768/1280/1440. Verify long Arabic product names/addresses, money directionality, overflow, keyboard/dialog return focus, labels, announcements, error associations and contrast. Automate axe smoke without claiming WCAG certification. Use synthetic data, never live transfer details, secrets, private proof URLs or real customer contents in screenshots. Lovable concepts remain design references; only reviewed compatible UI enters canonical Next.js and protected Vercel acceptance.
