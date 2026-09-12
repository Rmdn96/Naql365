# Naql365 — Phase 3 Report

Final hosted acceptance, 2026-09-12. All critical gates below passed on the accepted protected Preview. No merge, Production deployment or Phase 4 was performed or authorized.

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

PASS. User-scoped server adapters, current tenant permission checks, origin validation, bounded input and private Storage remain enforced. Hosted suites verified CSP/security headers, session/logout behavior, unsafe redirect denial, private signed access/expiry and browser asset boundaries. No privileged key, test password or automation credential was found in inspected HTML/scripts. The final bounded runtime audit examined 1,000 records: zero error records (including nested logs), zero credential-pattern matches and no Auth query values observed. This is bounded evidence, not a claim to inspect every historical provider log. Final environment audit found four Preview-only variables and zero Production deployments; all temporary automation credentials are revoked. Secret scan and CI remain mandatory.

## AD. Accessibility

PASS for the automated hosted smoke scope. Operations workspace, Arabic emergency dialog, mobile Trip/POD views, English keyboard focus and AR/EN customer tracking passed WCAG 2/2.1 AA axe checks with no violations. Each inspected page has exactly one main landmark. The initial nested-main defect was fixed in four Phase 3 pages before this replacement Preview. This is not a claim of a complete manual WCAG certification.

## AE. AR/EN

PASS. Hosted Arabic intake/Operations and English Operations/customer tracking execute; Arabic customer tracking was checked on a mobile viewport. HTML direction and localized content are asserted. No operational business logic is encoded in translations.

## AF. Tests

PASS on the same final Preview: Foundation 12/12, Phase 1 intake 6/6, Phase 2 commercial 1/1, Phase 3 operations/assets 2/2: **21/21 hosted tests**, with cleanup succeeding for every suite. No retries or skipped security assertions were used. Local unit/integration: 99 tests across 15 files; formatting, secrets, lint and strict types passed. Complete CI additionally passed production build, 18 E2E cases, fresh Supabase reconstruction, shared SQL/RLS assertions, independent-connection concurrency and authoritative generated types.

Earlier candidates exposed a nested-main accessibility defect (fixed in four Phase 3 pages), fixture cleanup ordering and SDK probe global-signout interference (corrected in the harness). An earlier commercial membership-read 500 and intake 401 were not precisely attributable to a provider cause; safe operation/error-code logging was added without logging sessions or weakening authorization. Final full regressions did not reproduce them. The final intake form assertion needed bounded hosted deadlines (expect 20 seconds, action 20 seconds, navigation 45 seconds); no expected status or security assertion was relaxed. The successful final intake API probe remained 400/200/409/400 for mass assignment/first write/stale write/incomplete submit.

Local Docker could not initialize. A local E2E runner reported its cases but did not terminate normally and was stopped; completed remote CI supplies the E2E and real Supabase evidence. These local infrastructure limitations are not represented as successful local runs.

## AG. Hosted Staging

PASS. Accepted Preview: https://naql365-staging-nuy9j66y2-naql365.vercel.app; deployment `dpl_267qYKS5siSkbk5kXHYBMKmDA4W1`; application source `3bff649ed8132accfce84f53a6df1517ff079268`. Independently verified READY, Preview target null, expected project/branch and Deployment Protection. All 21 tests in AF ran against this exact origin. Subsequent commits change tests/documentation/Auth origin only; application source and lockfile match the accepted deployment.

Supabase Staging `zuvyfeflkzlciuaauxba` uses this exact Site URL and four exact AR/EN account/recovery callback entries, with no wildcard. Preview-only variables: NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (public configuration); APP_ENV and STAGING_AUTH_SMOKE_ENABLED (server/environment configuration). Development and Production contain no application variables. No management, database-password or service-role credential is installed in Vercel.

## AH. Cleanup

PASS. Every hosted suite completed scoped cleanup. Final read-only counts: zero Auth identities, Requests, Orders, Trips, POD records, disposable isolation organizations and Storage objects. Required catalogue entries remain: eight roles and 23 permissions. Temporary Vercel automation credentials: zero remaining; Deployment Protection remains all_except_custom_domains. No accepted Preview was deleted or promoted. No Production deployment or Production-scoped application variable exists. Main/develop SHAs and required protections remain unchanged.

