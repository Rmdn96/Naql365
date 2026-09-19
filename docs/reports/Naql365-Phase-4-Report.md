# Naql365 — Phase 4: Internal Driver Execution Portal

Acceptance completed on 2026-09-16: 25 hosted tests passed on the same protected Preview, disposable fixtures and automation credentials were removed. Final delivery is gated on the documentation commit’s own CI result, reported with its exact SHA/run in the delivery evidence.

## A. Starting State

Phase 3.5 protected develop contained 19 migrations, SA/EG Markets and the accepted Phase 3 execution/POD engine.

## B. Git Baseline

Develop: `167f2caba4685e71c44d19b20423115acf0100da`. Main: `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`. Branch: `feature/phase-4-internal-driver-portal`. Neither protected branch has been modified.

## C. Driver Execution Gap Analysis

[Gap analysis](../phase-4-driver-execution-gap-analysis.md) committed separately as `022ae5d` before migrations. No unresolved owner business decision was identified.

## D. Architecture

Driver RPCs authorize the current identity/assignment and invoke the existing operational engine under its organization lock. Server adapters validate inputs with Zod. Server-rendered projections minimize customer/staff data; client components handle interaction only.

## E. Migrations

Six additive Phase 4 migrations; 25 total. Identity/authority, shared execution, projections/issues, private evidence, bounded issue projection and stable final-assignment attribution. The original 19 migrations are unchanged. Populated upgrade tests compare every pre-existing field, including completed Trips/POD and commercial history.

## F. Driver Identity

Active INTERNAL resource links to the authenticated profile UUID. Organization/profile uniqueness prevents ambiguous mapping. Active DRIVER membership, actual DRIVER role and active Market are independently required. EXTERNAL resources fail the identity predicate.

## G. Authentication

Dedicated AR/EN Email/Password login reuses trusted provisioning and Supabase SSR. Both country journeys passed session restoration and logout. The separate hosted session test passed real cookie expiry, Secure/SameSite=Lax flags, suspended membership denial and role-loss denial in both languages. It expires browser cookies, not the Supabase JWT clock. No public Driver signup, email-based authorization, metadata promotion or phone OTP.

## H. Driver RBAC

DRIVER grants no implicit staff authority. Driver commands accept only dispatch, arrival, start service, complete Stop, departure and complete Trip. Assignment, vehicle selection and emergency override remain staff commands.

## I. Driver RLS

Raw operational/commercial tables remain denied. Fixed database projections require identity/current assignment; private Storage independently checks authority. Hosted tests passed Customer/Sales/EXTERNAL exclusion, other Driver/unassigned access denial, cross-organization and cross-Market denial, role loss and suspended membership. Local SQL/RLS and integration negatives also pass.

## J. Driver Portal UX

Phone-first cards, ordered Stops, next explicit action, localized errors and confirmation, online-first retry with retained mutation intent, touch signature and upload alternative. No polling or offline queue.

## K. Today

Uses the Trip Market's IANA local date. Includes overdue unfinished and unscheduled assignments so they do not disappear from execution. Dates remain visible.

## L. Upcoming

Future assignments use each Market's date. Existing READY execution semantics remain unchanged; no new arbitrary date restriction.

## M. Completed

A reproduced same-transaction handover/completion defect was corrected additively in `20260915000100`: authorization now uses a private stable final-assignment relationship rather than equal timestamps. Regression denies the old Driver after two handovers and completion in one transaction. Existing unambiguous history is retained; ambiguous legacy Driver attribution fails closed, with staff history preserved.

Twenty-row pages, capped offset. Final assignment attribution; read-only projection removes contact/address/private issues. Current active identity remains required.

## N. Trip Details

Reference, Market, local schedule, Vehicle, ordered Stops, execution contact, explicit driver instructions, bounded private issues and POD state. Staff notes, financial details and unrelated customer history are excluded.

## O. Trip State Machine

Shared Phase 3 transitions and revision checks remain authoritative. No generic status setter was added.

