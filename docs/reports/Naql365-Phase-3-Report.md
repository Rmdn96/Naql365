# Naql365 — Phase 3 Report

Progress checkpoint, 2026-09-12. This is the canonical report to update during continuation, not an acceptance certificate. Phase 3 is incomplete. No merge, Production deployment or Phase 4 is authorized.

## A. Starting State

Phase 0–2 accepted, with Phase 2 merged through protected PR #3. The working tree was clean before branching.

## B. Git Baseline

Accepted develop `86ba612a5f6f7f4afd7a5c0650d5b4d3848f2b6f`; work branch `feature/phase-3-operations-dispatch-pod`. Main baseline `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`. No main/develop writes were performed.

## C. Domain/Schema Gap Analysis

[operations-dispatch-pod.md](../operations-dispatch-pod.md) was committed and pushed as `7ea1388e44eb6ed4f35119d1b35ae5be60868777` before any migration. Existing skeletons and identity guards were inspected and extended.

## D. Architecture

Localized server-rendered pages, validated user-scoped adapters and explicit database commands. Tenant advisory locks serialize short operational transactions; unique constraints reinforce assignment and Job invariants. No network work occurs while holding these locks.

## E. Migrations

Three unchanged additive Phase 3 migrations: `20260912000100_operations_schema`, `20260912000200_operations_commands`, `20260912000300_pod_and_tracking`. All thirteen reconstruct in complete Supabase CI. After successful CI they were applied to allowlisted Supabase Staging `zuvyfeflkzlciuaauxba`; repository history matches all thirteen and all 49 public tables have RLS. Shared rollback SQL suites passed on hosted Staging. Types were regenerated with the authoritative Supabase workflow in CI and from hosted Staging, then typechecked. The hosted-only PostgREST 14.5 metadata is committed; no relational schema drift remains.

## F. Order → Job

Unique primary Job per Order; accepted Order requirement, permission checks and retry identity. SQL assertions pass.

## G. Multi-Trip

Multiple Trips per Job; database-issued references; SQL two-Trip scenario passes.

## H. Multi-Stop

Ordered Pickup/Delivery Stops with per-Stop state, address and operational notes. SQL scenario uses two Pickups and two Deliveries per Trip. Planner UI exists; hosted usability remains unverified.

## I. Stop Dependencies

Explicit earlier Pickup dependencies and ordered execution. Invalid delivery completion is rejected. Item-level load allocation is not claimed.

## J. Drivers

Unified INTERNAL/EXTERNAL operational records, active status and optional internal profile. Existing customer membership guard retained.

## K. External Drivers

No Auth profile or login required. Authenticated staff remains the event actor. SQL verifies the distinction.

## L. Vehicles

Independent active resource with identifier and type; no permanent Driver relationship.

## M. Assignments

Current assignment uniqueness and historical closed rows; SQL history assertions pass.

## N. Conflict Protection

Active execution partial unique indexes for Driver and Vehicle. Planning is nonexclusive and carries an explicit UI warning. Independent-connection races passed in complete Supabase CI, including competing Driver and Vehicle execution claims. Hosted application acceptance remains pending.

## O. Emergency Reassignment

Started Trips require confirmed action and reason; prior assignment retained and event/audit recorded. SQL checks pass; hosted dialog execution remains pending.

## P. Trip State Machine

Allowlisted readiness, dispatch, arrival, service, departure, completion and exception commands. No generic set-status endpoint. Terminal mutation denied.

## Q. Stop State Machine

PENDING → EN_ROUTE → ARRIVED → IN_PROGRESS → COMPLETED. Revision checks reject stale transitions. No skipping or route-history rewriting after dispatch.

## R. Trip Events

Append-oriented authenticated events and bounded facts. SQL denies customer forgery and visibility of staff-only events.

## S. Dispatch Board

Grouped/filterable Trip list and resource assignment summaries implemented. Hosted review and accessibility not yet accepted.

## T. Operations Workspace

Accepted Orders, Jobs, Trip planning/execution, resources and exceptions implemented. Bounded operational Job-summary RPC avoids giving Dispatcher unrestricted customer Request reads.

## U. Customer Tracking

Own-Order fixed projection, per-Trip progress and POD-captured boolean. No Driver details, signatures, internal notes or emergency reasons. No GPS claims. Linked from accepted Quote detail. Hosted evidence pending.

## V. POD

One final Trip POD with recipient, staff actor, timestamp and private signature. Pending reservation cleanup supported. Server uses pinned Sharp 0.35.4 (already present through Next.js, now a direct dependency) to decode/re-encode images and strip unnecessary metadata; malformed magic-only input is rejected. SQL reservation/type/size/finalization guards exist. Storage expiry and hosted negative access still require verification; no malware scanning claim.

