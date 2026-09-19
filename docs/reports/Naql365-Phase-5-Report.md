# Naql365 — Phase 5: Live Tracking, GPS, ETA & In-App Notifications

## A. Starting State

Phase 4 protected squash merge accepted; 25 baseline migrations. Phase 5 work in progress, 2026-09-19. This checkpoint is not acceptance.

## B. Git Baseline

develop b5a6406b69a62bdc9c4d383433efea5b9da86b44; main 184ac2374a7e9611b4b265efc7dac21b57b7a2b1. Branch feature/phase-5-live-tracking-eta-notifications. Protected branches unchanged.

## C. Gap Analysis

docs/phase-5-live-tracking-gap-analysis.md committed as e9b53b0 before any migration.

## D. Tracking Architecture

Client-neutral publication RPC shared with the authenticated HTTP adapter. Private bounded samples/sessions, minimized public latest row, no commercial mutation. Two additive migrations; 27 total.

## E. Browser Capability/Limitation

Foreground collection only while visible and authorized; single watcher with Web Lock coordination, cleanup and restored visibility. Reliable OS-level screen-locked/background tracking is NOT guaranteed and remains future native capability. Hosted proof pending.

## F. Driver Authority

Active membership/DRIVER role, INTERNAL profile mapping, active assigned Trip and matching tenant/Market checked under the existing organization lock, before replay. Browser collection separately checks driver_trip authority, not just customer read access.

## G. Tracking Lifecycle

Start eligibility follows existing operational engine. Reassignment ends session and clears coordinates; terminal state clears coordinates and denies further publication. GPS never changes operational state.

## H. Location Publication Policy

Configuration: moving 30 seconds, stationary 180 seconds, speed >1.5m/s or displacement >= maximum of 25m and both accuracies. Observations are separate from publication.

## I. Movement/Stationary Logic

Pure unit-tested policy. Device values are not certified physical presence. Stale after 90 seconds even during the longer stationary heartbeat gap.

## J. Location Schema

trip_live_locations public minimized RLS row; private.trip_location_samples and private.trip_tracking_sessions. Existing event milestone coordinates are unchanged.

## K. Latest Location

Trip primary-key lookup and organization/Market active index; bounded 50-row projection. No history scan for customer position.

## L. Historical Retention

2,880 sample hard cap per Trip; guarded Staging setup configures 24 hours and ten-minute privileged prune batches up to 10,000. Guarded setup executed on Staging: pg_cron job naql365-staging-tracking-retention, every ten minutes, 24-hour retention. Production time retention remains unset.

## M. Validation

Coordinate/accuracy/speed/heading ranges, strict relationship-free payload, sample time within past120/future15 seconds. Server received time remains authoritative.

## N. Idempotency

Sample UUID and immutable intent replay only after current authority checks. Changed retry intent rejected; retention/time bounds prevent ancient replay becoming current.

## O. Out-of-Order Handling

Older/equal captured time cannot replace accepted latest point. Independent SQL connection harness passes newer-then-older and simultaneous rate-limited samples.

## P. Rate Protection

Database enforces moving/stationary interval irrespective of client tabs. Excess samples return THROTTLED without writing. No large JSON event accumulation.

## Q. Reassignment

Existing organization lock shared with Dispatcher commands. Independent connection CI proved old Driver denial and replacement acceptance; hosted proof pending.

## R. Realtime

Only minimized latest rows and owned notifications are in Postgres publication; INSERT/UPDATE only. Per-event RLS; client screens use bounded subscriptions plus authority revalidation. Actual hosted WebSocket proof pending.

## S. Customer Live Tracking

Own Order projection, safe status fallback, timestamp/freshness and unavailable ETA; no raw history/private issue or actor email. UI implemented, hosted proof pending.

## T. Operations Live Map

Bounded active list with Trip/Driver/server filtering and Market/freshness controls; no per-marker channel. Hosted proof pending.

## U. Map Provider

Controlled Staging OpenStreetMap raster viewport, visible attribution, normal origin Referer/cache, no bulk/offline prefetch. User disclosure before tile load. No approved paid provider credentials.

