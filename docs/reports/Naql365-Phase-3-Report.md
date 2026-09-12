# Naql365 — Phase 3 Report

Progress checkpoint, 2026-09-12. This is the canonical report to update during continuation, not an acceptance certificate. Primary hosted operations acceptance passed; final regression and security closeout remain in progress. No merge, Production deployment or Phase 4 is authorized.

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

PASS. Hosted customer intake → Sales pricing/Quote → acceptance created the commercial Order. Operations created its Job through the UI; a second authoritative create request returned the same Job and a database assertion confirmed exactly one row. Independent-connection CI races also pass.

## G. Multi-Trip

PASS. One hosted Job produced two distinct Trips. Both executed against the same accepted Order and retained their own references, Stops, assignments and POD.

## H. Multi-Stop

PASS. Each hosted Trip used two Pickup and two Delivery Stops with explicit positions. Both four-Stop sequences executed through authenticated hosted commands. Planner implementation is server-validated; no optimization or GPS is claimed.

## I. Stop Dependencies

PASS. Delivery completion before required Pickup completion was rejected. All Stops executed in order; stale transition races pass in CI. Changing a started Trip plan was rejected. Item-level load allocation remains excluded.

## J. Drivers

PASS. Hosted INTERNAL and EXTERNAL operational records were created and used independently of Vehicles. Roles and membership remain authoritative; no Driver login workflow was introduced.

## K. External Drivers

PASS. The hosted External Driver has profile_id null. Trip events and finalized POD record the authenticated Dispatcher as actor, not the external resource.

## L. Vehicles

PASS. Hosted free Vehicle/busy Driver and free Driver/busy Vehicle combinations were separately rejected at dispatch, proving independent resource constraints. Assignment changes preserve the distinct resource identifiers.

## M. Assignments

PASS. Hosted planned assignments, authoritative dispatch conflicts and emergency replacement executed. Historical assignment rows remained; exactly one current assignment was asserted for the reassigned Trip.

## N. Conflict Protection

PASS. Hosted Driver-only and Vehicle-only active execution conflicts returned 409; independent-connection CI races also pass. Planning is deliberately nonexclusive with a visible warning. No sophisticated schedule optimization is claimed.

## O. Emergency Reassignment

PASS. Started-Trip reassignment without a reason was rejected. The real Arabic confirmation dialog changed Driver and Vehicle with a bounded reason; history and actor remained intact. Cross-tenant resources were rejected. Quote/Order commercial facts remained unchanged.

## P. Trip State Machine

PASS. Hosted readiness, dispatch, stop progression and completion commands executed. Premature completion and post-start plan mutation were rejected. SQL and concurrency tests verify stale revisions and terminal behavior; there is no arbitrary status-write API.

## Q. Stop State Machine

PASS. Both hosted Trips executed four ordered Stops through EN_ROUTE, ARRIVED, IN_PROGRESS and COMPLETED. Delivery-before-Pickup was rejected; independent-connection stale/retry transitions pass in CI.

## R. Trip Events

PASS. Hosted events consistently identify the authenticated operations staff actor, including execution by an External Driver resource. Customer/cross-tenant event and assignment reads return no rows; direct mutation remains revoked.

## S. Dispatch Board

PASS. The hosted Operations board rendered in AR/EN and desktop/mobile layouts. Active conflict and state behavior were exercised through the hosted commands. Automated accessibility found no WCAG violations on the inspected operational views.

## T. Operations Workspace

PASS. Authenticated Dispatcher opened the actual workspace and created the Job through its UI. Trip execution, the emergency dialog and private POD capture ran in the browser. A suspended membership lost the protected route and mutation permission.

## U. Customer Tracking

