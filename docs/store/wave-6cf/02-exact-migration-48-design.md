# Exact proposed Migration 48 catalog-only design

**Proposed scope for explicit approval, not SQL authorization.** No `.sql` file, database call or migration number reservation. Reconcile migration tip before any later implementation; never renumber accepted history if another branch acquires number 48.

## Eleven-table review and recommended ten-table scope

All ten new relations below are proposed in the **existing `private` schema**, with RLS and explicit ACL revocation despite authenticated already having schema USAGE. Expose only the seven reviewed public RPCs below, not tables. No new schema, extension, database role, Storage bucket/policy or public view is required.

| Relation                                | Exact first-slice purpose / key requirements                                                                                                                                                                                                                                              |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `private.store_policy_versions`         | Typed draft/approved/revoked publication policy versions, org/EG Market/EGP, kind/family/version unique, validated content/evidence refs, effective interval, revision/approver. Includes an owner-controlled STOREFRONT_SCOPE kind; ordinary catalog RPCs cannot create/modify this kind |
| `private.store_suppliers`               | Staff-controlled organization supplier master, unique supplier reference, active/suspended and revision; no warehouse or supplier Auth                                                                                                                                                    |
| `private.store_supplier_agreements`     | Supplier-scoped immutable approved agreement versions with context/currency, restricted contract terms, eligibility/revocation metadata and exact `(O,M,C,supplier_id,id)` target key                                                                                                     |
| `private.store_categories`              | Same-org hierarchy, mutable draft and approved public text/path snapshot, status/revision, unique slug; parent-cycle checks under common mutex                                                                                                                                            |
| `private.store_products`                | Same-org category/SKU, mutable bilingual draft/specifications, revision and suspension; no owned stock/count or provider fields                                                                                                                                                           |
| `private.store_product_market_listings` | Unique product/Market, EGP, draft/published/suspended, selected price/offer/policy refs, frozen published content/product revision and listing revision                                                                                                                                   |
| `private.store_supplier_offers`         | Product/supplier/agreement context, stable family/version, private EGP supplier cost, draft/approval/revocation facts; exact same-product selected-offer target key                                                                                                                       |
| `private.store_market_prices`           | Listing-scoped retail amount EGP minor units, family/version, approved tax/retail display policy refs and safe display labels; immutable approved money/interval, no cost field; same-listing selected-price target key                                                                   |
| `private.store_events`                  | Private append-only catalog-only typed aggregate event, command receipt FK, actor, server/event time, revisions; exactly one of eight aggregate parents, safe versus sourcing-sensitive event fields kept distinct                                                                        |
| `private.store_command_receipts`        | Actor subject snapshot/org/operation/version/mutation key, canonical intent digest, reauthorized safe outcome; unique dedupe scope. No reverse FK to events or arbitrary authority derived from outcome JSON                                                                              |

**Deferred eleventh proposal:** `store_files`. Metadata with no authorized media workflow is unnecessary in this slice. Do not create an inert upload path, reuse Transport `file_objects`, expand existing file purposes or change `storage.objects`. Public product DTO carries `media: []`; media design requires a separate later approval. Cost confidentiality, audit, dedupe and version selection cannot be removed just to lower table count.

All entity/actor/context nullability, new target keys and FK order follow [schema review](01-schema-baseline-review.md). Referenced parents use RESTRICT/no cascade for catalog history. An actor profile reference may restrict profile deletion; final retention/anonymization behavior must be explicitly approved before user-data deployment rather than silently changing Auth deletion behavior. No Customer table/FK or existing composite-key alteration is included.

## Scope and activation contract

Canonical Store org/Market derives from one owner-approved `STOREFRONT_SCOPE` policy, never an arbitrary request org. Zero/multiple/invalid scope fails closed. Proposed partial UNIQUE on kind for nonrevoked approved scope permits at most one canonical storefront globally, including while public availability is paused. This is not a time-dependent index. Scope fields bind existing organization, EG Market and EGP, with publication enabled/paused distinct from identity. No scope row is seeded by schema.