## V. ETA Provider Architecture

Separate EtaProvider port and refresh constants; unavailable adapter makes zero provider calls. Future real provider must demonstrate its independent cache/rate limits.

## W. ETA Actual Provider Status

Provider not configured / ETA unavailable. No provider-backed ETA PASS is claimed.

## X. Fresh/Stale Handling

LIVE, STALE at90s and UNAVAILABLE; no fabricated point or interpolation. Unit tests pass; hosted recovery pending.

## Y. Notifications

Existing notifications entity extended with safe event codes/read_at and recipient isolation. Actual Trip events emit customer start/completion and staff reassignment/issue/completion; no private reason/coordinates in payload.

## Z. Privacy

No location outside active assigned execution, no external Driver tracking, raw history private, map tile disclosure. No precise coordinates in analytics.

## AA. RLS

Staging SQL assertions pass with 57/57 public tables protected. Current-membership RLS isolates latest location and notifications; raw samples/sessions remain private. Local/CI tests reject direct writes, forged relationships, anonymous/customer/staff/unassigned publishers, role loss and suspension. Actual hosted subscription results are recorded below when the full suite completes.

## AB. Security

HTTP mutation requires same-origin SSR authentication; no client service-role key. Existing security headers remain, with only the exact Supabase WebSocket origin and OSM image origin added to CSP. Driver pages alone allow same-origin geolocation. No new dependency or credentials introduced; npm production dependency audit found zero vulnerabilities. Bounded hosted logs, deployed assets and final cleanup remain acceptance gates.

## AC. SA

Saudi resources use SA Market, SAR commercial snapshots and Asia/Riyadh scheduling. First corrected hosted Saudi journey passed in436464ms, including actual browser GPS and Realtime. Final suite/regression closeout pending.

## AD. EG

Egypt resources retain EG Market, EGP commercial snapshots and Africa/Cairo IANA timezone. Hosted execution pending completion; no Saudi default is used in tracking timestamps.

## AE. Timezones

Latest location and notification timestamps are rendered with each authoritative Market timezone through Intl.DateTimeFormat. Existing winter/summer, DST and Market date-boundary tests remain green. GPS ordering uses server receipt/device timestamp validation, not localized text.

## AF. Accessibility

Textual Trip status, next Stop, freshness, update time and unavailable ETA remain available without a map. Controls have labels and existing visible-focus styles. Automated axe checks run on authenticated Driver/customer/Operations pages at390px in both locales. These checks are bounded evidence, not full WCAG certification.

## AG. Performance

Latest-row lookup avoids history scans. Feed is capped at50 rows and bounded pagination; Operations filters run server-side. One bounded channel per view,30-second visibility-aware refresh, client freshness clock and no per-marker subscriptions. Map requests nine visible tiles after explicit disclosure; no bulk prefetch/offline cache.

## AH. Concurrency

CI35445015602 DB job105902336727 passed the retained independent-connection Operations and Driver matrices and the new tracking harness. Proven: duplicate location replay; newer point defeats delayed older point; simultaneous updates stay rate-limited; publication vs Dispatcher reassignment leaves only current Driver authority; twenty independent requests across two active Trips yield exactly two authoritative writes.

## AI. Tests

CI35445015602:131 unit/integration tests in26 files and24 browser E2E tests PASS; all SQL/RLS assertions, populated25→27 upgrade, fresh Supabase reconstruction, official generated-type exact diff, three independent concurrency harnesses, formatting, secrets, lint, strict types and production build PASS. First hosted attempt exposed an incompatible Web Locks option pair (`ifAvailable` plus `signal`), reproduced in Chromium as NotSupportedError; commit214b9a2 removed the unsupported pair without weakening authority. Corrected hosted suite and same-Preview regressions are in progress.

## AJ. CI

