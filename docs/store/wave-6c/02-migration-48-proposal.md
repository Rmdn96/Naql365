# Migration 48 design proposal — not an authorized migration

No `.sql` file is created, no number reserved in migration history and no SQL executed. Existing migrations 1–47 remain immutable. Filename/timestamp is TBD at separately approved implementation time, after rebasing on the then-current accepted migration tip; do not renumber another branch's migration to claim 48.

## Recommended first additive slice

Migration 48 should establish only the **catalog/sourcing foundation**, not every V1 finance table. Proposed scope is 11 relations from [schema](01-v1-schema.md): policies, suppliers, agreements, categories, products, Market listings, offers, retail prices, purpose-bound files, events and command receipts. Events initially permit only actually implemented catalog aggregates; later slices extend typed FKs/constraints explicitly, without unvalidated future IDs. No cart/order/money functions in this first migration.

Create minimal permission codes needed for catalog/sourcing reads, edits and controlled publication. Permission definitions are not grants. No role automatically receives Store authority, including SUPER_ADMIN. No inherited Transport Finance scope, guest permission or service-role application client. Approve exact grants separately; seeded permission metadata alone must not cause navigation or public availability.

## Ordered design steps within the future transaction

1. Preflight existing organization/Market/reference keys and function conventions; ensure planned tenant FKs are enforceable without modifying Transport semantics. Record canonical 47-migration hashes. Any missing key requiring existing-table alteration returns to owner review.
2. Create policy/supplier/category/product foundations with restrictive defaults. Add agreement/offer/price versions and listing links in dependency order; selected offer/price links may be added after their tables exist to avoid invalid circular DDL ordering.
3. Add purpose-bound Store file metadata and restrictive private bucket policies only if the approved storage design is in this slice. No public proof purpose, bucket listing or generic legacy file-policy broadening. Optional catalog media can remain absent until reviewed, never routed through Transport evidence permissions.
4. Add typed catalog events/command receipts, indexes, immutability triggers and composite FKs. Use approved existing schemas/owners; private cost/agreements stay outside public readable projections.
5. Enable RLS before exposure; revoke default direct table writes and PUBLIC function execution. Add fixed-search-path narrow functions, explicit grants and positive/negative policies as a single reviewed security boundary. No partially unsecured deployment window.
6. Add catalog-only versioned commands and public retail projection, gated by complete approved publication policy and active EG listing. Public function must be read-only and return enumerated fields; private costs never in nested JSON.
7. Add permission definitions without grants, default-disabled Store activation semantics and tests. Do not seed products, supplier IDs, prices, tax/account policy values, collection accounts or legal approvals.

Treat migration 48 as one transactional additive schema change with no destructive backfill, no business activation and no alteration to existing enums/Quote/Order/Trip/payment/Guest functions. A second migration is needed only after a later approved slice; this document does not authorize it now. Avoid embedding UI concerns, mock data or fictional “approved” policy records in SQL.

## Subsequent slice dependencies (not migration assignments)

| Logical slice     | Depends on                                                                   | Future additions                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Cart/placement    | Catalog/version rules plus approved commercial policy                        | Carts/items, orders/groups/items/private supply terms, obligations, checkout commands; no payable at placement merely from cost |
| Fulfillment/cases | Placed orders, approved supplier/delivery/return terms                       | Case/item/adjustment relations, guarded physical transitions and customer-safe events                                           |
| Collection/proofs | Obligations, approved accounts/provider eligibility and private Storage      | Account versions, collections/allocations, proof lifecycle, authorized verification/release                                     |
| Refund/settlement | Verified custody, approved earned entitlement and execution responsibilities | Refunds/allocations, settlements/allocations, common execution intents and typed financial entries                              |

Before each slice: approve exact DDL/RLS/contracts and generated types, reconstruct fresh DB, upgrade a populated 47-baseline fixture, test all completed slices and Transport. Never deploy UI calling uninstalled commands or claim full checkout readiness from catalog-only migration success.

## Required evidence before any apply

Owner approves the exact future migration diff and grant plan; rollback/forward-fix plan reviewed; fresh and populated upgrades pass; FK/immutability/RLS/function grants prove fail-closed defaults; official generated types match exact schema; no preexisting commercial row or role grant changes. Store remains inactive until independent configuration/activation approval. Staging apply and Production apply are distinct later permissions, neither authorized by Wave 6C.
