# Phase 3 — Operations, dispatch and final POD

## Inspected baseline and delivery boundary

The accepted remote develop commit is `86ba612a5f6f7f4afd7a5c0650d5b4d3848f2b6f` (protected Phase 2 PR #3). Its CI run `34681047917` passed. Phase 3 starts on `feature/phase-3-operations-dispatch-pod`, with no uncommitted baseline changes. Main remains `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`. This analysis precedes any Phase 3 migration.

Inspection includes the ten migrations, generated public database types, Phase 0–2 reports, permission functions, request image upload guards, commercial acceptance command, integration database harness and established protected Preview/Staging procedures. The accepted implementation contains 47 public tables with RLS. No existing entity will be recreated.

## Actual schema gaps

| Existing relation/boundary | Current facts                                                                                                                           | Additive Phase 3 changes                                                                                                    |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| orders                     | Exactly-one accepted Quote Version; tenant/customer/request references; immutable commercial snapshot inputs; acceptance creates no Job | Separate operational progress/completion; guard accepted commercial facts during updates                                    |
| jobs                       | Tenant and Order foreign key, timestamps; no uniqueness per Order or execution state                                                    | One primary Job per Order, stable reference, revision/progress/completion                                                   |
| trips                      | Tenant and Job foreign key, timestamps                                                                                                  | Stable reference, explicit state, revision, planned window, start/completion times                                          |
| trip_stops                 | Tenant/Trip composite identity, unique nonnegative position, timestamps                                                                 | Pickup/delivery type, minimal address, optional operational notes/window, execution state/times                             |
| trip_events                | Trip/Stop composite foreign keys, type and timestamp                                                                                    | Authenticated staff actor, mutation identity and bounded event facts                                                        |
| drivers                    | Required profile linked to driver-category membership                                                                                   | Explicit INTERNAL/EXTERNAL, optional profile for INTERNAL, forbidden profile for EXTERNAL, operational name and active flag |
| vehicles                   | Independent tenant/optional branch resource                                                                                             | Operational identifier, type and active flag; no permanent Driver association                                               |
| assignments                | Tenant-safe Trip/Driver/Vehicle/Team foreign keys, generic audit                                                                        | Complete Driver+Vehicle pairing, actor, end/replacement time, reason, active execution exclusivity and preserved history    |
| teams                      | Branch-linked skeleton                                                                                                                  | Retain; no team management or settlement workflow                                                                           |
| Storage                    | Private pod-files bucket already exists; generic registered file reads; no POD process                                                  | Dedicated POD reservation/final record and narrowly scoped private access, independent of customer request attachments      |
| RBAC                       | Operations/Dispatcher have reads only; Sales pricing authority separate                                                                 | Explicit operational planning/execution/resource capabilities; no automatic Sales grant                                     |
| server/domain              | Quote acceptance and transport reference interfaces; no operational commands                                                            | Validated user-scoped adapters, reusable command schemas and SQL state authority                                            |
| customer account           | Own Request/Quote/Order visibility                                                                                                      | Safe operational projection only, without raw assignment/event/driver access                                                |

The existing `validate_person_membership` trigger also covers customers. External-driver support must adapt the driver branch without weakening the customer membership requirement. Existing Trip Event Stop foreign keys are retained. Skeleton records lacking required planning facts remain non-executable; migrations must not invent names, addresses, identities or historical execution.

## Order, Job and Trip boundaries

One accepted Order has one primary Job, enforced by a tenant/Order unique constraint and a locked idempotent creation command. Job creation reads accepted references without recalculating pricing. A Job has multiple independently planned Trips. Database counters issue stable J-N365 and T-N365 monthly references atomically; no MAX()+1 and no client reference authority.

Commercial fields remain Phase 2 authority: Quote Version, currency, subtotal, VAT, total, accepted distance/source and accepted timestamps cannot change through operations. Operational status is separate. Customer is derived from Order, avoiding a second mutable customer source of truth on Trip.

## Stop plan and dependencies

All Trips and Stops in this phase are required for successful fulfilment. Each Trip needs at least one Pickup and one Delivery before readiness. A Delivery explicitly references one or more earlier Pickups in the same Trip. This is stop-level dependency only; it makes no claim about exact item allocation, load conservation or optimized routing. Dispatchers identify the required Pickups in planning. Composite foreign keys prevent cross-Trip/tenant dependencies.

Execution follows the explicit sequence. A Delivery cannot start or complete before its linked Pickups complete. Plan validation rejects missing/forward dependencies, duplicate positions and impossible plans. Authorized staff can replace/reorder the plan before dispatch; plan change returns readiness to planning and is audited. After dispatch, sequence and planning facts freeze. No stop skipping, cancellation or emergency route rewriting is introduced.

## Explicit state transitions

Trip commands are allowlisted business actions, never a free-form status update:

| Action                  | Required state                                | Result                                                       |
| ----------------------- | --------------------------------------------- | ------------------------------------------------------------ |
| Create Trip             | Open Job                                      | PLANNED                                                      |
| Assign Driver + Vehicle | PLANNED/ASSIGNED/READY                        | ASSIGNED; readiness needs review                             |
| Review readiness        | ASSIGNED + valid plan/resources               | READY                                                        |
| Dispatch                | READY + no exclusive resource conflict        | EN_ROUTE_TO_PICKUP; first Stop EN_ROUTE                      |
| Arrive at current Stop  | Stop EN_ROUTE                                 | AT_PICKUP or AT_DELIVERY; Stop ARRIVED                       |
| Start service           | Stop ARRIVED and dependencies complete        | PICKUP_IN_PROGRESS or DELIVERY_IN_PROGRESS; Stop IN_PROGRESS |
| Complete current Stop   | Stop IN_PROGRESS and dependencies complete    | PICKED_UP or DELIVERED; Stop COMPLETED                       |
| Depart for next Stop    | Previous Stop COMPLETED                       | EN_ROUTE_TO_PICKUP or IN_TRANSIT; next Stop EN_ROUTE         |
| Capture final POD       | All Stops COMPLETED; last Delivery finished   | Final immutable POD; Trip remains DELIVERED                  |
| Complete Trip           | All Stops complete + final valid POD          | COMPLETED; release exclusive resources                       |
| Cancel / fail           | Nonterminal Trip, authorized actor and reason | CANCELLED / FAILED; release resources; aggregate exception   |

Trip status describes the current operational segment; Stop rows preserve progress of every visit. Intermediate DELIVERED does not mean the Trip or Order is complete when later Stops remain. Terminal Trips reject operational mutation. Completed Stops cannot be reset. Each command checks expected revision and mutation ID; authenticated retries return the prior result without repeating events. Mutation reuse with different intent is rejected.

## Assignment and conflicts

Driver and Vehicle are selected independently. INTERNAL Driver may link an existing driver-category membership, but does not need a portal in this phase. EXTERNAL Driver has no Auth profile, login or customer-style registration. Staff actor is always `auth.uid()`, distinct from the operational Driver.

Initial and replacement assignments create history records. Exactly one current assignment exists per Trip. Emergency replacement after dispatch requires a nonempty bounded reason and confirmation UI; driver-only, vehicle-only and both changes are supported. The previous row is closed, never overwritten with new resources. Event and audit preserve resource identifiers and actor/time without copying phone/address data.

Active execution is the hard resource boundary: partial unique indexes prevent concurrent exclusive use of a Driver or Vehicle by two executing Trips. Planning windows provide warnings, not a promise of future capacity; dispatch rechecks active conflicts and resource status atomically. Short command transactions take a tenant-scoped advisory lock, then the relevant Trip/Job rows. This conservative Phase 3 serialization also covers resource activation and final aggregate completion; no network work runs while holding it. Different tenants remain independent. Reassignment acquires the replacement resources before committing release of the old assignment; any conflict rolls back the whole command. Unique constraints remain the final concurrency backstop.

## Final POD and private files

ONE final POD belongs to each Trip. Required facts are recipient name, signature evidence, server capture time, authenticated staff actor and Trip identity. A signature image selected/captured on a mobile/tablet is supported; no driver authentication or fabricated location is needed. Optional photo/location is deferred. Safe optional notes remain staff-only.

Use the existing private pod-files bucket with a dedicated tenant/Trip reservation path, bounded PNG/JPEG signature bytes, declared and stored MIME/size verification, short reservation lifetime, no upsert and an immutable final record. The server validates bytes using the existing image inspection boundary and database commands verify authorization/state again. Storage upload preflight and completion guard must prevent races with finalized evidence, suspended membership and concurrent finalization. Existing request image policies remain unchanged. Direct authenticated uploads still face the database reservation and size/type gate; no malware scanning claim is made.

Final POD reads use short-lived signed URLs after current tenant permission verification. Customers receive only safe progress/POD-captured status, never raw signatures, recipient names, paths, internal notes or assignment reasons. No public URL access. Cleanup uses the Storage API before deleting disposable fixture records; catalogue/schema data stays intact.

## Completion and exceptions

Complete Trip locks its Job and validates all required Stops plus finalized POD in the same transaction. Aggregate progress is recomputed under the Job lock. Zero Trips never completes a Job. One completed Trip among several remains in progress. All required Trips COMPLETED produces Job completion and separate Order operational completion, with audit events once. Failed/cancelled Trips produce an exception and do not count as successful delivery. A completed Job cannot gain a new Trip.

Partial fulfilment approval, refunds, cancellation-as-success and replacement fulfilment policy are not invented. This phase records exceptions and keeps aggregate successful completion closed. If resolving such exceptions financially or partially becomes necessary, owner policy is required before implementation.

## Security and interfaces

Presentation calls validated server adapters with authenticated Supabase clients; no service-role application client. SQL commands check current active tenant permission, lock state, validate all foreign resources and write events/audit transactionally. Authenticated roles retain no direct INSERT/UPDATE/DELETE privileges on operational records. Security-definer functions use empty search paths and explicit execute grants. New public tables enable RLS. Customer projection functions enforce active ownership and return a fixed safe field set, without generic JSON row serialization.

Operations workspace and Dispatch Board show accepted Orders, open Jobs, Trip groups, assignments and exceptions. Job detail joins operationally necessary Request/service/route summaries. Planner provides explicit ordered Stops and dependencies. Action controls expose the next valid command; emergency reassignment is a confirmation dialog with reason. AR/EN translations, RTL/LTR, keyboard access, focus, labeled fields and mobile overflow are part of acceptance. No global client authority or new dependency is assumed necessary.

## Verification and rollout

Extend unit validation/state tests and SQL rollback/RLS suites. Run real PostgreSQL concurrency tests for Order-to-Job, reference generation, assignment/resource races, emergency reassignment, Stop/POD/Trip completion and final aggregate completion. Include negative Customer, Sales, anonymous, suspended and cross-tenant commands; forged events/POD; direct status writes; pickup dependencies; missing POD; terminal mutation; commercial snapshot invariance. PGlite provides fast reconstruction but does not replace concurrent PostgreSQL/hosted evidence.

Run formatting, secret scan, lint, strict types, unit/integration, all Supabase migration/RLS tests, generated-type comparison, build and E2E without ignored failures. Only then apply repository migrations to the established Supabase Staging and deploy a genuine protected Vercel Preview. Use the exact allowlisted Auth origin and existing safe operator procedures. No Production variables or resources.

Hosted acceptance repeats real Phase 1–2 intake/Quote acceptance, then one Job with at least two Trips, one containing two Pickups and two Deliveries. Exercise internal/external resources, independent assignments, emergency replacement, authoritative conflicts, all Stops, denied completion before POD, private evidence, first-Trip incomplete aggregate and final correct completion. Verify customer-safe tracking, AR/EN/mobile/axe, headers/redirects/bundles, then remove synthetic rows/files/identities/sessions and revoke temporary automation bypass. Final report must distinguish observed PASS from unfinished evidence.

## Explicit exclusions

Driver Portal or external login, GPS/maps/live tracking, automatic ETA/routing/optimization, AI, WhatsApp/SMS automation, payments/refunds/settlements, marketplace/bidding, SaaS billing, Production deployment and Phase 4 are excluded. No merge is authorized by Phase 3 implementation approval.