## P. Stop State Machine

Arrival, service and completion remain explicit commands. Stop ordering and pickup prerequisites are retained.

## Q. Multi-Stop Execution

Both hosted Markets passed four Stops (two pickups and two deliveries) on each of two Trips. The UI proposes the next action; server state, revision, order and pickup dependencies remain authoritative. Premature completion/POD and unauthorized commands were rejected.

## R. Assignment Authority

Every mutation checks active assignment under the organization lock before replay. Historical assignment does not grant current execution rights.

## S. Reassignment Behavior

Both hosted journeys reassigned a started Trip from Internal Driver A to B through authorized staff. A immediately lost execution authority; B gained it, history retained both assignments, and commercial facts stayed unchanged. Independent-connection CI additionally exercises the completion/reassignment race.

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

PASS on the accepted Preview: Arabic/RTL, Saudi Market and resources, Market-local Today/Upcoming, four Stops/two Trips, touch signature, issue/photo, reassignment, private POD and aggregate completion. Cross-Market execution is denied.

## AB. EG Market

PASS on the same Preview: English/LTR, Egyptian Market and resources, Africa/Cairo scheduling, four Stops/two Trips, signature upload alternative, issue/photo, reassignment, private POD and aggregate completion. No Saudi currency/timezone defaults are used for the Egypt fixture.

## AC. Timezones

IANA logic reused from Phase 3.5. Winter UTC-boundary test distinguishes SA and EG local dates; no fixed Saudi offset is applied globally.

## AD. Privacy

Live assignment discloses execution contact/address only. Completed history removes them. Issues are private operational evidence. Signed URLs are short-lived capabilities: an already-issued URL may remain usable until its expiry even after reassignment.

## AE. Security

Same-origin validation, strict schemas, database authorization, immutable evidence and unchanged commercial boundaries. Hosted browser bundles contained no privileged fixture credentials or source-map directives. Private public-object access and unauthorized signed access were denied; the same signed object URL worked before expiry and failed after expiry. App-issued URLs retain their 60-second TTL; the direct Storage test uses ten seconds to allow network transport. An initial one-second test expired before its access assertion and was replaced with explicit before/after checks, not a weaker expiry policy. A bounded 1,000-request sample from this Preview contained no detected secret/JWT/auth-query patterns or error-level records. This is a sampled log review, not an exhaustive historical guarantee. Production has zero deployments and zero environment-scoped variables in the project.

## AF. Concurrency

