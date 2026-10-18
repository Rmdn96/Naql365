# Catalog foundation implementation contracts

Design authority: [Wave 6C-F](../wave-6cf/README.md). This implements the catalog
slice only; no application route/action/Store UI, cart/order/payment/settlement,
supplier portal, stock system, media upload or Storage bucket.

## Tables and isolation

Ten new tables are private, RLS enabled with no permissive client policies. All
client/anon/service-role direct ACLs are revoked. Public RPC owners are postgres;
owner bypass of RLS is intentional and independently guarded inside functions.
Private helper execution is revoked. Every function uses an empty search_path.

| Table                         | Purpose                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| store_policy_versions         | Typed versioned policies; owner-only canonical EG/EGP scope and separate pause                 |
| store_suppliers               | Organization supplier master; no inventory/Auth ownership                                      |
| store_supplier_agreements     | Private immutable approved agreement versions                                                  |
| store_categories              | Draft hierarchy and separately frozen public parent/path/content                               |
| store_products                | Draft bilingual product/SKU content and independent suspension                                 |
| store_product_market_listings | EG/EGP listing; exact selected versions, frozen category/content/product revision              |
| store_supplier_offers         | Same-product/supplier/agreement cost versions; private sourcing only                           |
| store_market_prices           | Same-listing retail versions in EGP minor units                                                |
| store_events                  | Append-only typed aggregate/receipt FK; public-content and private selection history separated |
| store_command_receipts        | Durable actor/org/family/version/mutation dedupe, digest and safe outcome                      |

All roots reference the existing organization PK. Monetary tuples reference the
existing markets `(organization_id,id,currency)` key. New same-org/context UNIQUE
keys support same-supplier agreement, same-product offer and same-listing price
selection FKs. Selection FKs are installed after listing/price creation to resolve
the schema cycle. No existing FK/key/enum/role/RLS definition is altered.

## Permissions and context

Definitions only: `store.catalog.read`, `store.catalog.manage`,
`store.catalog.publish`, `store.sourcing.manage`, `store.supplier_cost.read`,
`store.catalog.policy.manage`, `store.catalog.policy.approve`.

Every staff RPC independently requires Auth UID, exactly one globally active
membership, staff category, the canonical configured organization/EG Market,
portal.access and store.catalog.read. Read-only context arguments assert that
scope; they never select another tenant. There is no email, metadata, role-name
or SUPER_ADMIN shortcut. No role grant is seeded or inferred from Finance access.

## Seven public RPCs

| RPC                                  | Required additional grants                        | Output                                                                                |
| ------------------------------------ | ------------------------------------------------- | ------------------------------------------------------------------------------------- |
| store_catalog_public_v1              | anon/authenticated execution, no staff grant      | Only effective published retail/category snapshots; no private IDs/costs; media empty |
| store_catalog_workspace_v1           | read; policy list also policy.manage              | Explicit retail draft/status/page whitelist; no sourcing economics/evidence           |
| store_catalog_sourcing_v1            | sourcing.manage AND supplier_cost.read            | Explicit authorized supplier/agreement/offer cost fields                              |
| store_catalog_draft_command_v1       | manage                                            | Safe ID/revision/state/contract/replay result                                         |
| store_sourcing_command_v1            | sourcing.manage AND supplier_cost.read            | Same safe command result, reauthorized before replay                                  |
| store_catalog_policy_command_v1      | policy.manage; approve/revoke also policy.approve | Non-scope policies only                                                               |
| store_catalog_publication_command_v1 | manage AND publish                                | Explicit category/price approval, listing selection or suspension                     |

All commands have `(p_org,p_market,p_operation,p_mutation,p_target,p_expected,
p_payload,p_version default 1)`. Create requires null target/revision; saves and
transitions require current revision. Full replacement draft payloads are used,
not arbitrary JSON patch paths. Context/actor/state/approval time derive from DB.
Unknown fields and wrong scalar types are rejected; no client-supplied SQL/table.

Read pages are deterministic keyset, default 20/max 50. Public cursor is immutable
slug; private cursor is UUID. Public search <=120 characters; public country must
be EG. Invalid/unavailable public scope returns safe NOT_AVAILABLE without private
eligibility reasons. No adapter/cache/UI is introduced; future adapters must use
no-store and revalidate authorization/eligibility independently.

## Payload families

