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

Four additive migrations (`20260910000400`–`20260910000700`) follow the six accepted migrations: pricing schema, transactional commands, commercial RLS and durable expiry. Ten migrations reconstruct in CI. Staging has 47 public tables with RLS; final hosted re-verification is pending below.

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

Hosted journey includes axe WCAG checks for Sales and customer quote screens, Arabic RTL, English LTR and mobile overflow. Foundation/Phase 1 full hosted regression on the final candidate remains pending.

## Y. Security

No service-role credential is configured in application Preview variables. Privileged fixtures exist only in guarded operator test processes. Safe test reporter suppresses credentials/cookies/errors and prints source-line diagnostics only. Private Storage/RLS/CSP and bundle regression remain required.

## Z. Tests

Local 12 suites / 89 tests passed after the TAP and decimal fixes. CI `34595753158` passed at `2d47f778c8ca5ee82693d9c7a8371b21936fdd8b`, including full Supabase reset/RLS. Final-head regression is pending.

## AA. Hosted Staging

The complete wizard -> Sales -> pricing -> sent quote -> customer lifecycle journey passed on genuine Preview `https://naql365-staging-8qidi1tdf-naql365.vercel.app` (source 5182f80). Disposable fixtures were cleaned. Final candidate is being deployed for the decimal validation correction and complete regression.

## AB. Concurrency

Hosted concurrent acceptance sends two requests and asserts both succeed with one Order. Database row locks and uniqueness enforce the final invariant. Replay and stale-draft tests are also executed in SQL.

## AC. Cleanup

Individual hosted runs reported scoped fixture cleanup PASS. Final aggregate orphan fixture and automation-bypass cleanup audit remains pending. Required catalogues/schema must remain intact.

## AD. Files Changed

See `git diff --name-status 4d3b25730e3b604882a860ade414f98fd888766b...HEAD` for the complete review inventory. Changes cover migrations, generated types, domain/server adapters, localized Sales/customer pages, hosted/SQL/unit tests, guarded Staging scripts and documentation.

## AE. Commits/CI

Logical commits preserve the initial analysis and separate schema, commands/RLS, UI, lifecycle fixes, test harness and documentation. Final commit/CI evidence is pending; this interim report does not assert final-head CI success.

## AF. Known Limitations

Manual externally verified distance is explicitly owner-approved; external routing integration is absent. Staging pricing/VAT values are test configuration, not a Production tariff approval. No automated notification delivery, routing, operational scheduling, payment or accounting integration. Expiry is enforced synchronously, without a background scheduler.

## AG. Deferred Items

Phase 3 operations/dispatch, driver/job/trip execution, GPS/ETA, payments/refunds, WhatsApp/SMS, AI/ML pricing, marketplace, SaaS billing and Production deployment remain excluded.

## AH. Acceptance Matrix

Final verification is in progress. Prior PASS evidence is not substituted for final-candidate evidence.

| Gate                             | Result  | Evidence                                                                 |
| -------------------------------- | ------- | ------------------------------------------------------------------------ |
| Git baseline                     | PASS    | Preserved develop and schema-gap commits                                 |
| Schema/migrations                | PASS    | CI 34595753158 reconstruction                                            |
| Pricing/distance/quote lifecycle | PARTIAL | Hosted journey passed; final candidate regression pending                |
| RLS/isolation                    | PARTIAL | SQL and hosted prior candidate; strengthened checks pending hosted rerun |
| Concurrency                      | PASS    | Concurrent hosted acceptance creates one Order                           |
| Security/accessibility/AR-EN     | PARTIAL | Final hosted regression pending                                          |
| CI                               | PARTIAL | Final-head CI pending                                                    |
| Cleanup                          | PARTIAL | Per-run cleanup passed; aggregate audit pending                          |
| Scope compliance                 | PASS    | No merge, Production or Phase 3 work                                     |

## AI. Final Decision

PHASE 2 PARTIAL — NOT READY

Interim evidence checkpoint only. Final hosted regression, cleanup and exact-head CI must complete before READY FOR REVIEW.