## AI. Files Changed

Exact feature inventory relative to accepted develop (including this documentation closeout):

```text
.github/workflows/ci.yml
README.md
config/staging/supabase/config.toml
docs/database.md
docs/deployment.md
docs/operations-dispatch-pod.md
docs/reports/Naql365-Phase-3-Report.md
docs/roadmap.md
docs/security.md
docs/staging.md
docs/testing.md
package-lock.json
package.json
playwright.intake.config.ts
playwright.phase3.config.ts
scripts/staging/verify-phase3.mjs
scripts/test-operations-concurrency.mjs
src/app/[locale]/(account)/account/orders/[id]/page.tsx
src/app/[locale]/(account)/account/quotes/[id]/page.tsx
src/app/[locale]/(portal)/portal/operations/jobs/[id]/page.tsx
src/app/[locale]/(portal)/portal/operations/page.tsx
src/app/[locale]/(portal)/portal/operations/trips/[id]/page.tsx
src/app/api/operations/pod/route.ts
src/app/api/operations/route.ts
src/app/globals.css
src/components/operations/command.tsx
src/components/operations/planner.tsx
src/components/operations/trip-controls.tsx
src/components/operations/workspace.tsx
src/components/shell/protected-shell.tsx
src/domain/operations/model.ts
src/i18n/operations.ts
src/infrastructure/identity/access.ts
src/infrastructure/operations/service.ts
src/infrastructure/operations/signature.ts
src/infrastructure/pricing/service.ts
src/infrastructure/requests/service.ts
src/infrastructure/supabase/database.types.ts
supabase/migrations/20260912000100_operations_schema.sql
supabase/migrations/20260912000200_operations_commands.sql
supabase/migrations/20260912000300_pod_and_tracking.sql
supabase/tests/phase3.test.sql
tests/integration/database.test.ts
tests/phase3/assets.spec.ts
tests/phase3/journey.spec.ts
tests/unit/operations-service.test.ts
tests/unit/operations.test.ts
tests/unit/signature.test.ts
```

## AJ. Commits/CI

