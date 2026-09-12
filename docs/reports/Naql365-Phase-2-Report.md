# Naql365 — Phase 2 Report

## A. Starting State

Phase 1 was accepted and merged before this phase. Work continued on the dedicated Phase 2 feature branch; no foundation was recreated.

## B. Git Baseline

Accepted develop: `4d3b25730e3b604882a860ade414f98fd888766b`. Branch: `feature/phase-2-smart-quote-pricing`. Preserved schema-gap commit: `90b944c57d3865c65393505c58ae87b4005cdb3f`. No merge to develop/main is authorized by this report.

## C. Domain/Schema Gap Analysis

The committed inspection in [pricing-and-quotes.md](../pricing-and-quotes.md) precedes implementation and separates existing relations, additive changes and deferred operations. Existing quote/version/item/order tables were extended.

## D. Architecture

Localized server-rendered Sales/customer pages call validated server adapters. PostgreSQL command functions own authorization, calculations, immutable snapshots and transitions. RLS remains authoritative for reads and writes. No pricing authority lives in React.

## E. Migrations

Four additive migrations (`20260910000400`–`20260910000700`) follow the six accepted migrations: pricing schema, transactional commands, commercial RLS and durable expiry. Ten migrations reconstruct in CI. Final hosted verification passed all shared SQL assertions. The Staging history contains all ten repository migration versions, 47 of 47 public tables have RLS, and freshly generated types exactly match the committed types and pass typecheck.

## F. Pricing Rules

Tenant-scoped, effective-dated, versioned rules cover service, distance, vehicle, workers, loading/unloading, floors/elevator, packing, disassembly/assembly and within/intercity transport. Fixed, per-unit and per-km calculations remain explainable. Staging catalogue amounts are acceptance fixtures, not approved Production tariffs.

## G. Distance

Owner-approved MANUAL_VERIFIED road distance is the temporary authority. Authorized Sales enters externally verified km; server enforces positive <=5,000 with <=3 decimal places and records actor/time/note plus origin/destination references. Corrections create new evaluations and stale previous ones. ROUTING_PROVIDER is a future boundary only: no provider/key/integration is claimed.

## H. Money/Rounding

SAR uses integer halala and PostgreSQL exact numeric multiplication. Non-negative component/VAT values round half-up to the nearest halala. Server validation rejects unsafe money inputs. Decimal distance validation avoids rejecting valid 1.001 km due to JavaScript multiplication artifacts.

## I. VAT

Tenant pricing_settings stores VAT basis points. Each version preserves its used rate, VAT and total. Customer UI displays Subtotal, VAT and Total separately. No tax filing/accounting integration is included.

## J. Preliminary Calculation

Sales opens a submitted request, selects planning vehicle/workers and verifies distance. calculate_preliminary_price reads submitted request selections and effective rules, stores component lines and a preliminary subtotal. Nothing is binding until Sales sends an eligible quote.

## K. Pricing Snapshot

Evaluation preserves request revision, route scope, workers, vehicle, immutable distance and applied rule identifiers/versions with exact component quantities and amounts. Historical explanation does not depend on current rule prices.

## L. Sales Review

AR/EN Sales queue and detail expose submitted request summary, preliminary breakdown and draft controls. Vehicle/workers are planning inputs, never operational assignments.

## M. Manual Adjustment

Draft creation preserves calculated subtotal separately from signed manual adjustment, required nonempty reason and final subtotal. Internal adjustment reasons/evaluation details are separated from customer-readable commercial lines.

## N. Quote Lifecycle

DRAFT -> SENT -> VIEWED -> ACCEPTED/REJECTED/EXPIRED; newer sent versions supersede eligible earlier versions. Commands validate actor, tenant and current state.

## O. Quote Versioning

Each commercial revision is a new positive version. Database guards freeze sent commercial facts and items. A distance correction cannot rewrite sent history.

## P. Quote Expiry