## W. Trip Completion

All Stops and final POD required; SQL denial-before-POD and successful completion pass.

## X. Job Completion

All required Trips must complete. First-Trip completion does not complete the Job; failed/cancelled Trips remain exceptions.

## Y. Order Operational Completion

Separate operational status and completion timestamp; commercial snapshot unchanged in SQL scenario. No repricing.

## Z. RLS/Authorization

Anonymous, Customer, unauthorized Sales, cross-tenant Job creation and suspended access tested; raw operational writes remain revoked. Full hosted resource/Stop/POD isolation and complete negative-case coverage are outstanding.

## AA. Audit

Commands record staff actor, action, entity and bounded facts. Aggregate completion emits dedicated audit. Hosted audit review outstanding.

## AB. Concurrency

Independent PostgreSQL connections executed successfully in CI runs 34691256784, 34691413101 and 34691681645. Assertions cover one Job per Order, Trip revision/reference allocation, assignment, Driver/Vehicle conflict, emergency reassignment, Stop transitions, POD reservation/finalization, retries and final aggregate completion. Concurrent duplicate completion of the same Trip plus completion of the other Trip yields exactly two successful transitions and one aggregate completion event. Rejected revision races require SQLSTATE 40001/23505. The initial checkpoint run passed assertions but failed cleanup because Supabase disallows direct storage.objects deletion; commit 0061e4f uses the guarded LOCAL Storage API and successful runs include cleanup. Local Docker Desktop remains unavailable due Inference-manager initialization failure; actual PostgreSQL concurrency evidence comes from CI, not an embedded substitute.

## AC. Security

Server-only Supabase adapters, current tenant permission checks, origin validation, bounded JSON/multipart, private Storage and sanitized errors. Secret-pattern scan passed after staging the implementation files. Final hosted headers/cookies/bundles/logs review and final diff review remain required.

## AD. Accessibility

Authenticated Operations, emergency dialog and mobile POD WCAG axe checks executed without violations on the initial Phase 3 Preview. Hosted tracking verification exposed nested `main` elements: the locale layout owns the page landmark but four Phase 3 pages added another. These pages now use normal containers, with an explicit single-main assertion in hosted tests. A replacement Preview and complete acceptance rerun are required before accessibility is PASS.

## AE. AR/EN

Centralized Arabic/English dictionaries and locale routes implemented. Hosted bilingual operational acceptance remains pending.

## AF. Tests

