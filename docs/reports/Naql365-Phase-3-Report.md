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

Three additive migrations: `20260912000100_operations_schema`, `20260912000200_operations_commands`, `20260912000300_pod_and_tracking`. Thirteen migrations reconstruct in embedded PostgreSQL. The schema commit passed complete Supabase reconstruction/RLS in CI. Cloud application and final generated-type comparison remain pending. Current types were generated from embedded PostgreSQL metadata and pass strict typecheck; final Supabase CLI types are still required.

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

Active execution partial unique indexes for Driver and Vehicle. Planning is nonexclusive and carries an explicit UI warning. Independent connection concurrency harness exists but has not run successfully yet.

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

Independent PostgreSQL connection harness covers Job creation, Trip revision/reference, assignment, Driver/Vehicle conflict, reassignment, Stop/POD and aggregate completion. It is wired into CI but remains UNVERIFIED until an actual successful run. Local Docker Desktop crashes during Inference-manager initialization; no reset/destructive Docker repair was performed.

## AC. Security

Server-only Supabase adapters, current tenant permission checks, origin validation, bounded JSON/multipart, private Storage and sanitized errors. Secret-pattern scan passed after staging the implementation files. Final hosted headers/cookies/bundles/logs review and final diff review remain required.

## AD. Accessibility

Native confirmation dialog, labeled inputs, focusable actions and responsive structure implemented. Foundation desktop/mobile test cases reported success. Phase 3 authenticated axe/keyboard/mobile evidence is pending.

## AE. AR/EN

Centralized Arabic/English dictionaries and locale routes implemented. Hosted bilingual operational acceptance remains pending.

## AF. Tests

Local: 99 tests passed across 15 unit/integration files; strict typecheck, lint, formatting and secret scan passed. Production build succeeded. All 18 foundation browser cases reported success, but the local runner process did not return its final exit summary at this checkpoint, so complete runner cleanup is not claimed. New hosted harness is typechecked but unexecuted. No failed checks were disabled.

## AG. Hosted Staging

No Phase 3 migrations, Preview or fixture runs have been applied to cloud resources yet. Accepted Phase 2 Staging is preserved. The new harness is preparation only, and does not yet cover every required hosted negative/concurrency/storage-expiry scenario. Expand and execute it before declaring PASS.

## AH. Cleanup

Embedded SQL fixtures roll back. No new Phase 3 hosted identities/files or automation bypass credentials were created. Hosted cleanup is therefore not acceptance evidence yet. The prepared runner scopes cleanup to its own identities/records and retains catalogues.

## AI. Files Changed

Operations architecture; three migrations; generated database types; SQL/integration/unit tests; operations domain/server adapters; signature decoder; operations API and pages/components; AR/EN dictionary; customer tracking link; CSS; pinned Sharp dependency; CI concurrency step; local concurrency and guarded hosted harness/configuration; testing/Staging documentation. Use the feature diff for the exact inventory.

## AJ. Commits/CI

- Gap analysis: `7ea1388e44eb6ed4f35119d1b35ae5be60868777` (pushed).
- Schema/commands: `5c13c70fad0d071adf985d91137d7c3e69bc2f1f` (pushed). [CI 34684587640](https://github.com/Rmdn96/Naql365/actions/runs/34684587640) passed both required jobs.
- UI/concurrency: `da659a03bd262d39b3349e3dfd9c2521ba0564c1` saved locally. Push failed after the execution environment changed: Windows Schannel `SEC_E_NO_CREDENTIALS`; the alternative verified-TLS backend did not complete a push, and Git Credential Manager cannot retrieve the repository credential in this environment.
- Subsequent harness/report changes are recorded in the next local checkpoint commit. Final-HEAD remote CI is pending; do not reuse schema-commit CI as final evidence.

## AK. Known Limitations

GitHub credential access is blocking push/CI continuation. Local Docker is unavailable. Hosted test coverage and execution, final concurrency evidence, Supabase-generated types, accessibility/security review and final cleanup are unfinished. Planned overlap is a warning; active execution conflicts are authoritative. Partial fulfilment/refunds and post-start route changes are excluded, not silently resolved.

## AL. Deferred Items

Driver Portal/login, GPS/maps/automatic ETA, route optimization, AI, messaging automation, payments/refunds/settlements, marketplace, SaaS billing, Production deployment and Phase 4.

## AM. Acceptance Matrix

| Gate                         | Result  | Evidence                                                       |
| ---------------------------- | ------- | -------------------------------------------------------------- |
| Git baseline                 | PASS    | Accepted develop verified before branch creation               |
| Gap analysis                 | PASS    | Separate prerequisite commit                                   |
| Schema/migrations            | PARTIAL | Reconstruction/SQL CI pass; hosted pending                     |
| Order → Job                  | PARTIAL | SQL pass; hosted pending                                       |
| Multi-Trip                   | PARTIAL | SQL pass; hosted pending                                       |
| Multi-Stop                   | PARTIAL | SQL pass; hosted pending                                       |
| Stop dependencies            | PARTIAL | SQL pass; hosted pending                                       |
| Internal Driver              | PARTIAL | Implemented/SQL; hosted pending                                |
| External Driver              | PARTIAL | No-profile SQL assertion; hosted pending                       |
| Vehicle independence         | PARTIAL | SQL; hosted pending                                            |
| Assignment                   | PARTIAL | SQL; hosted pending                                            |
| Resource conflicts           | PARTIAL | Sequential SQL; real races pending                             |
| Emergency reassignment       | PARTIAL | SQL; hosted pending                                            |
| Assignment history           | PARTIAL | SQL; hosted pending                                            |
| Trip state machine           | PARTIAL | SQL; hosted pending                                            |
| Stop state machine           | PARTIAL | SQL; hosted pending                                            |
| Trip Events                  | PARTIAL | SQL; hosted pending                                            |
| Operations workspace         | PARTIAL | Build/typecheck; hosted pending                                |
| Dispatch Board               | PARTIAL | Build/typecheck; hosted pending                                |
| Customer tracking            | PARTIAL | Projection SQL; hosted pending                                 |
| POD                          | PARTIAL | Decode/SQL; hosted Storage pending                             |
| Trip completion              | PARTIAL | SQL; hosted pending                                            |
| Job completion               | PARTIAL | SQL; real races/hosted pending                                 |
| Order operational completion | PARTIAL | SQL; hosted pending                                            |
| RLS                          | PARTIAL | Schema CI; final hosted negative coverage pending              |
| Tenant isolation             | PARTIAL | SQL; full hosted coverage pending                              |
| Customer isolation           | PARTIAL | SQL; hosted pending                                            |
| Concurrency                  | BLOCKED | New CI harness awaiting push/run                               |
| Security                     | PARTIAL | Local checks; hosted review pending                            |
| Accessibility                | PARTIAL | Foundation only; operations pending                            |
| AR/EN                        | PARTIAL | Implemented; hosted pending                                    |
| Regression                   | PARTIAL | Local tests/build; final hosted regressions pending            |
| CI                           | BLOCKED | Final implementation not pushed                                |
| Hosted Staging               | BLOCKED | Awaiting full predeployment gates                              |
| Cleanup                      | PARTIAL | No Phase 3 hosted fixtures created; acceptance cleanup pending |
| Scope compliance             | PASS    | No merge/Production/Phase 4 actions                            |

## AN. Final Decision

PHASE 3 PARTIAL — NOT READY

Continue this report after secure GitHub access is restored. Push the existing branch, verify exact-HEAD CI including real concurrency, complete remaining hosted test coverage, then apply/deploy/test Staging using established protections. Do not merge or start Phase 4.