Source214b9a29a9082f4025a707e6de3f69f1e14364b1 passed [35444424511](https://github.com/Rmdn96/Naql365/actions/runs/35444424511) before deploying the corrected Preview. Tests/documentation checkpoint22115bed881502132675ae792c81f81ed0399576 passed [35445015602](https://github.com/Rmdn96/Naql365/actions/runs/35445015602). Final report commit exact-HEAD CI still required. Initial generated-type drift was corrected from official successful Supabase CLI output, not manual type edits.

## AK. Hosted Preview

Genuine protected Preview https://naql365-staging-foqvxnanr-naql365.vercel.app is READY on source214b9a29a9082f4025a707e6de3f69f1e14364b1; deployment dpl_EiBLoaEDa5WE5FUtgorC6fjUXPop, target null/Preview. Preview-only variables point to zuvyfeflkzlciuaauxba Staging; no Production variables/deployments. Auth uses this exact Site URL and four exact AR/EN callback/recovery allowlist URLs, no wildcard. Staging has27 migrations, matching official public types. Later test/documentation commits do not alter the deployed application.

## AL. Saudi Journey

Implementation/verification in progress; no acceptance claim yet.

## AM. Egypt Journey

Implementation/verification in progress; no acceptance claim yet.

## AN. Reassignment Test

Implementation/verification in progress; no acceptance claim yet.

## AO. Customer Isolation

Implementation/verification in progress; no acceptance claim yet.

## AP. ETA Test

Implementation/verification in progress; no acceptance claim yet.

## AQ. Notification Test

Implementation/verification in progress; no acceptance claim yet.

## AR. Native Readiness

docs/native-driver-location-contract.md documents Auth, payload, rate, replay, lifecycle and limits. No native application implemented.

## AS. Cleanup

Hosted fixtures and temporary Preview automation bypass are in use during acceptance. Scoped runner cleanup and final independent audit/revocation are required before acceptance.

## AT. Files Changed

Two additive migrations; generated public DB types; tracking domain/policy/provider port; server adapters; tracking/notification APIs; foreground collector; customer/Operations live views and OSM viewport; localized dictionaries/CSS/CSP integration; reused Driver hosted harness; local/hosted/concurrency/upgrade tests; CI step; guarded Staging retention command; native contract; gap analysis; README/security/testing/staging/roadmap and this report. No accepted migration was rewritten.

## AU. Commits

e9b53b0 gap analysis before migrations;361a749 database authority/notifications;9deba5a foreground views/types/native contract;969a58a filters and collector cleanup;concurrency checkpoint2033fc13a6e3dbaa9331c0867641918d4f1d1343;214b9a2 supported Web Lock fix;a2deaaa extended hosted revocation/history tests;22115be operating documentation and exact Auth origin. Final closeout commit recorded in Git and delivery response.

## AV. Known Limitations

Foreground online-first; device-reported location; bounded log/accessibility evidence only; provider-backed ETA unavailable; Production retention/provider readiness not approved.

## AW. Deferred Items

Native/background service, route replay, geofencing, automatic completion, optimization, external messaging, payments, marketplace, Phase 6 and Production.

## AX. Acceptance Matrix

| Gate                               | Result         | Evidence                                           |
| ---------------------------------- | -------------- | -------------------------------------------------- |
| Git baseline                       | PASS           | Exact protected baseline fetched                   |
| Gap analysis                       | PASS           | e9b53b0 before migrations                          |
| Local authority/upgrade            | PASS           | SQL integration and populated25 upgrade            |
| Concurrency                        | PASS           | Initial CI actual independent connections          |
| ETA provider                       | NOT CONFIGURED | Honest unavailable state; not provider-backed PASS |
| UI, Realtime, notifications hosted | PARTIAL        | Hosted suites prepared, not executed               |
| SA/EG hosted acceptance            | PARTIAL        | Not executed                                       |
| Final CI/security/regression       | PARTIAL        | Final gates pending                                |
| Cleanup                            | PARTIAL        | Final hosted audit pending                         |
| Scope compliance                   | PASS           | No main/Production/Phase6 changes                  |

## AY. Final Decision

PHASE 5 PARTIAL — NOT READY
