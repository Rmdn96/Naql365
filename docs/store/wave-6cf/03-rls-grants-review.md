# Catalog RLS, grants and supplier-cost review

## Exact permission definitions proposed for this slice

No slash/wildcard aliases. Migration would insert only missing code definitions; no grants are executed now or bundled automatically later.

| Exact code                     | Authorized purpose                                                                                                                                     |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `store.catalog.read`           | Staff retail/catalog draft and publication workspace only                                                                                              |
| `store.catalog.manage`         | Create/edit product/category/listing/retail-price drafts; requires read                                                                                |
| `store.catalog.publish`        | Freeze/select public retail versions, publish or suspend; requires read+manage                                                                         |
| `store.sourcing.manage`        | Supplier/agreement/offer administration; requires read+supplier_cost.read                                                                              |
| `store.supplier_cost.read`     | Restricted sourcing economics only with read+sourcing.manage; no automatic catalog publish                                                             |
| `store.catalog.policy.manage`  | Draft typed non-scope publication policy versions; requires read                                                                                       |
| `store.catalog.policy.approve` | Approve/revoke typed non-scope policies; requires read+policy.manage; no authority to provision/replace canonical Store scope or invent legal approval |

The last two refine Wave 6C's previously unspecified policy-approval authority and therefore need explicit owner approval. No store Finance/order/settlement/refund/Support/Guest/account-management permission is created in this catalog slice. Canonical permission definitions remain in existing public.permissions without changing its constraints or resolver.

## Context, global grants and proposed grant review

Each authenticated entry point requires Auth UID, exactly one active membership globally for that user, that membership staff in configured Store org, portal.access, and operation permission conjunction. Use the existing effective-permission resolver with that same org; it already constrains member_type through role linkage but is not a replacement for explicit staff/context checks. No email/metadata/role-label shortcut, cross-tenant union or SUPERA hardcoded bypass.

Existing role_permissions has no organization column. Owner must decide the impact of any future global role grant. Do not label a grant to existing SALES/FINANCE/SUPER_ADMIN as “for this org only”. A distinct Store grant table or membership override system is **not authorized** and is not added. Recommended initial migration: definitions only, zero role grants. A later separately approved exact grant change may target existing staff roles with documented global effect plus canonical storefront guard; it must never include permissions by wildcard.

| Persona / desired function      | Proposed minimum explicit grants (in addition to portal.access)        | Default outcome now                                                                                             |
| ------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| SUPER_ADMIN                     | Only explicitly reviewed task grants; not automatically every new code | Denied without new grants                                                                                       |
| Catalog editor (could be SALES) | catalog.read + catalog.manage                                          | No costs, source/contract or policy approval                                                                    |
| Catalog publisher               | read + manage + publish                                                | Publication only after approved source/policy eligibility; no cost read required to see safe eligibility result |
| Sourcing operator               | read + sourcing.manage + supplier_cost.read                            | Private economics, no publication by implication                                                                |
| Policy drafter/approver         | read + policy.manage; approval additionally policy.approve             | Scope provisioning remains excluded; approved legal evidence still required                                     |
| Finance / Operations / Support  | None automatically                                                     | No Store cost/catalog command authority merely from Transport permissions                                       |
| CUSTOMER / DRIVER               | No catalog staff grants                                                | Public approved retail only, outside staff workspace                                                            |

Maker/checker policy for catalog/legal approval is an owner decision; minimum implementation must record actor/evidence and never conflate technical approval with legal decision. If separation is selected, enforce approver identity distinct from drafter in DB, not only disabled UI.

## Table ACL and RLS plan

All ten relations private; RLS enabled; revoke table SELECT/INSERT/UPDATE/DELETE and sequence privileges from PUBLIC, anon and authenticated. No permissive client table policy is created. Private-schema USAGE already granted does not defeat table/function ACLs. No change to existing public/Storage grants. No client can bypass commands through PostgREST, private view exposure or generic audit routes.

Public retail function and authenticated projections are deliberate SECURITY DEFINER boundaries if necessary to read private tables. Owners can bypass RLS; prove authorization/redaction inside each function independently. Fixed empty search_path, fully qualified objects, no dynamic caller SQL, no service-role application client, private helpers with EXECUTE revoked from clients. A function owner must not be an application credential or a role users can assume. Exact future SQL review must document owner and grants rather than assume RLS constrains a superuser.

| Data                                       | Safe projection / restriction                                                                                                                                                            |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Products/categories/listings/retail prices | Public gets only approved snapshot, version-safe retail amount/currency/labels, category presentation, safe availability, media empty. Draft fields/private IDs never serialized         |
| Suppliers/agreements/offers                | Only sourcing projection under full conjunction; public/workspace returns a boolean/general eligibility reason, never private cost/discount/contract details                             |
| Policies                                   | Staff policy projection only authorized typed content; public receives approved display text, never internal evidence/approval documents. Scope identity not editable via policy command |
| Events                                     | Staff workspace sees allowlisted retail events only; sensitive source events require sourcing conjunction. No `audit.read` Transport shortcut, no raw event JSON export                  |
| Command receipts                           | Same reauthorized actor/context/operation replay only. Recheck private-data permission before returning sourcing result. Mutation key or resource ID alone is not authority              |

Do not attach existing generic private.audit_change to Store private commercial tables: it copies whole row before/after into audit_logs readable by existing audit.read. Use new redacted Store events; no supplier terms in generic logs/error messages. RLS cannot protect a cost hidden only in frontend or nested within otherwise public JSON.

## Public eligibility and side-channel contract

Public caller never selects authoritative org/supplier/currency. Function resolves approved canonical scope, validates requested country is EG (if provided), active Market/currency, public pause flag, current product/category/listing eligibility, selected approved price/offer/agreement/policies and their effective intervals in one statement-consistent projection. Safe NOT_AVAILABLE returns no hidden reason such as supplier margin or agreement dispute. No arbitrary replacement version/SA FX/default-zero price.

Do not expose counts, source IDs, raw FK/unique errors, private intent digests or timing-dependent detailed refusal data. Bound inputs and pagination. Public retail reads should not cache past a suspension/expiry without revalidation; initial contract uses no-store at adapter and no public price cache. A read whose snapshot predates a concurrent suspension can complete with the old coherent snapshot; all new reads after commit must exclude it. Future checkout independently revalidates, but checkout is absent now.

Catalog RPC execution grants do not alter existing Auth, cookies, callbacks, Transport Guest grants, staff navigation or Customer/Driver destination. A future UI needs separately approved source port; hidden links never replace destination/function checks.
