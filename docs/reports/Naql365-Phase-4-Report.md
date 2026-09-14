# Naql365 — Phase 4: Internal Driver Execution Portal

Implementation checkpoint, 2026-09-14. Hosted acceptance is not yet complete. This is the canonical report and will be updated with measured hosted evidence before a final review decision.

## A. Starting State

Phase 3.5 protected develop contained 19 migrations, SA/EG Markets and the accepted Phase 3 execution/POD engine.

## B. Git Baseline

Develop: `167f2caba4685e71c44d19b20423115acf0100da`. Main: `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`. Branch: `feature/phase-4-internal-driver-portal`. Neither protected branch has been modified.

## C. Driver Execution Gap Analysis

[Gap analysis](../phase-4-driver-execution-gap-analysis.md) committed separately as `022ae5d` before migrations. No unresolved owner business decision was identified.

## D. Architecture

Driver RPCs authorize the current identity/assignment and invoke the existing operational engine under its organization lock. Server adapters validate inputs with Zod. Server-rendered projections minimize customer/staff data; client components handle interaction only.

## E. Migrations

Five additive Phase 4 migrations; 24 total. Identity/authority, shared execution, projections/issues, private evidence and bounded issue projection. The original 19 migrations are unchanged. Populated upgrade tests compare every pre-existing field, including completed Trips/POD and commercial history.

## F. Driver Identity

Active INTERNAL resource links to the authenticated profile UUID. Organization/profile uniqueness prevents ambiguous mapping. Active DRIVER membership, actual DRIVER role and active Market are independently required. EXTERNAL resources fail the identity predicate.

## G. Authentication

Dedicated AR/EN email/password login reuses Supabase SSR cookies and existing trusted provisioning. No public Driver signup, metadata role promotion or phone OTP. Hosted session restoration/logout evidence is pending.

## H. Driver RBAC

DRIVER grants no implicit staff authority. Driver commands accept only dispatch, arrival, start service, complete Stop, departure and complete Trip. Assignment, vehicle selection and emergency override remain staff commands.

## I. Driver RLS

Raw operational/commercial tables remain denied. Security-definer RPCs return fixed projections only after current assignment validation. Direct private Storage access additionally checks current authorization. Local negatives pass; hosted negatives pending.

## J. Driver Portal UX

Phone-first cards, ordered Stops, next explicit action, localized errors and confirmation, online-first retry with retained mutation intent, touch signature and upload alternative. No polling or offline queue.

## K. Today

Uses the Trip Market's IANA local date. Includes overdue unfinished and unscheduled assignments so they do not disappear from execution. Dates remain visible.

## L. Upcoming

Future assignments use each Market's date. Existing READY execution semantics remain unchanged; no new arbitrary date restriction.

## M. Completed

Twenty-row pages, capped offset. Final assignment attribution; read-only projection removes contact/address/private issues. Current active identity remains required.

## N. Trip Details

Reference, Market, local schedule, Vehicle, ordered Stops, execution contact, explicit driver instructions, bounded private issues and POD state. Staff notes, financial details and unrelated customer history are excluded.

## O. Trip State Machine

Shared Phase 3 transitions and revision checks remain authoritative. No generic status setter was added.

## P. Stop State Machine

Arrival, service and completion remain explicit commands. Stop ordering and pickup prerequisites are retained.

## Q. Multi-Stop Execution

The UI selects the first unfinished Stop; the database independently checks dependency/order. Hosted four-Stop scenarios are prepared for both Markets.

## R. Assignment Authority

Every mutation checks active assignment under the organization lock before replay. Historical assignment does not grant current execution rights.

## S. Reassignment Behavior

Independent-connection CI proves execution/reassignment races and old-driver denial after reassignment. History remains append-only. Hosted verification pending.

## T. Issue / Failed Stop

Existing issues entity extended with Trip/Stop/actor, bounded category and mandatory reason. OPEN attention blocks Driver progression; authorized Dispatch resolves with a reason. Reporting does not terminally fail/cancel the Stop or Trip.

## U. Issue Attachments

One optional private PNG/JPEG per issue, at most 2 MiB and eight megapixels. Actual image decoding/re-encoding strips metadata. Upload bodies are bounded while streaming. No antivirus claim. Current assignment/staff permission governs reads.