Default validity is 48 hours, configurable by Sales before sending. Database wall-clock checks govern eligibility. Expired acceptance persists EXPIRED and returns a structured validation failure without creating an Order.

## Q. Customer Quote Experience

Authenticated customers see only their own customer-safe versions. AR/EN list/detail render reference, commercial components, verified distance source, subtotal/VAT/total, expiry and eligible actions. Internal rules and adjustment reasons are not exposed.

## R. Acceptance

Ownership and active membership are rechecked inside the transaction. Acceptance creates the Order from immutable sent version facts and returns the existing Order on replay.

## S. Rejection

Eligible customer rejection records state/reason and audit event. Replay is safe; rejected versions cannot be accepted.

## T. Supersession

Sending a revision transactionally supersedes the previous eligible version. Superseded versions cannot create Orders.

## U. Order Creation

Exactly-one Order links accepted version, quote, request, customer and organization. Commercial amount/VAT/distance facts are copied from the accepted version; no fresh recalculation or dispatch/payment execution occurs.

## V. RLS/Authorization

SQL assertions cover customer and unauthorized/cross-tenant staff distance denial, cross-customer quote denial, immutable facts, direct write denial, suspended access and tenant-safe references. Hosted journey verifies customer pricing denial, peer 404, suspension and internal-pricing isolation.

## W. Audit

Commercial events record actor, organization, action, entity and bounded metadata for calculations, drafts, sending and transitions. Source notes are operator references, not credential storage. Client writes to protected audit records remain denied.

## X. Accessibility

The final hosted commercial journey passed axe WCAG checks on Sales and customer quote screens, Arabic RTL, English LTR and mobile overflow. Service and status labels are localized. Foundation and intake desktop/mobile accessibility regression also passed on this same Preview.

## Y. Security

No service-role credential is configured in application Preview variables. Hosted bundle tests compare privileged operator values only inside the Node test process and found no privileged secrets or source maps in browser assets. Desktop/mobile tests verified CSP/security headers, session/logout behavior, isolation, signed private files and expiry. Runtime review inspected the last 1,000 records for this Preview: zero error-level records, no recognized secret pattern and no observed Auth query-token values. This is a bounded log review, not a claim about unlimited provider history. Test reporter suppresses credential-bearing error bodies. No dependency upgrades or CI/protection bypasses were introduced.

## Z. Tests