PASS. The owning customer viewed completed multi-Trip progress in English and Arabic/mobile. Internal Driver details and emergency reason were absent. A peer customer saw localized not-found content, no Order reference in returned HTML, RPC denial 42501 and empty direct RLS reads. Next.js may use HTTP 200 after streaming begins; denial is verified by content and database enforcement, not status alone. [Next.js semantics](https://nextjs.org/docs/app/api-reference/file-conventions/not-found). No GPS or automatic ETA is claimed.

## V. POD

PASS. Each hosted Trip finalized exactly one POD with recipient, authenticated actor and a harmless PNG signature. Duplicate reservation was denied. Authorized staff download and signed access passed; Customer, Sales and cross-tenant download/signing were denied. Direct public access failed; a two-second signed capability worked and was rejected after expiry. Private objects were deleted during scoped cleanup. Sharp decodes/re-encodes images and strips metadata; malware scanning is not claimed.

## W. Trip Completion

PASS. Hosted completion was denied with incomplete Stops and again after Stops but before POD. Final POD allowed completion. The same-Trip concurrent completion/retry race passed in CI.

## X. Job Completion

PASS. Completing Trip 1 left the two-Trip Job IN_PROGRESS. Completing Trip 2 derived COMPLETED. Independent-connection aggregate completion emitted exactly one completion event. Failed/cancelled Trips remain explicit exceptions rather than fabricated fulfilment.

## Y. Order Operational Completion

PASS. Hosted Order operational_status derived COMPLETED only after the final required Trip. Accepted Quote Version, distance, subtotal, VAT and total remained identical to the original commercial snapshot.

## Z. RLS/Authorization

PASS. Thirteen-migration hosted SQL verification and 49/49 RLS tables are confirmed. Hosted Customer, unauthorized Sales and cross-tenant staff could not mutate operations or use another tenant's resources; raw status writes were denied. Peer customer progress/Order reads were denied. Suspended staff lost both hosted API permission and protected routing. Untrusted role metadata never granted staff permission.

## AA. Audit

PASS. Commands preserve actor, organization, entity and bounded facts; assignments and events retain the staff identity. CI verifies single aggregate completion auditing under concurrent requests. Disposable fixture audit rows are removed only with their own scoped data; catalogue/schema auditing is retained.

## AB. Concurrency

Independent PostgreSQL connections executed successfully in CI runs 34691256784, 34691413101 and 34691681645. Assertions cover one Job per Order, Trip revision/reference allocation, assignment, Driver/Vehicle conflict, emergency reassignment, Stop transitions, POD reservation/finalization, retries and final aggregate completion. Concurrent duplicate completion of the same Trip plus completion of the other Trip yields exactly two successful transitions and one aggregate completion event. Rejected revision races require SQLSTATE 40001/23505. The initial checkpoint run passed assertions but failed cleanup because Supabase disallows direct storage.objects deletion; commit 0061e4f uses the guarded LOCAL Storage API and successful runs include cleanup. Local Docker Desktop remains unavailable due Inference-manager initialization failure; actual PostgreSQL concurrency evidence comes from CI, not an embedded substitute.

## AC. Security

Server-only Supabase adapters, current tenant permission checks, origin validation, bounded JSON/multipart, private Storage and sanitized errors. Secret-pattern scan passed after staging the implementation files. Final hosted headers/cookies/bundles/logs review and final diff review remain required.

## AD. Accessibility

PASS for the automated hosted smoke scope. Operations workspace, Arabic emergency dialog, mobile Trip/POD views, English keyboard focus and AR/EN customer tracking passed WCAG 2/2.1 AA axe checks with no violations. Each inspected page has exactly one main landmark. The initial nested-main defect was fixed in four Phase 3 pages before this replacement Preview. This is not a claim of a complete manual WCAG certification.

## AE. AR/EN

PASS. Hosted Arabic intake/Operations and English Operations/customer tracking execute; Arabic customer tracking was checked on a mobile viewport. HTML direction and localized content are asserted. No operational business logic is encoded in translations.

## AF. Tests

Current regression blocker: Phase 2's hosted customer-pricing denial expected 403 but received 500. A separate controlled diagnostic confirmed one visible customer membership, pricing permission false and a subsequent pricing response 403; its preceding session probe returned 500. Nested Vercel logs identify `Unable to read membership`. Safe database error-code logging was added to the identity adapter to determine the cause without recording identities, credentials or tokens. No authorization expectation has been weakened. Phase 0–2 regression is not PASS.

Local: 99 tests passed across 15 unit/integration files; strict typecheck, lint, formatting and secret scan passed. Full required CI including build/E2E and independent Supabase concurrency passed at `50d8a2a32343a86c5d520ff9595853a53f65a137`, run [34693106214](https://github.com/Rmdn96/Naql365/actions/runs/34693106214). The latest hosted journey completed two Trips, private POD/access/expiry, completion aggregation, commercial immutability, suspended-staff denial and English Operations accessibility, then failed at a strict locator on nested main landmarks in customer tracking. This is not a full hosted PASS. The test harness also now closes SDK probe sessions locally rather than revoking the browser's session globally. No failed checks were disabled.

## AG. Hosted Staging

Primary Phase 3 acceptance PASS on https://naql365-staging-86o99g35f-naql365.vercel.app; deployment `dpl_HzMuLzKaFQVFmaUehYbT7bmKkJ6C`; source `99776ae3074b3c3bef8ed9a3061986023454b004`. Independent API verification: protected Preview, target null, READY, expected project/branch. Two hosted tests passed: authenticated bundle boundaries and the complete customer-to-multi-Trip operational journey. Exact Supabase Auth origin/four redirects use no wildcards. Phase 0–2 regression and final log/cleanup review are still in progress.

## AH. Cleanup

Phase 3 hosted cleanup PASS: synthetic identities, their Requests/Quotes/Orders/Jobs/Trips/resources/POD and private objects were removed, retaining required catalogues. Cleanup was corrected for the disposable organization's actorless creation audit; earlier orphan was removed. SDK probes sign out locally, leaving the independent browser session intact until browser logout/fixture deletion. Final regression cleanup and temporary Vercel bypass revocation remain pending.

## AI. Files Changed

Operations architecture; three migrations; generated database types; SQL/integration/unit tests; operations domain/server adapters; signature decoder; operations API and pages/components; AR/EN dictionary; customer tracking link; CSS; pinned Sharp dependency; CI concurrency step; local concurrency and guarded hosted harness/configuration; testing/Staging documentation. Use the feature diff for the exact inventory.

## AJ. Commits/CI

Existing Phase 3 commits through checkpoint `f0e5719b870ddeaa1828bf6dfb0644dcb32a56f0` were verified pushed. Continuation commits: `0061e4ff8e9ee76e411a9bd3550c675778291a8b` concurrency cleanup/assertions; `1a910f5` hosted negative coverage; `a4856eece1c897a90df78c9a8c6dfe2ddfa2bfca` authoritative generated types; `677f62fc53c589d277bfa85a250408a45830eb8f` hosted PostgREST metadata. Both required jobs passed for deployment HEAD: [CI 34691681645](https://github.com/Rmdn96/Naql365/actions/runs/34691681645). Final closeout changes still require their own committed-HEAD CI.

## AK. Known Limitations

Local Docker Desktop is unavailable; complete Supabase CI supplies fresh reconstruction and real independent PostgreSQL connections. Planned overlap is a warning; active execution conflicts are authoritative. Signing URLs are short-lived bearer capabilities, not permanent public links. POD image normalization is not antivirus or identity verification. Failed/cancelled/partial fulfilment, refunds and post-start route edits are not silently resolved. Final regression/security closeout is still pending.

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