All original checkpoint commits were preserved and pushed. Both required jobs passed for the application source and the final test source. Latest tested source: `980f3e9a5ab15b65fd5036d3080a04c82a1dfe56`, [CI 34696040884](https://github.com/Rmdn96/Naql365/actions/runs/34696040884). The final documentation commit and its exact-HEAD CI are reported in the owner closeout after push; a commit cannot embed its own SHA. No merge is performed.

```text
7ea1388e44eb6ed4f35119d1b35ae5be60868777 docs: record Phase 3 operations schema gap and execution invariants
5c13c70fad0d071adf985d91137d7c3e69bc2f1f feat: add transactional multi-trip operations and private POD schema
da659a03bd262d39b3349e3dfd9c2521ba0564c1 feat: add bilingual operations workspace and private delivery evidence
f0e5719b870ddeaa1828bf6dfb0644dcb32a56f0 test: prepare hosted Phase 3 acceptance and record outstanding gates
0061e4ff8e9ee76e411a9bd3550c675778291a8b test: clean concurrency fixtures through the local Storage API
1a910f5f69ba59bc127f6d4351176d4898f09f89 test: expand hosted operational isolation and private POD coverage
a4856eece1c897a90df78c9a8c6dfe2ddfa2bfca chore: use authoritative Supabase CI database types
677f62fc53c589d277bfa85a250408a45830eb8f chore: record hosted Supabase PostgREST type metadata
50d8a2a32343a86c5d520ff9595853a53f65a137 test: harden hosted operations session isolation and cleanup
99e09f9e5e4568bd96087aafa020e1fb65501411 fix: use the shared main landmark on operations pages
99776ae3074b3c3bef8ed9a3061986023454b004 docs: record verified Phase 3 staging progress and acceptance findings
f7da93c591bd8ad5a0a4f71aa21549fe82e8f493 test: verify streamed tracking denial through content and RLS
6e692285e5ec6cb7d46695643aa1c264f6bc7017 fix: record safe identity query error codes for hosted diagnostics
70b1c14d3c9c317ad8fc3d00db23cb6f182afb4e docs: record hosted operations pass and remaining regression blocker
8baf7bdc909e298195fac308d9eb06beb41d6526 fix: record safe customer session verification failure codes
3bff649ed8132accfce84f53a6df1517ff079268 docs: record intake regression evidence and active diagnostic preview
980f3e9a5ab15b65fd5036d3080a04c82a1dfe56 test: bound hosted intake navigation and assertion deadlines
```

## AK. Known Limitations

Local Docker Desktop is unavailable; completed Supabase CI supplies fresh reconstruction and real independent PostgreSQL connections. Planned overlap is a warning; active execution conflicts are authoritative. Signed URLs are short-lived bearer capabilities. POD normalization is not antivirus, legal signature validation or identity verification. Accessibility evidence is automated smoke coverage, not full manual WCAG certification. Earlier transient errors are documented in AF without an invented root cause. Failed/cancelled/partial fulfilment, refunds and post-start route edits are not silently resolved. The protected Preview requires authorized Vercel access after removal of temporary test bypass credentials.

## AL. Deferred Items

Driver Portal/login, GPS/maps/automatic ETA, route optimization, AI, messaging automation, payments/refunds/settlements, marketplace, SaaS billing, Production deployment and Phase 4.

## AM. Acceptance Matrix

| Gate                         | Result | Evidence                                                 |
| ---------------------------- | ------ | -------------------------------------------------------- |
| Git baseline                 | PASS   | B: unchanged protected branches                          |
| Gap analysis                 | PASS   | C: preserved prerequisite commit                         |
| Schema/migrations            | PASS   | E: 13 migrations; 49 RLS tables; no generated-type drift |
| Order → Job                  | PASS   | F: hosted idempotency and independent race               |
| Multi-Trip                   | PASS   | G: two hosted Trips                                      |
| Multi-Stop                   | PASS   | H: four Stops per Trip                                   |
| Stop dependencies            | PASS   | I/Q: ordering and denial                                 |
| Internal Driver              | PASS   | J: hosted internal resource                              |
| External Driver              | PASS   | K: no Auth account; staff actor                          |
| Vehicle independence         | PASS   | L/N: independent resource conflicts                      |
| Assignment                   | PASS   | M: hosted assignment commands                            |
| Resource conflicts           | PASS   | N/AB: hosted 409 and real races                          |
| Emergency reassignment       | PASS   | O: required reason and cross-tenant denial               |
| Assignment history           | PASS   | M/O: retained history and one current row                |
| Trip state machine           | PASS   | P/W: guarded transitions                                 |
| Stop state machine           | PASS   | Q: ordered progression and races                         |
| Trip Events                  | PASS   | R: staff actor and private reads                         |
| Operations workspace         | PASS   | T: authenticated hosted workspace                        |
| Dispatch Board               | PASS   | S: AR/EN desktop/mobile                                  |
| Customer tracking            | PASS   | U: customer projection and peer denial                   |
| POD                          | PASS   | V: private signature, expiry, one final POD              |
| Trip completion              | PASS   | W: denied before POD; allowed afterward                  |
| Job completion               | PASS   | X: first Trip does not complete Job                      |
| Order operational completion | PASS   | Y: final aggregate; commercial facts unchanged           |
| RLS                          | PASS   | Z: hosted SQL and API negatives                          |
| Tenant isolation             | PASS   | Z: foreign resources and mutations denied                |
| Customer isolation           | PASS   | U/Z: peer data denied                                    |
| Concurrency                  | PASS   | AB: independent connections, retry/aggregate checks      |
| Security                     | PASS   | AC: hosted assets/headers/log audit                      |
| Accessibility                | PASS   | AD: authenticated axe and focus                          |
| AR/EN                        | PASS   | AE: hosted RTL/LTR                                       |
| Regression                   | PASS   | AF: 21 hosted; 99 unit/integration; 18 CI E2E            |
| CI                           | PASS   | AJ: both exact-source jobs passed                        |
| Hosted Staging               | PASS   | AG: genuine protected READY Preview                      |
| Cleanup                      | PASS   | AH: zero fixtures, objects and bypass credentials        |
| Scope compliance             | PASS   | AL: no merge, Production or Phase 4                      |

## AN. Final Decision

PHASE 3 PASS — READY FOR REVIEW

Stop for explicit owner review. Do not merge, deploy Production or start Phase 4.
