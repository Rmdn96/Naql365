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

Implementation/verification in progress; no acceptance claim yet.

## AB. Security

Implementation/verification in progress; no acceptance claim yet.

## AC. SA

Implementation/verification in progress; no acceptance claim yet.

## AD. EG

Implementation/verification in progress; no acceptance claim yet.

## AE. Timezones

Implementation/verification in progress; no acceptance claim yet.

## AF. Accessibility

Implementation/verification in progress; no acceptance claim yet.

## AG. Performance

Implementation/verification in progress; no acceptance claim yet.

## AH. Concurrency

Initial CI35442511358 passed all three independent-connection harnesses. Overall run failed only generated-type drift; authoritative types from successful run35442511328 have now been imported. Final CI remains pending.

First hosted attempt exposed an incompatible Web Locks option pair (`ifAvailable` plus `signal`), reproduced independently in Chromium as `NotSupportedError`. The collector now uses non-blocking acquisition alone; disposal and lock-release guards remain. No authorization or database policy was weakened. Hosted rerun is required.

## AI. Tests

Local unit/integration, populated25 upgrade and24 browser regressions have run. More hosted and negative coverage pending; no hosted gate marked PASS.

## AJ. CI

Source 2033fc13a6e3dbaa9331c0867641918d4f1d1343 passed CI35443506478 (both required jobs). Initial generated-type mismatch corrected using official CLI output, not hand-edited types. Final documentation/test commit CI remains pending.

## AK. Hosted Preview

Protected genuine Preview https://naql365-staging-ukhl750e0-naql365.vercel.app is READY on source2033fc13a6e3dbaa9331c0867641918d4f1d1343 (deployment dpl_HKfxhK92m2XHDrdpy1k2TQArsJz5, target null/Preview). Staging has27 migrations; 57/57 public tables have RLS and official generated types match. Auth uses four exact callback URLs, no wildcard. No Production changes.

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

Implementation/verification in progress; no acceptance claim yet.

## AU. Commits

e9b53b0 gap analysis; 361a749 location authority/notifications/initial tests. Subsequent UI and hosted verification work pending commit.

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