Local: 99 tests passed across 15 unit/integration files; strict typecheck, lint, formatting and secret scan passed. Full required CI including build/E2E and independent Supabase concurrency passed at `50d8a2a32343a86c5d520ff9595853a53f65a137`, run [34693106214](https://github.com/Rmdn96/Naql365/actions/runs/34693106214). The latest hosted journey completed two Trips, private POD/access/expiry, completion aggregation, commercial immutability, suspended-staff denial and English Operations accessibility, then failed at a strict locator on nested main landmarks in customer tracking. This is not a full hosted PASS. The test harness also now closes SDK probe sessions locally rather than revoking the browser's session globally. No failed checks were disabled.

## AG. Hosted Staging

Protected READY Preview: https://naql365-staging-5dgwpqqi9-naql365.vercel.app; deployment `dpl_DD7e5XuRu8yXRxSocPnpn5hQZEZb`; source `677f62fc53c589d277bfa85a250408a45830eb8f`. Independent Vercel API confirms Preview (`target: null`), expected project and branch. All four application variables remain Preview-only; no service-role credential is installed. Exact Supabase Auth Site URL and four callback/recovery entries were rotated to this origin. Phase 3 hosted acceptance is currently in progress. Initial harness failures exposed a nonawaited onboarding check and a nonawaited Quote-send transition; test synchronization was corrected without changing application authorization or migrations.

## AH. Cleanup

SQL fixtures roll back. Hosted fixtures use five disposable identities and one isolated organization, with private Storage cleanup through the API. The first run removed identities/business records but retained an organization because its creation audit had no fixture actor. Cleanup now deletes audit rows for that exact disposable organization; the orphan was safely removed. Subsequent failed runs completed scoped cleanup. Required catalogues remain intact. Final successful-run cleanup and temporary Vercel automation-bypass revocation remain pending.

## AI. Files Changed

Operations architecture; three migrations; generated database types; SQL/integration/unit tests; operations domain/server adapters; signature decoder; operations API and pages/components; AR/EN dictionary; customer tracking link; CSS; pinned Sharp dependency; CI concurrency step; local concurrency and guarded hosted harness/configuration; testing/Staging documentation. Use the feature diff for the exact inventory.

## AJ. Commits/CI

Existing Phase 3 commits through checkpoint `f0e5719b870ddeaa1828bf6dfb0644dcb32a56f0` were verified pushed. Continuation commits: `0061e4ff8e9ee76e411a9bd3550c675778291a8b` concurrency cleanup/assertions; `1a910f5` hosted negative coverage; `a4856eece1c897a90df78c9a8c6dfe2ddfa2bfca` authoritative generated types; `677f62fc53c589d277bfa85a250408a45830eb8f` hosted PostgREST metadata. Both required jobs passed for deployment HEAD: [CI 34691681645](https://github.com/Rmdn96/Naql365/actions/runs/34691681645). Final closeout changes still require their own committed-HEAD CI.

## AK. Known Limitations

Local Docker is unavailable; complete Supabase CI provides reconstruction and independent-connection evidence. Hosted application acceptance, regression, accessibility/security review and final cleanup remain unfinished. Planned overlap is a warning; active execution conflicts are authoritative. Partial fulfilment/refunds and post-start route changes remain excluded.

## AL. Deferred Items

Driver Portal/login, GPS/maps/automatic ETA, route optimization, AI, messaging automation, payments/refunds/settlements, marketplace, SaaS billing, Production deployment and Phase 4.

## AM. Acceptance Matrix

| Gate                         | Result  | Evidence                                                                  |
| ---------------------------- | ------- | ------------------------------------------------------------------------- |
| Git baseline                 | PASS    | Accepted develop verified before branch creation                          |
| Gap analysis                 | PASS    | Separate prerequisite commit                                              |
| Schema/migrations            | PASS    | Thirteen migrations, hosted rollback SQL and authoritative types verified |
| Order → Job                  | PARTIAL | SQL pass; hosted pending                                                  |
| Multi-Trip                   | PARTIAL | SQL pass; hosted pending                                                  |
| Multi-Stop                   | PARTIAL | SQL pass; hosted pending                                                  |
| Stop dependencies            | PARTIAL | SQL pass; hosted pending                                                  |
| Internal Driver              | PARTIAL | Implemented/SQL; hosted pending                                           |
| External Driver              | PARTIAL | No-profile SQL assertion; hosted pending                                  |
| Vehicle independence         | PARTIAL | SQL; hosted pending                                                       |
| Assignment                   | PARTIAL | SQL; hosted pending                                                       |
| Resource conflicts           | PARTIAL | Sequential SQL; real races pending                                        |
| Emergency reassignment       | PARTIAL | SQL; hosted pending                                                       |
| Assignment history           | PARTIAL | SQL; hosted pending                                                       |
| Trip state machine           | PARTIAL | SQL; hosted pending                                                       |
| Stop state machine           | PARTIAL | SQL; hosted pending                                                       |
| Trip Events                  | PARTIAL | SQL; hosted pending                                                       |
| Operations workspace         | PARTIAL | Build/typecheck; hosted pending                                           |
| Dispatch Board               | PARTIAL | Build/typecheck; hosted pending                                           |
| Customer tracking            | PARTIAL | Projection SQL; hosted pending                                            |
| POD                          | PARTIAL | Decode/SQL; hosted Storage pending                                        |
| Trip completion              | PARTIAL | SQL; hosted pending                                                       |
| Job completion               | PARTIAL | SQL; real races/hosted pending                                            |
| Order operational completion | PARTIAL | SQL; hosted pending                                                       |
| RLS                          | PARTIAL | Schema CI; final hosted negative coverage pending                         |
| Tenant isolation             | PARTIAL | SQL; full hosted coverage pending                                         |
| Customer isolation           | PARTIAL | SQL; hosted pending                                                       |
| Concurrency                  | PASS    | Independent connections and cleanup passed in deployment-HEAD CI          |
| Security                     | PARTIAL | Local checks; hosted review pending                                       |
| Accessibility                | PARTIAL | Foundation only; operations pending                                       |
| AR/EN                        | PARTIAL | Implemented; hosted pending                                               |
| Regression                   | PARTIAL | Local tests/build; final hosted regressions pending                       |
| CI                           | PARTIAL | Deployment HEAD passes both jobs; final closeout HEAD pending             |
| Hosted Staging               | PARTIAL | Genuine protected Preview READY; hosted acceptance in progress            |
| Cleanup                      | PARTIAL | No Phase 3 hosted fixtures created; acceptance cleanup pending            |
| Scope compliance             | PASS    | No merge/Production/Phase 4 actions                                       |

## AN. Final Decision

PHASE 3 PARTIAL — NOT READY

Continue hosted acceptance and same-Preview Phase 0–2 regression, verify security and cleanup, then commit/push final evidence and verify exact-HEAD CI. Do not merge, deploy Production or start Phase 4.