## V. Event Geolocation

Optional single capture for arrival or final POD. Typed ranges, timestamp, event and actor binding. Permission denial continues the action without fabricated coordinates. Public pages deny geolocation; Driver routes permit same-origin requests only.

## W. POD

Reuses Phase 3 reservation/finalization and private signature bucket. One final POD per Trip, authenticated actor distinct from recipient. Duplicate finalize is replayed or rejected safely. Touch drawing and labeled image-upload alternative are implemented.

## X. Trip Completion

All required Stops plus final POD remain mandatory. Local tests reject premature completion and premature POD.

## Y. Job/Order Completion

Existing aggregate engine retained. Completing one Trip does not complete a multi-Trip Job. Commercial snapshot fields remain unchanged.

## Z. Customer Tracking

Existing status-only projection remains the source. Driver issues, precise coordinates and private files are not added to customer tracking.

## AA. SA Market

SA uses accepted Market metadata and Asia/Riyadh scheduling. Hosted journey pending.

## AB. EG Market

EG uses accepted Market metadata and Africa/Cairo scheduling. Hosted journey pending.

## AC. Timezones

IANA logic reused from Phase 3.5. Winter UTC-boundary test distinguishes SA and EG local dates; no fixed Saudi offset is applied globally.

## AD. Privacy

Live assignment discloses execution contact/address only. Completed history removes them. Issues are private operational evidence. Signed URLs are short-lived capabilities: an already-issued URL may remain usable until its expiry even after reassignment.

## AE. Security

Same-origin mutations, strict input schemas, current database authorization, immutable evidence and unchanged commercial security. No privileged app credential added. Tracked secret scan passes. Hosted logs/assets review pending.

## AF. Concurrency

