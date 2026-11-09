# Egypt-only V1

Base: `feature/unified-design-system-phase-6` at `75762b580444ba0c3f0802199282dfbd8258eb97`.

## Active versus historical markets

- New public/Staff activity resolves to EG/EGP. Stale SA preference cookies resolve to EG; malformed Staff preferences fail closed. The preference never grants membership or changes organization.
- Public/guest market payloads accept EG only. Public catalogue and authorized market lists filter EG/EGP. Public, Customer, Transport, Staff and Store controls do not offer Saudi Arabia.
- Historical SA/SAR schemas remain readable under existing authorization. Currency/country unions in history, tracking, payments and diagnostics are intentional. Saudi historical contact metadata and translations are not active market-selection mechanisms.
- Existing organization membership and module permissions still run before Staff market resolution. No user, role, permission or membership migration is included.

## Server and database boundary

`20261107000100_egypt_only_v1.sql` is additive migration 52. It must be independently reviewed and separately authorized for application before releasing this source to a cloud backend. Application filtering alone is not database enforcement on an unmodified Schema 51 backend.

The migration:

1. Rejects INSERT/UPDATE on non-EG/EGP markets; permits deactivation without identity conversion. Deactivates existing non-Egypt markets without deleting or moving them.
2. Adds a late BEFORE write guard to every current application table carrying `market_id`, verifying organization + EG/EGP and any row currency. Historical Saudi rows cannot be moved into Egypt.
3. Guards marketless child writes through declared foreign-key parents (including tracking, payment events and support metadata). Uses invoker rights and existing RLS; no BYPASSRLS, role expansion or public write policy.
4. Restricts public market catalogue, optional new geography provisioning and telemetry to Egypt. Provisioning remains inactive and creates no service coverage.
5. Does not alter applied migrations, accepted financial/tax facts, Store scopes, commercial policies, Auth, membership or role grants. Audit creation remains available.

Transport request/quote/order/operations/driver/payment RPC writes hit these table boundaries. Existing Store RPCs already reject non-EG input and resolve their approved scope; their market-bearing writes receive the same database guard. No Store scope is approved, copied or activated here.

## Test contracts

Current SQL fixtures use Egypt. Tests in explicitly named `schema51-*.sql` fixtures preserve old multi-market/upgrade behavior at the historical schema version; they do **not** establish Saudi writes on Schema 52. Dedicated populated-upgrade tests verify old Saudi request/quote/order/operations/payment history survives and new Saudi writes are denied. PGlite emulates Auth/Storage helpers and is not a complete replacement for real local Supabase CI.

No cloud migration, account mutation, deployment or environment change is authorized by this change. Hosted SQL/concurrency/Auth/Storage checks remain a separate release gate where not executed locally. Never run destructive local test harnesses against cloud projects.

## Market touchpoint inventory

| Area                                                               | Enforcement / retained historical contract                                                                                           |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| Public/guest API, quick entry, telemetry                           | `src/app/api/public/market`, `src/app/api/guest/start`, `src/domain/requests/quick-entry.ts`, `src/domain/guest/analytics.ts`        |
| Public default/catalogue/cookie                                    | `src/infrastructure/markets/public.ts`, `src/domain/markets/public-contact.ts`                                                       |
| Customer request and operations pickers                            | `src/infrastructure/markets/service.ts`, `src/components/requests/wizard.tsx`, `src/infrastructure/operations/service.ts`            |
| Staff default and organization authorization                       | `src/infrastructure/identity/staff-market.ts`, unchanged `staff-context.ts` / `access.ts`                                            |
| Shared, Auth, Customer, Driver/Transport shell controls            | shared `src/components/shell/market-selector.tsx`; existing wrappers retain locale/direction                                         |
| Store/catalogue/cart/checkout                                      | `src/infrastructure/store`, `src/components/lovable/commerce.tsx`, existing EG-only `store_*_v1` RPCs                                |
| Pricing, quote acceptance, trips, assignment, payments/settlements | migration 52 write/parent guards + unchanged application permission/RPC checks                                                       |
| Historical definitions                                             | original migrations, database types, `domain/payments`, `domain/driver`, `domain/tracking`, diagnostic unions intentionally retained |
| Current SQL/parallel/browser harnesses                             | EG fixtures; historical tests explicitly pinned; local-only harness setup updated for Schema 52                                      |

## Publication safety

A GitHub branch push/PR can trigger connected Vercel Git deployments. Do not publish until project bindings and deployment prevention can be independently verified without violating this task's prohibition on Vercel setting changes. Local browser runtime initialization failed with `failed to write kernel assets: The system cannot find the path specified. (os error 3)` during this task. No push or PR is implied by preparing this branch.