| Entity/operation                                                                           | Required payload                                                                                                                           | Optional fields                                |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------- |
| create_category                                                                            | slug, content                                                                                                                              | parent_id                                      |
| save_category                                                                              | content                                                                                                                                    | parent_id (omitted clears draft parent)        |
| create_product                                                                             | sku, slug, category_id, content                                                                                                            | none                                           |
| save_product                                                                               | category_id, content                                                                                                                       | none                                           |
| create_listing / save_listing                                                              | product_id / empty object                                                                                                                  | none                                           |
| create_price                                                                               | listing_id, version, presentation_policy_id, effective_from                                                                                | amount_minor, effective_until                  |
| save_price                                                                                 | presentation_policy_id, effective_from                                                                                                     | amount_minor, effective_until                  |
| create_supplier / save_supplier                                                            | reference and name / name                                                                                                                  | none                                           |
| create_agreement                                                                           | supplier_id, agreement_code, version, terms, effective_from                                                                                | evidence_ref, effective_until                  |
| save_agreement                                                                             | terms, effective_from                                                                                                                      | evidence_ref, effective_until                  |
| create_offer                                                                               | product_id, supplier_id, agreement_id, offer_key, version, effective_from                                                                  | unit_cost_minor, evidence_ref, effective_until |
| save_offer                                                                                 | effective_from                                                                                                                             | unit_cost_minor, evidence_ref, effective_until |
| create_policy                                                                              | kind, policy_code, version, content, effective_from                                                                                        | evidence_ref, effective_until                  |
| save_policy                                                                                | content, effective_from                                                                                                                    | evidence_ref, effective_until                  |
| approve_policy/agreement/offer/price                                                       | empty object                                                                                                                               | none                                           |
| revoke_policy/agreement/offer/price                                                        | reason                                                                                                                                     | none                                           |
| suspend_supplier/resume_supplier; suspend_product/resume_product; suspend_listing/category | reason                                                                                                                                     | none                                           |
| approve_category                                                                           | parent_revision (null for root)                                                                                                            | none                                           |
| publish_listing                                                                            | product_revision, category_revision; price_id/revision; offer_id/revision; identity/delivery/returns_policy_id and corresponding revisions | none                                           |

Content is bilingual title_ar/title_en (1–200 chars); product content optionally
description_ar/description_en (1–4000) and <=30 typed specification entries with
bilingual labels (<=200) and values (<=500). No HTML is accepted. SKU <=80 and slug
<=100 use restricted character sets. Category draft and public trees both reject
cycles/depth >4; publication freezes ancestor labels/paths and parent separately.

Non-scope policies accept only title_ar/title_en/body_ar/body_en. Bodies <=4000;
policy kinds PUBLICATION_IDENTITY, RETAIL_PRESENTATION, DELIVERY_PRESENTATION,
RETURNS_PRESENTATION. No executable tax/provider/payment-account JSON is accepted.
Scope content accepts only a boolean publication_enabled; no ordinary command can
create/change it. The separate scope_paused defaults true and is owner-only.
Changing pause retains canonical identity. No scope row is installed.

Agreement terms are only private reference (<=200) and summary (<=4000), not a
settlement/pricing formula. Approved agreement/policy/offer needs evidence_ref and
server-authenticated approver/time. Such shape validation cannot establish the
truth/legal sufficiency of a decision; those owner gates remain.

Money is integer minor units, no FX/calculations/default amount. Retail >0 on
approval; cost >=0 only if explicitly provided. Upper bound 9,007,199,254,740,991.
Draft missing money remains null. Approved identity/terms/amount/interval/parent
bindings cannot be rewritten; new versions are required. Selected approved
versions may overlap in time but never auto-switch to latest. Future/expired or
revoked versions cannot make a public listing eligible.

## Concurrency, replay and audit

All commands acquire a transaction-scoped Store-only organization advisory mutex,
then re-resolve canonical staff/context/effective permissions from fresh state.
All Store integrity triggers participate. No Transport/organization row is used
as a mutex. Permission and membership loss while waiting denies the write/replay.

Receipt scope: actor subject + org + command family + version + mutation UUID.
SHA-256 canonical JSON intent includes operation, target, expected revision,
Market, version and complete payload. Same intent replays; changed intent PT409.
Mutation, append-only event and receipt commit/abort together. No 40001 optimistic
conflict is generated. PT409 means revision/state/intent conflict, PT404 hidden
target unavailable, 42501 forbidden, 22023 invalid safe intent. FK/unique/constraint
errors are sanitized inside commands; no private FK row or amount is echoed.

Events have exactly one of eight typed parent references and a receipt FK. No
generic audit_change trigger is attached. Retail projections never serialize raw
event/receipt JSON, evidence, terms or selected sourcing identifiers. Publication
history retains prior/current content and private version selection separately.
Receipts contain safe outcomes only; sourcing replay rechecks its grant conjunction.

Public reads check active EG Market, unpaused approved scope, product/frozen-category
eligibility, exact approved selected price/offer/agreement/supplier/policies and
effective intervals in one statement snapshot. Draft edits do not merge into
published content. Suspension suppresses subsequent reads without rewriting frozen
versions. Restoring a dependency can restore an otherwise-published listing, while
explicit listing/product suspension requires authorized republish/resume.