[CI 34849417444](https://github.com/Rmdn96/Naql365/actions/runs/34849417444), source `fd879c31e1315eb8e77581f7c6c5706ddda4a24e`: real independent PostgreSQL connections passed duplicate starts, duplicate Stops, reassignment race, old-driver denial, duplicate issue, duplicate POD and Driver/staff completion. Existing Phase 3 concurrency also passed. No skipped concurrency step.

## AG. Accessibility

Local login AR/EN axe, focus and narrow-width tests pass. Touch signature has labeled upload alternative and instructions. Authenticated hosted Driver/Operations accessibility remains pending; no WCAG certification claim.

## AH. AR/EN

Central dictionaries, localized status/action labels, RTL/LTR layout and portal locale links. Hosted execution in both languages pending.

## AI. Tests

Checkpoint: 119 unit/integration tests and 24 local browser tests passed. Formatting, lint, strict types, secret scan and production build passed. A defective upgrade-test assumption about a universal `id` column was corrected; populated upgrade now passes without changing accepted migrations.

## AJ. CI

Checkpoint CI 34849417444 PASS, including fresh reconstruction, SQL/RLS, both concurrency harnesses, exact generated-type diff, build and E2E. Official type-generation run 34849417510 PASS. The final feature HEAD will require its own passing run.

## AK. Hosted Preview

Pending Phase 4 deployment. Vercel audit: Preview-scoped public Supabase URL/key plus server staging flags; no Production-scoped variables or Production deployments. Protection remains enabled.

## AL. Saudi Hosted Journey

Prepared, not executed.

## AM. Egypt Hosted Journey

Prepared, not executed.

## AN. Reassignment Hosted Test

Prepared, not executed.

## AO. Issue Hosted Test

Prepared, not executed.

## AP. Customer Tracking Hosted Test

Prepared, not executed.

## AQ. Cleanup

Local fixtures are rolled back/deleted. Hosted runner includes scoped Auth, membership, operational/commercial fixtures, issues/photos/location events and private mutation cleanup. No Phase 4 hosted fixture has yet been created.

## AR. Files Changed

Driver domain/infrastructure/components/routes/dictionary; Operations issue display/resolution; streaming evidence parser; five migrations; generated types; local tests and independent concurrency harness; CI type-drift check; hosted test runner/config/suite. See branch diff for full inventory.

## AS. Commits

`022ae5d` analysis; `b322588` database authority; `c2cff71` Driver portal; `fd879c3` verification/concurrency. Later hosted acceptance commits will be recorded at closeout.

## AT. Known Limitations

Hosted acceptance remains outstanding. Online-first only; retry state is in the current page, not an offline outbox. Geolocation is optional device-reported evidence, not proof of physical presence. No malware scanner or certified digital signature. No new analytics provider.

## AU. Deferred Items

EXTERNAL login, OTP, continuous/background GPS, live maps, ETA, optimization, geofencing, offline sync, push/messaging automation, payments/refunds/settlement, marketplace/carrier onboarding/payroll, international freight, AI, Phase 5 and Production.

## AV. Acceptance Matrix

| Gate                      | Result  | Evidence                                                   |
| ------------------------- | ------- | ---------------------------------------------------------- |
| Git baseline              | PASS    | Protected baseline fetched unchanged                       |
| Gap analysis              | PASS    | Analysis committed before migrations                       |
| Driver identity           | PARTIAL | Local/CI pass; hosted pending                              |
| Internal Driver auth      | PARTIAL | Implemented; hosted pending                                |
| External Driver exclusion | PARTIAL | Predicate/constraints; hosted pending                      |
| DRIVER RBAC               | PARTIAL | Local negatives; hosted pending                            |
| Driver RLS                | PARTIAL | CI database checks; hosted pending                         |
| Today                     | PARTIAL | Market-local query; hosted pending                         |
| Upcoming                  | PARTIAL | Implemented; hosted pending                                |
| Completed                 | PARTIAL | Local privacy checks; hosted pending                       |
| Trip details              | PARTIAL | Minimized projection; hosted pending                       |
| Trip state machine        | PARTIAL | Shared engine CI pass; hosted pending                      |
| Stop state machine        | PARTIAL | Local/CI pass; hosted pending                              |
| Multi-stop dependencies   | PARTIAL | Local/CI pass; hosted pending                              |
| Assignment authority      | PARTIAL | Local/CI pass; hosted pending                              |
| Emergency reassignment    | PARTIAL | Independent race PASS; hosted pending                      |
| Issue reporting           | PARTIAL | Retry/resolution tests; hosted pending                     |
| Optional issue photo      | PARTIAL | Private local checks; hosted pending                       |
| Event geolocation         | PARTIAL | DB binding/range tests; hosted pending                     |
| No live GPS               | PASS    | Single explicit capture only                               |
| POD                       | PARTIAL | Local/CI immutability/replay; hosted pending               |
| Trip completion           | PARTIAL | Prerequisites/CI pass; hosted pending                      |
| Aggregate Job completion  | PARTIAL | Existing aggregate CI; hosted pending                      |
| Customer tracking         | PARTIAL | Existing safe projection; hosted pending                   |
| SA execution journey      | PARTIAL | Not executed hosted                                        |
| EG execution journey      | PARTIAL | Not executed hosted                                        |
| Market isolation          | PARTIAL | Schema/negative tests; hosted pending                      |
| Privacy                   | PARTIAL | Projections and local denial; hosted pending               |
| Concurrency               | PASS    | Independent-connection CI checkpoint                       |
| Security negatives        | PARTIAL | Local checks; hosted pending                               |
| AR/EN                     | PARTIAL | Local login tests; hosted execution pending                |
| Mobile                    | PARTIAL | Local narrow-width tests; hosted pending                   |
| Accessibility             | PARTIAL | Local login axe; authenticated hosted pending              |
| Migrations                | PARTIAL | Fresh CI + populated 19-migration upgrade; Staging pending |
| Generated types           | PASS    | Official workflow + exact CI diff                          |
| Regression                | PARTIAL | Local/CI pass; hosted pending                              |
| CI                        | PARTIAL | Checkpoint PASS; final HEAD pending                        |
| Hosted Preview            | PARTIAL | Phase 4 not deployed                                       |
| Cleanup                   | PARTIAL | Local clean; hosted lifecycle pending                      |
| Scope compliance          | PASS    | No Production/main/Phase 5 changes                         |

## AW. Final Decision

PHASE 4 PARTIAL — NOT READY

Work continues through hosted acceptance. This checkpoint is not approval to merge or release.