[CI 34849417444](https://github.com/Rmdn96/Naql365/actions/runs/34849417444), source `fd879c31e1315eb8e77581f7c6c5706ddda4a24e`: real independent PostgreSQL connections passed duplicate starts, duplicate Stops, reassignment race, old-driver denial, duplicate issue, duplicate POD and Driver/staff completion. Existing Phase 3 concurrency also passed. No skipped concurrency step.

## AG. Accessibility

Hosted login, Driver list/details/completed views and affected Operations pages passed axe checks. AR/EN keyboard login, labels, landmarks, RTL/LTR and 390px width checks passed. Saudi touch ink was verified before POD submission; Egypt used the labeled signature-upload alternative. No full WCAG or legal-signature certification is claimed.

## AH. AR/EN

Both complete hosted execution journeys passed, Arabic/RTL for SA and English/LTR for EG. The independent session test also passed both languages. Central dictionaries supply status/action/error labels.

## AI. Tests

120 unit/integration tests and 24 local browser tests passed. Hosted acceptance: 3 Phase 4 tests, 12 foundation desktop/mobile tests, 6 intake tests, 1 commercial test and 3 operations/Market tests: 25 passed, no final failed tests. All ran on the accepted Preview. Initial whole-journey regression timeouts were corrected with bounded 120-second test/45-second navigation timeouts; retries remain zero and security assertions were retained. Formatting, lint, strict types, secret scan and production build passed. A defective upgrade-test assumption about a universal `id` column was corrected; populated upgrade now passes without changing accepted migrations.

## AJ. CI

Checkpoint CI 34849417444 PASS, including fresh reconstruction, SQL/RLS, both concurrency harnesses, exact generated-type diff, build and E2E. Official type-generation run 34849417510 PASS. Hosted-suite checkpoint `d7d8ea759e389cabbcd0d7d6f8c0a7ed85d4db70` also passed [CI 34850723142](https://github.com/Rmdn96/Naql365/actions/runs/34850723142). Verification checkpoint `0228f56c66c9b0a1957c16807bf1788353a11faa` passed [CI 35098462779](https://github.com/Rmdn96/Naql365/actions/runs/35098462779), including both required jobs. The documentation-only closeout commit must pass the same workflow before delivery; its exact SHA and run are supplied in the final delivery evidence. No deployed application change follows the accepted Preview source.

## AK. Hosted Preview

Protected Preview https://naql365-staging-ax05mh4n0-naql365.vercel.app is READY, Vercel target `null` (Preview), source `3f1d8ae169af3133b51ca05fba11ac410da46223`. Staging upgraded from 19 to 25 migrations on 2026-09-15; all SQL assertions passed and all 56 public tables have RLS. Hosted public types match official CI types; the only generator difference was the optional PostgREST 14.5 client hint, now compared separately from schema. Vercel audit: Preview-scoped public Supabase URL/key plus server staging flags; no Production-scoped variables or Production deployments. Protection remains enabled.

## AL. Saudi Hosted Journey

PASS: `tests/phase4/journey.spec.ts` Saudi test. Accepted Order → one Job → two Trips → four Stops each; INTERNAL login/Today/Upcoming; start/arrival/service/completion; optional location denial and later capture; staff emergency reassignment; private issue/photo and staff resolution; touch POD; first Trip leaves Job unfinished; final Trip completes aggregate; safe customer tracking; immutable commercial facts.

## AM. Egypt Hosted Journey

PASS: the Egypt test in the same suite repeats the execution, authorization, multi-Trip, issue/photo, private POD, aggregate, tracking, mobile and accessibility checks with EG resources and English/LTR.

## AN. Reassignment Hosted Test

PASS in both journeys. Current assignment changes through authorized staff, previous Driver denied, replacement executes, historical assignments retained. Driver cannot change Driver/Vehicle or use staff commands.

## AO. Issue Hosted Test

PASS in both journeys: required private reason, optional harmless normalized image, Driver attention state, staff visibility and reasoned resolution. Customer cannot read private issue evidence or receive the private reason in tracking. Issue reporting does not invent terminal failure/cancellation.

## AP. Customer Tracking Hosted Test

PASS in both journeys: existing authoritative progress reaches COMPLETED from Driver actions. Projection excludes Driver email, private issue text, staff notes, assignment history and coordinates. Commercial fields are compared before/after operational execution.

## AQ. Cleanup

After the three passing Phase 4 tests, an independent audit found zero disposable rows/objects across eighteen categories, including Auth users, private files, issues/photos, location events, mutation records and completed assignment attribution. SA/EG catalogue settings and two cities per Market were retained. After all prior-phase regressions, the independent eighteen-category audit again returned zero. The one positively identified Phase 4 automation credential was revoked; zero automation credentials remain. The revoked credential received HTTP 302 to deployment protection, and protection remains all_except_custom_domains. Required catalogue/schema data and the accepted Preview were retained.

## AR. Files Changed

- `.github/workflows/ci.yml`
- `README.md`
- `config/staging/supabase/config.toml`
- `docs/driver-execution.md`
- `docs/phase-4-driver-execution-gap-analysis.md`
- `docs/reports/Naql365-Phase-4-Report.md`
- `docs/roadmap.md`
- `docs/staging-smoke-test.md`
- `docs/staging.md`
- `next.config.ts`
- `playwright.phase4.config.ts`
- `playwright.staging.config.ts`
- `scripts/database-type-comparison.d.mts`
- `scripts/database-type-comparison.mjs`
- `scripts/generate-db-types.mjs`
- `scripts/staging/verify-database.mjs`
- `scripts/staging/verify-phase4.mjs`
- `scripts/test-driver-concurrency.mjs`
- `src/app/[locale]/(driver)/driver/login/page.tsx`
- `src/app/[locale]/(driver)/driver/page.tsx`
- `src/app/[locale]/(driver)/driver/trips/[id]/page.tsx`
- `src/app/[locale]/(portal)/portal/operations/trips/[id]/page.tsx`
- `src/app/api/driver/evidence/route.ts`
- `src/app/api/driver/issues/route.ts`
- `src/app/api/driver/route.ts`
- `src/app/api/operations/issues/route.ts`
- `src/app/auth/driver-actions.ts`
- `src/app/globals.css`
- `src/components/driver/access.tsx`
- `src/components/driver/execution.tsx`
- `src/components/driver/login.tsx`
- `src/components/driver/views.tsx`
- `src/components/operations/issues.tsx`
- `src/domain/driver/model.ts`
- `src/i18n/driver.ts`
- `src/infrastructure/driver/service.ts`
- `src/infrastructure/operations/service.ts`
- `src/infrastructure/requests/http.ts`
- `src/infrastructure/supabase/database.types.ts`
- `supabase/migrations/20260914000100_internal_driver_authority.sql`
- `supabase/migrations/20260914000200_shared_driver_execution.sql`
- `supabase/migrations/20260914000300_driver_projections_and_issues.sql`
- `supabase/migrations/20260914000400_driver_private_evidence.sql`
- `supabase/migrations/20260914000500_bounded_driver_projection.sql`
- `supabase/migrations/20260915000100_completed_driver_assignment.sql`
- `tests/e2e/driver.spec.ts`
- `tests/integration/driver-execution.test.ts`
- `tests/integration/driver-upgrade.test.ts`
- `tests/phase4/helpers.ts`
- `tests/phase4/journey.spec.ts`
- `tests/phase4/session.spec.ts`
- `tests/staging/safe-reporter.ts`
- `tests/unit/database-type-comparison.test.ts`
- `tests/unit/driver.test.ts`

## AS. Commits

- 022ae5d docs: analyze internal driver execution gaps before migrations
- b322588 feat(driver): extend authoritative execution and private issue evidence
- c2cff71 feat(driver): add localized internal execution portal and private evidence UI
- fd879c3 test(driver): verify private execution, populated upgrade and concurrent commands
- d7d8ea7 test(driver): prepare guarded SA and EG hosted execution acceptance
- db7aaaf fix(staging): compare schema types independently of hosted client metadata
- 19ecb65 fix(types): declare the database comparison script interface
- 92c4475 fix(driver): bind completed history to final assignment identity
- 3f1d8ae test(driver): verify touch ink and isolated external identity denial
- 4ed14c6 test(driver): cover hosted session revocation and signed URL lifetime
- 7460a91 test(driver): verify signed access with bounded expiry diagnostics
- 0228f56 test(staging): bound hosted journey timeouts and report durations

The final documentation commit is identifiable from this file history. The accepted Preview application source is `3f1d8ae169af3133b51ca05fba11ac410da46223`; later changes are verification/documentation only.

## AT. Known Limitations

Online-first; in-page retry intent is not a durable offline queue. Geolocation is optional device-reported evidence, not certified physical presence. Already-issued signed URLs remain usable until expiry. Ambiguous legacy completed-assignment attribution fails closed for Driver history; staff history is retained. No antivirus scanner, legal digital-signature certification, continuous location, new analytics provider or public Driver provisioning. Log review is bounded and automated accessibility is not certification.

## AU. Deferred Items

EXTERNAL login, OTP, continuous/background GPS, live maps, ETA, optimization, geofencing, offline sync, push/messaging automation, payments/refunds/settlement, marketplace/carrier onboarding/payroll, international freight, AI, Phase 5 and Production.

## AV. Acceptance Matrix

| Gate                      | Result | Evidence                                                                      |
| ------------------------- | ------ | ----------------------------------------------------------------------------- |
| Git baseline              | PASS   | Protected develop/main hashes retained                                        |
| Gap analysis              | PASS   | 022ae5d committed before migrations                                           |
| Driver identity           | PASS   | Database UUID mapping + hosted INTERNAL/EXTERNAL negatives                    |
| Internal Driver auth      | PASS   | Both journeys + bilingual session lifecycle                                   |
| External Driver exclusion | PASS   | Independent EXTERNAL profile constraint and login denial                      |
| DRIVER RBAC               | PASS   | Hosted role loss and staff/customer denial                                    |
| Driver RLS                | PASS   | Raw-table/RPC/tenant/Market negatives                                         |
| Today                     | PASS   | Both hosted Markets + IANA date-boundary unit test                            |
| Upcoming                  | PASS   | Both hosted future-Trip views                                                 |
| Completed                 | PASS   | Read-only hosted view + final-assignment regression                           |
| Trip details              | PASS   | Minimized projection + hosted privacy/axe                                     |
| Trip state machine        | PASS   | Shared authoritative commands; both journeys                                  |
| Stop state machine        | PASS   | Four Stops per Trip in both Markets                                           |
| Multi-stop dependencies   | PASS   | Database negatives and hosted valid order                                     |
| Assignment authority      | PASS   | Hosted active-assignment checks                                               |
| Emergency reassignment    | PASS   | Both hosted Markets + independent DB race                                     |
| Issue reporting           | PASS   | Private attention + staff resolution in both Markets                          |
| Optional issue photo      | PASS   | Normalized private image in both journeys                                     |
| Event geolocation         | PASS   | Denied permission continues; valid point captured; negative validation        |
| No live GPS               | PASS   | Single explicit capture; no watcher/poll/ETA                                  |
| POD                       | PASS   | Saudi touch/Egypt upload; one final POD; actor distinct                       |
| Trip completion           | PASS   | Stop/POD prerequisites and replay checks                                      |
| Aggregate Job completion  | PASS   | Trip 1 incomplete aggregate; final Trip completes                             |
| Customer tracking         | PASS   | Safe authoritative status; no private/coordinate leakage                      |
| SA execution journey      | PASS   | Hosted Saudi test PASS                                                        |
| EG execution journey      | PASS   | Hosted Egypt test PASS                                                        |
| Market isolation          | PASS   | SA/EG and other-organization negative cases                                   |
| Privacy                   | PASS   | Bounded projections and private signed files                                  |
| Concurrency               | PASS   | CI independent PostgreSQL connections; no skipped matrix                      |
| Security negatives        | PASS   | Local/CI + hosted negative paths                                              |
| AR/EN                     | PASS   | Both execution languages + bilingual session test                             |
| Mobile                    | PASS   | 390px, touch ink and overflow assertions                                      |
| Accessibility             | PASS   | Hosted axe, keyboard/labels/landmarks                                         |
| Migrations                | PASS   | 25; fresh CI + populated 19 upgrade + Staging apply                           |
| Generated types           | PASS   | Official CLI match; hosted-only version hint excluded                         |
| Hosted Preview            | PASS   | READY protected Preview; target null; Staging-only variables                  |
| Scope compliance          | PASS   | No main/Production/Phase 5 changes                                            |
| Regression                | PASS   | 22 prior-phase hosted tests plus 3 Phase 4 tests on accepted Preview          |
| CI                        | PASS   | 35098462779; final documentation delivery additionally requires exact-HEAD CI |
| Cleanup                   | PASS   | Final 18-category audit zero; temporary bypass revoked; catalogues retained   |

## AW. Final Decision

PHASE 4 PASS — READY FOR REVIEW

Ready for owner review after the exact final documentation HEAD passes CI. No merge or Production deployment is authorized by this report. Main/develop remain at the recorded baseline; Phase 5 has not started.