Local 12 suites / 89 tests passed; production build and 18 desktop/mobile E2E tests passed. Formatting, lint, typecheck and secret scan passed. CI [34641441641](https://github.com/Rmdn96/Naql365/actions/runs/34641441641) passed at test checkpoint `e3ed462cfc28dffe92a72e0e4debfa1544ab4ff6`, including full Supabase reconstruction/RLS and generated-type typecheck.

The earlier CI failure was a missing TAP plan, resolved by adding the same reporter footer as the existing SQL suites; no assertion was skipped. Hosted harness failures were corrected by waiting for the request UUID route before capturing its ID and retaining the selected vehicle before page reload. All subsequent commercial steps passed.

## AA. Hosted Staging

Final application Preview: [Naql365 Staging](https://naql365-staging-hxbh6u7bq-naql365.vercel.app). Deployment `dpl_49bf9y8Z1rDeYrDQ3zztCBLCB9Xm`, independently READY, API target null (Preview), application source `00e5b33bb91a139afa64130c519417c970a2f4ee`. The complete hosted commercial journey passed, including the real submitted wizard request, Sales review, customer lifecycle, exact 1.001 km snapshot, localized service/status, concurrency, customer isolation and suspension. Foundation (12 tests) and Phase 1 intake (6 tests) also passed on this same origin: 19 hosted tests total across the three suites.

Only Preview holds APP_ENV and STAGING_AUTH_SMOKE_ENABLED (server-only), NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (public). Public configuration matches the allowlisted Staging project. No Naql365 Development/Production variables or application admin key. Supabase Auth uses this exact Site URL and four AR/EN callback/recovery entries with zero wildcards. The temporary origin-scoped protection bypass was revoked after acceptance. Zero automation credentials remain; the revoked credential receives a 302 back to Deployment Protection.

## AB. Concurrency

Hosted concurrent acceptance sends two requests and asserts both succeed with one Order. Database row locks and uniqueness enforce the final invariant. Replay and stale-draft tests are also executed in SQL.

## AC. Cleanup

All three final hosted suites reported cleanup PASS. Aggregate Staging audit at 2026-09-11T20:07Z found zero users, profiles, sessions, memberships, customers, requests, quotes, orders, registered files and Storage objects. One orphan synthetic diagnostic identity was positively identified by its generated prefix and removed before the final suites. Required enrollment, five services, five additional services and nineteen acceptance pricing rules remain. The single temporary Vercel automation-bypass credential was revoked; zero remain. No Production data was involved.

## AD. Files Changed

Complete Phase 2 inventory at the application/test checkpoint (A = added, M = modified); deployment documentation is also updated by closeout.

```text
M	README.md
M	config/staging/supabase/config.toml
M	docs/database.md
A	docs/pricing-and-quotes.md
A	docs/reports/Naql365-Phase-2-Report.md
M	docs/roadmap.md
M	docs/security.md
M	docs/staging.md
M	docs/testing.md
M	package.json
A	playwright.phase2.config.ts
M	scripts/generate-embedded-db-types.mjs
A	scripts/staging/configure-pricing.mjs
A	scripts/staging/verify-phase2.mjs
A	src/app/[locale]/(account)/account/quotes/[id]/page.tsx
A	src/app/[locale]/(account)/account/quotes/page.tsx
A	src/app/[locale]/(portal)/portal/quotes/[id]/page.tsx
A	src/app/[locale]/(portal)/portal/quotes/page.tsx
A	src/app/api/customer/quotes/[id]/respond/route.ts
A	src/app/api/sales/pricing/route.ts
A	src/app/api/sales/quotes/[id]/send/route.ts
A	src/app/api/sales/quotes/route.ts
M	src/app/globals.css
A	src/components/pricing/quote-actions.tsx
A	src/components/pricing/sales-pricing.tsx
M	src/components/requests/account.tsx
M	src/components/shell/protected-shell.tsx
A	src/domain/pricing/model.ts
A	src/i18n/quotes.ts
A	src/infrastructure/pricing/service.ts
M	src/infrastructure/supabase/database.types.ts
A	supabase/migrations/20260910000400_pricing_quote_schema.sql
A	supabase/migrations/20260910000500_pricing_quote_commands.sql
A	supabase/migrations/20260910000600_pricing_quote_rls.sql
A	supabase/migrations/20260910000700_persist_quote_expiry.sql
M	supabase/tests/foundation.test.sql
A	supabase/tests/phase2.test.sql
M	tests/integration/database.test.ts
A	tests/phase2/journey.spec.ts
M	tests/staging/safe-reporter.ts
A	tests/unit/pricing.test.ts
```

## AE. Commits/CI

Logical commits preserve the initial analysis and separate schema, commands/RLS, UI, lifecycle fixes, test harness and documentation. Application-source CI: [34597109833](https://github.com/Rmdn96/Naql365/actions/runs/34597109833), PASS at `00e5b33bb91a139afa64130c519417c970a2f4ee`. Test checkpoint CI: [34641441641](https://github.com/Rmdn96/Naql365/actions/runs/34641441641), PASS at `e3ed462cfc28dffe92a72e0e4debfa1544ab4ff6`. The final closeout response supplies the documentation commit and its exact CI run.

## AF. Known Limitations

Manual externally verified distance is explicitly owner-approved; external routing integration is absent. Staging pricing/VAT values are test configuration, not a Production tariff approval. No automated notification delivery, routing, operational scheduling, payment or accounting integration. Expiry is enforced synchronously, without a background scheduler.

## AG. Deferred Items

Phase 3 operations/dispatch, driver/job/trip execution, GPS/ETA, payments/refunds, WhatsApp/SMS, AI/ML pricing, marketplace, SaaS billing and Production deployment remain excluded.

## AH. Acceptance Matrix

Evidence was collected on the final application Preview and its hosted Staging database. Application source and later test/documentation commits are recorded separately.

| Gate                    | Result | Evidence                                                                                                          |
| ----------------------- | ------ | ----------------------------------------------------------------------------------------------------------------- |
| Git baseline            | PASS   | Accepted develop and preserved schema-gap ancestor; main/develop unchanged                                        |
| Schema/migrations       | PASS   | Ten migrations reconstruct in CI; hosted migration history and SQL assertions PASS                                |
| Pricing rules           | PASS   | Nineteen controlled Staging rules; shared SQL verifies deterministic components                                   |
| Distance                | PASS   | Owner-approved MANUAL_VERIFIED; hosted 1.001 km snapshot and SQL negative authorization/precision/staleness tests |
| Money/rounding          | PASS   | Exact halala SQL arithmetic and rounding/unit validation                                                          |
| VAT                     | PASS   | Separate rate/amount snapshot; SQL expected values and hosted display                                             |
| Preliminary calculation | PASS   | Real wizard request enters Sales server calculation on final Preview                                              |
| Pricing snapshot        | PASS   | Immutable distance/components and sent commercial facts asserted in SQL                                           |
| Manual adjustment       | PASS   | Hosted adjustment with required internal reason; original subtotal preserved                                      |
| Sales workspace         | PASS   | Hosted submitted queue/detail, calculation, draft and send                                                        |
| Quote lifecycle         | PASS   | Hosted SENT/VIEWED/ACCEPTED/REJECTED/EXPIRED/SUPERSEDED flows                                                     |
| Quote versioning        | PASS   | Hosted revised version and SQL immutable sent-history checks                                                      |
| Expiry                  | PASS   | Hosted short-lived version rejects acceptance and persists EXPIRED                                                |
| Customer quote view     | PASS   | Hosted own quote with service, localized status, route, subtotal/VAT/total                                        |
| Accept                  | PASS   | Hosted eligible acceptance returns commercial Order                                                               |
| Reject                  | PASS   | Hosted rejection and denied subsequent acceptance                                                                 |
| Supersession            | PASS   | Hosted old version denied; new version accepted                                                                   |
| Exactly-one Order       | PASS   | Concurrent acceptance returns success twice with one persisted Order                                              |
| RLS                     | PASS   | Final hosted shared SQL suites pass; 47/47 tables protected                                                       |
| Tenant isolation        | PASS   | Hosted SQL denies cross-tenant Sales distance and tenant-unsafe references                                        |
| Customer isolation      | PASS   | Hosted peer 404 and customer-safe internal pricing denial                                                         |
| Concurrency             | PASS   | Two simultaneous acceptance requests, replay SQL and uniqueness invariants                                        |
| Security                | PASS   | Origin/authorization boundaries, private files, browser assets, logs and secret scan                              |
| Accessibility           | PASS   | Hosted axe and responsive checks across commercial/intake/foundation surfaces                                     |
| AR/EN                   | PASS   | Hosted Arabic RTL and English LTR; localized customer service/status                                              |
| CI                      | PASS   | Application 34597109833 and test checkpoint 34641441641 both PASS                                                 |
| Hosted Staging          | PASS   | Genuine READY Preview; 19 final hosted tests PASS                                                                 |
| Cleanup                 | PASS   | Zero test identities/business/files; catalogues retained; bypass revoked                                          |
| Scope compliance        | PASS   | No merge, Production change, dependency upgrade or Phase 3 feature                                                |

## AI. Final Decision

PHASE 2 PASS — READY FOR REVIEW

All critical implementation/hosted gates pass. This decision authorizes review only. Phase 2 remains unmerged; Production and Phase 3 remain untouched. The final closeout response records the documentation commit, exact final CI run and clean working-tree verification.