Scope provisioning/identity change/activation is **outside ordinary catalog RPCs**, requires separate owner configuration approval and must not be inferred from a generic policy-approve grant. Normal catalog commands may edit drafts against a configured EG scope while public publication is paused or the Market inactive; public read/publish requires active EG Market and complete eligible publication policies. No automatic fallback to another organization, SA, locale or newest policy.

Other initial policy kinds are proposed as PUBLICATION_IDENTITY, RETAIL_PRESENTATION, DELIVERY_PRESENTATION and RETURNS_PRESENTATION. Their versioned schemas exclude supplier costs, payment accounts, payouts and executable tax calculations. APPROVED requires accountable supporting decisions, not a checkbox fabricated by a migration. Commercial content remains draft/unpublished while approvals are missing. Exact content validators must be supplied in the later SQL review; no free-form JSON “approved=true” escape.

## Exact public RPC surface proposed

| Function name (new, proposed)                 | SQL roles permitted EXECUTE | Contract                                                                                                                         |
| --------------------------------------------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `public.store_catalog_public_v1`              | anon, authenticated         | Bounded read-only approved retail list/detail/category, canonical EG scope, safe unavailable state, no cost or account data      |
| `public.store_catalog_workspace_v1`           | authenticated only          | Same-context staff retail drafts/published versions/eligibility, requires catalog.read; excludes costs/private contract payloads |
| `public.store_catalog_sourcing_v1`            | authenticated only          | Restricted offers/agreements/supplier costs; requires catalog.read + sourcing.manage + supplier_cost.read                        |
| `public.store_catalog_draft_command_v1`       | authenticated only          | Exact product/category/listing/retail draft operation whitelist, revision/dedupe/validation; no arbitrary tables/fields          |
| `public.store_sourcing_command_v1`            | authenticated only          | Exact supplier/agreement/offer draft/approve/revoke operations under sourcing conjunction                                        |
| `public.store_catalog_policy_command_v1`      | authenticated only          | Typed non-scope policy draft/approve/revoke operations under separate manage/approve grants; never STOREFRONT_SCOPE              |
| `public.store_catalog_publication_command_v1` | authenticated only          | Atomic publish/suspend/product suspension/category public snapshot selection, explicit grant combinations and events             |

RPC role EXECUTE is not business permission. Every staff function independently checks Auth, canonical org, one active staff context, portal.access and operation-specific codes. Revoke PUBLIC/anon/authenticated defaults before explicit grants. All command/helper functions use fixed empty search path and fully qualified objects; triggers are not directly executable by clients. No Store order/payment/fulfillment/Guest function is exposed.

## Ordered future DDL plan

1. Confirm 47-migration checksum baseline and required existing PK/UNIQUE definitions; create no existing-table key or function changes.
2. Create policy/supplier/category/product foundations and same-context keys; agreements then draft listings without selected pointers, offers and prices; add selected-pointer FKs afterward.
3. Create command receipts then typed events, their FKs, indexes and immutable identity/approved-content triggers. Category cycle guard and EG/context triggers are new Store-only functions.
4. Enable RLS, revoke all client table access and default function execution, create explicit read/command entry points plus guarded helpers/triggers. Review definer-owner privileges and cost redaction independently of RLS.
5. Insert the **seven permission definitions** in [grants review](03-rls-grants-review.md), with no role_permissions/user_roles/membership changes. No Store data, activation policy, tax/account values, supplier IDs, products or prices seeded.
6. Apply no application/UI change as part of migration. Generate official types and exact schema diff only in the separately authorized implementation environment; run the catalog acceptance matrix before any Staging apply.

Transactional additive migration only. No nontransactional index operation expected on empty new tables; no new extension for range indexes. Any deviation requires review before apply. Future apply must show no grant/policy drift on existing tables and no change to Transport Quote/Order/payment/Driver/POD/Guest facts. This design gate runs documentation checks only.
