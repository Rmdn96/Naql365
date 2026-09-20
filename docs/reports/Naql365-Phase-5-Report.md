# Naql365 — Phase 5: Live Tracking, GPS, ETA & In-App Notifications

## A. Starting State

Phase 4 protected squash merge accepted; 25 baseline migrations. Phase 5 verification on 2026-09-19. The decision below is evidence-based; no merge or Production deployment is authorized.

## B. Git Baseline

develop b5a6406b69a62bdc9c4d383433efea5b9da86b44; main 184ac2374a7e9611b4b265efc7dac21b57b7a2b1. Branch feature/phase-5-live-tracking-eta-notifications. Protected branches unchanged.

## C. Gap Analysis

docs/phase-5-live-tracking-gap-analysis.md committed as e9b53b0 before any migration.

## D. Tracking Architecture

Client-neutral publication RPC shared with the authenticated HTTP adapter. Private bounded samples/sessions, minimized public latest row, no commercial mutation. Two additive migrations; 27 total.

## E. Browser Capability/Limitation

Foreground collection only while visible and authorized; single watcher with Web Lock coordination and cleanup on hidden/unmount/authority loss. Restored pages obtain the server publication checkpoint before collecting. Reliable OS-level screen-locked/background tracking is NOT guaranteed; it remains a future native capability.

## F. Driver Authority

Active membership/DRIVER role, INTERNAL profile mapping, active assigned Trip and matching tenant/Market checked under the existing organization lock, before replay. Browser collection separately checks driver_trip authority, not just customer read access.

## G. Tracking Lifecycle

Start eligibility follows existing operational engine. Reassignment ends session and clears coordinates; terminal state clears coordinates and denies further publication. GPS never changes operational state.

## H. Location Publication Policy

Configuration: moving 30 seconds, stationary 180 seconds, speed >1.5m/s or displacement >= maximum of 25m and both accuracies. Observations are separate from publication.

## I. Movement/Stationary Logic

Unit-tested policy separates observations from publication. At the stationary deadline, an uncached browser observation is requested; an unchanged old device timestamp is never fabricated into a new fix. The hosted SA test waits the real 180-second interval after page reload, confirms bounded requests, then supplies a fresh same-coordinate browser observation. Stale remains 90 seconds even during the longer stationary heartbeat gap. Device-reported values are not certified physical presence.

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

The existing organization lock is shared with Dispatcher commands. Independent connections prove old Driver denial/new Driver acceptance. Both hosted Market journeys prove current Driver replacement, retained assignment history, no old publication/subscription authority, replacement browser publication and unchanged commercial facts.

## R. Realtime

Only minimized latest rows and owned notifications are in the Postgres publication, INSERT/UPDATE only. Hosted real WebSocket subscriptions prove positive owner/Operations delivery and peer/cross-tenant/unassigned denial. The customer browser receives an actual postgres_changes frame on its tracking channel under deployed CSP. Suspending an already-subscribed owner suppresses subsequent delivery while Operations still receives it. No mocked transport substitutes for this evidence.

## S. Customer Live Tracking

Own Order projection provides position, textual status, update time/freshness and explicitly unavailable ETA. Hosted SA/EG customer mobile pages receive real transport updates, show stale/recovery and terminal removal, and exclude private operational content. Actual Customer A and Customer B each have distinct Trips and positive owned access; bilateral foreign reads, queries and subscriptions are denied.

## T. Operations Live Map

Authorized Operations sees bounded active Trips with named Trip/Driver filters and Market/freshness controls. Hosted SA/EG tests filter the active Trip, verify LIVE status, load attributed tiles and run axe. No global unbounded history or per-marker subscription exists.

## U. Map Provider

Controlled Staging OpenStreetMap raster viewport, visible attribution, normal origin Referer/cache, no bulk/offline prefetch. User disclosure before tile load. No approved paid provider credentials.

## V. ETA Provider Architecture

Separate EtaProvider port and refresh constants; unavailable adapter makes zero provider calls. Future real provider must demonstrate its independent cache/rate limits.

## W. ETA Actual Provider Status

Provider not configured / ETA unavailable. No provider-backed ETA PASS is claimed.

## X. Fresh/Stale Handling

LIVE, STALE after90 seconds and UNAVAILABLE are authoritative presentation states. Both hosted journeys exercise stale/recovery and terminal coordinate removal. No point interpolation or fabricated ETA is presented.

## Y. Notifications

Existing notifications entity extended with safe event codes/read_at and recipient isolation. Actual Trip events emit customer start/completion and staff reassignment/issue/completion; no private reason/coordinates in payload.

## Z. Privacy

No location outside active assigned execution, no external Driver tracking, raw history private, map tile disclosure. No precise coordinates in analytics.

## AA. RLS

Staging SQL assertions pass with57/57 public tables protected. Current membership RLS isolates latest location and notifications; raw samples/sessions are private. SQL/CI and hosted tests reject direct writes, forged relationships, anonymous/customer/Sales/unassigned/cross-tenant/cross-Market/External publishers and suspended membership. Actual hosted query and subscription negatives complement database assertions.

## AB. Security

Same-origin SSR mutation boundaries and server-only adapters remain enforced. CSP admits only the exact Supabase WebSocket origin and OSM tile image origin required here; Driver geolocation is same-origin. Hosted authenticated asset checks, headers, signed-private-file expiry and both Market security negatives pass. Bounded Vercel audit of this deployment over three hours sampled200 serverless records and separate error/5xx queries: zero observed5xx/error records, credential patterns or auth-query values. This is bounded evidence, not exhaustive logging certification. No new dependency or credential introduced; production dependency audit found zero vulnerabilities.

## AC. SA

Saudi hosted journey PASS in603757ms on the accepted Preview: SA resources, SAR preserved snapshots and Asia/Riyadh scheduling. Foreground GPS, actual180-second heartbeat, bilateral customer isolation, Realtime, notifications, maps, reassignment, four Stops/two Trips, issues/private POD and aggregate completion passed.

## AD. EG

Egypt hosted journey PASS in356479ms on the same Preview: EG resources, EGP preserved snapshots and Africa/Cairo IANA timezone. Foreground GPS, real Realtime, stale/recovery, notification ownership, reassignment, issues/private POD, two-Trip aggregate completion and customer-safe progression passed.

## AE. Timezones

Latest location and notification timestamps are rendered with each authoritative Market timezone through Intl.DateTimeFormat. Existing winter/summer, DST and Market date-boundary tests remain green. GPS ordering uses server receipt/device timestamp validation, not localized text.

## AF. Accessibility

Textual Trip status, next Stop, freshness, update time and unavailable ETA remain available without a map. Controls have labels and existing visible-focus styles. Automated axe checks run on authenticated Driver/customer/Operations pages at390px in both locales. These checks are bounded evidence, not full WCAG certification.

## AG. Performance

Latest-row lookup avoids history scans. Feed is capped at50 rows and bounded pagination; Operations filters run server-side. One bounded channel per view,30-second visibility-aware refresh, client freshness clock and no per-marker subscriptions. Map requests nine visible tiles after explicit disclosure; no bulk prefetch/offline cache.

## AH. Concurrency

Exact source CI35448026112, database job105910242190, passed independent-connection Operations, Driver and tracking harnesses. Operations covers Job/reference/resource/assignment/Stop/POD/aggregate races. Driver covers start/Stop/POD/issue replay, completion versus staff and reassignment. Tracking proves duplicate sample replay, newer-before-delayed-older, simultaneous rate limiting, publication versus reassignment with old denial/new acceptance, and twenty independent requests across two active Trips producing exactly two authoritative writes.

## AI. Tests

CI35450282073 passed135 unit/integration tests in27 files,24 local E2E tests, SQL/RLS, populated25-to27 upgrade, fresh reconstruction, official generated-type diff, all three independent-connection concurrency harnesses, formatting, secret scan, lint, strict types and build. Hosted acceptance totals25 distinct passing tests on the same Preview: Phase5 three, foundation12, intake6, commercial1 and Operations3. Operations SA/EG passed in288304ms/276603ms. Its asset test initially rejected the bare SDK discriminator startsWith("sb_secret_"); the actual deployed asset contained exactly one discriminator and no credential material. Commit9b751e6 corrects the detector with three negative unit tests while preserving exact privileged-credential comparisons and source-map checks. The asset-only rerun passed in8136ms. This is aggregated evidence from the full run plus that corrective rerun, not a claim that the original full invocation passed. No application or migration changed after the accepted deployment. Earlier fixes addressed Web Locks compatibility, restored GPS checkpoints and fresh stationary observations; test locator corrections did not weaken authorization.

## AJ. CI

Application source8c207416fc6112ea0bfcc67e080c42a565be02b1 passed [35447133389](https://github.com/Rmdn96/Naql365/actions/runs/35447133389). Final test source9b751e63ab430688093d93554032c1c49b9fbac7 passed [35450282073](https://github.com/Rmdn96/Naql365/actions/runs/35450282073), including both required jobs. Exact final documentation-commit CI is checked before delivery and identified in the final response; no runtime code changed in that commit.

## AK. Hosted Preview

[Protected Phase5 Preview](https://naql365-staging-ae5odrrwr-naql365.vercel.app), deployment dpl_APeu1MCGady6bRPXBA6MRfq1RHZu, is READY with target null (genuine Preview), application source8c207416fc6112ea0bfcc67e080c42a565be02b1. Later changes are hosted tests, exact Auth configuration and documentation only. Preview-scoped NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, APP_ENV and STAGING_AUTH_SMOKE_ENABLED point only to Supabase Staging. No Production-scoped variables/deployments exist. Auth has the exact Preview Site URL and four exact AR/EN callback/recovery allowlist URLs, no wildcard. Supabase Staging has27 applied migrations and matching official public types.

## AL. Saudi Journey

Final hosted source352da1d, application source8c207416, accepted Previewae5odrrwr:603757ms PASS. Includes a real second customer Trip for bilateral isolation and real elapsed180-second stationary heartbeat after page reload. Fresh same-coordinate browser observation accepted; unchanged stale browser fix not republished. These are synthetic browser/device tests, not a physical road trial.

## AM. Egypt Journey

Same Preview,356479ms PASS. Full EG execution plus tracking/notifications/Realtime, private evidence, authenticated mobile accessibility and retained commercial snapshots. Supplemental AR/EN session expiry, revocation and keyboard login test passed in39447ms.

## AN. Reassignment Test

Both Markets pass Driver A-to-B emergency reassignment: Dispatcher remains authoritative, history retained, A loses publication/execution authority, B publishes through the browser and commercial facts stay unchanged. Independent-connection publication/reassignment race also passes.

## AO. Customer Isolation

Customer A and B each own an actual separate accepted Order/Job/Trip. B receives its real positive owned update; A cannot query/read/subscribe B. A receives its positive update; B cannot query/read/subscribe A. Other tenant and unassigned Driver are also denied. Existing socket loses delivery under membership suspension. Notification ownership has matching negative checks.

## AP. ETA Test

Provider not configured / ETA unavailable. Both Market customer pages explicitly show unavailable ETA. EtaProvider boundary and refresh constants exist; no routing credentials, fake provider result, distance-derived invented ETA or claim of provider-backed acceptance.

## AQ. Notification Test

Actual authoritative events produce owned start/completion notifications. Customer read-state UI updates the current Trip notification and persists it; peer cannot read another customer notification. Real event subscriptions deliver to owner and deny peer. Operations notifications use bounded safe codes rather than private issue text or coordinates.

## AR. Native Readiness

docs/native-driver-location-contract.md documents Auth, payload, rate, replay, lifecycle and limits. No native application implemented.

## AS. Cleanup

Independent Staging audit on2026-09-20 found zero rows in22 disposable categories: Requests, Quotes/Versions, Orders, Jobs, Trips/POD, assignments, Drivers/Vehicles, file objects, issues/photos, event/latest locations, notifications, private tracking sessions/samples, completed assignments, Driver mutations, Auth users and Storage objects. Intended SA/EG Markets, currencies/timezones and two cities each remain. One owned temporary Preview automation credential was revoked; zero remain, and the revoked credential receives302 protection. Accepted Preview retained; no Production cleanup or modification.

## AT. Files Changed

Two additive migrations; generated public DB types; tracking domain/policy/provider port; server adapters; tracking/notification APIs; foreground collector; customer/Operations live views and OSM viewport; localized dictionaries/CSS/CSP integration; reused Driver hosted harness; local/hosted/concurrency/upgrade tests; CI step; guarded Staging retention command; native contract; gap analysis; README/security/testing/staging/roadmap and this report. No accepted migration was rewritten.

## AU. Commits

e9b53b0 gap analysis before migrations;361a749 database authority/notifications;9deba5a foreground views/types/native contract;969a58a filters/collector cleanup;2033fc1 independent publication burst;214b9a2 supported Web Locks; a2deaaa subscription revocation/history coverage;22115be operating documentation;6ddb5a2 fresh heartbeat observation;fad9f97 evidence checkpoint;7dc37a9 formatting;5d93ff6 bilateral browser isolation;35b3446 restored observation handling;db87500 actual tracking-channel WebSocket assertion;8c20741 server publication checkpoint/backoff;181c2d9 current-Trip notification test;352da1d scoped LIVE assertion;9b751e6 distinguishes SDK discriminator from credential material. The final report commit is identified in Git and the delivery response.

## AV. Known Limitations

Foreground online-first; device-reported location; bounded log/accessibility evidence only; provider-backed ETA unavailable; Production retention/provider readiness not approved.

## AW. Deferred Items

Native/background service, route replay, geofencing, automatic completion, optimization, external messaging, payments, marketplace, Phase 6 and Production.

## AX. Acceptance Matrix

| Gate                   | Result         | Evidence                                                                          |
| ---------------------- | -------------- | --------------------------------------------------------------------------------- |
| Git baseline           | PASS           | Exact protected develop b5a6406; main unchanged                                   |
| Gap analysis           | PASS           | e9b53b0 precedes migrations                                                       |
| Tracking lifecycle     | PASS           | Both Markets start/reassign/complete; terminal coordinates removed                |
| Driver authority       | PASS           | Current INTERNAL assignment, membership, role, profile, tenant and Market checked |
| Foreground GPS         | PASS           | Actual Chromium geolocation to hosted API in SA/EG                                |
| Browser limitation     | PASS           | Foreground only; no guaranteed locked/background GPS                              |
| Moving rate            | PASS           | Configured 30 seconds; SQL and independent connection rate tests                  |
| Stationary heartbeat   | PASS           | Real 180 seconds, restored checkpoint, fresh same-coordinate observation          |
| Latest location        | PASS           | One latest row per Trip; bounded 50-row feed                                      |
| History/retention      | PASS           | Private 2880-sample cap; Staging 24h cron last run succeeded                      |
| Validation             | PASS           | Strict payload, coordinates/time/accuracy tests                                   |
| Idempotency            | PASS           | Immutable sample UUID replay under current authority                              |
| Out-of-order handling  | PASS           | Older sample denied; browser backoff and authority refresh                        |
| Rate protection        | PASS           | 20 independent requests across two Trips yield two writes                         |
| Reassignment           | PASS           | Both hosted Markets and independent publication/reassignment race                 |
| Realtime               | PASS           | Actual tracking WebSocket postgres_changes under deployed CSP                     |
| Customer live tracking | PASS           | Both Market mobile pages, status/map/stale/terminal states                        |
| Operations live map    | PASS           | Authorized bounded feed, Trip/Driver/Market/freshness filters                     |
| Customer isolation     | PASS           | Two actual customer Trips: bilateral reads/queries/subscriptions denied           |
| Map provider           | PASS           | OpenStreetMap tiles loaded with disclosure and attribution                        |
| ETA architecture       | PASS           | Provider port plus honest unavailable adapter                                     |
| Fresh/stale            | PASS           | 90-second stale/recovery; no interpolation                                        |
| In-app notifications   | PASS           | Authoritative events, owner delivery/read and peer denial                         |
| Privacy                | PASS           | No private history/issues/email in customer feed or notification payload          |
| SA journey             | PASS           | 603757ms hosted PASS                                                              |
| EG journey             | PASS           | 356479ms hosted PASS                                                              |
| Market isolation       | PASS           | SA/EG and cross-tenant unauthorized publishers denied                             |
| RLS                    | PASS           | 57/57 public tables; actual query/subscription negatives                          |
| Security negatives     | PASS           | Hosted, SQL, same-origin SSR, assets/private files and suspension                 |
| Concurrency            | PASS           | Three real independent-connection harnesses in CI35448026112                      |
| AR/EN                  | PASS           | Both hosted journeys and bilingual session test                                   |
| Mobile                 | PASS           | 390px authenticated tracking and retained execution journeys                      |
| Accessibility          | PASS           | Authenticated axe checks, labels, textual fallback and keyboard login             |
| Migrations             | PASS           | 27 total; fresh reconstruction and populated25 upgrade                            |
| Generated types        | PASS           | Official Supabase generation and exact public-type diff                           |
| CI                     | PASS           | Test source9b751e6 CI35450282073 PASS; final report CI recorded in delivery       |
| Hosted Preview         | PASS           | ae5odrrwr READY, true Preview, protected, Staging-only                            |
| Native readiness       | PASS           | Client-neutral RPC/HTTP contract documented; no native app                        |
| Scope compliance       | PASS           | No merge/main/Production/Phase6; commercial facts unchanged                       |
| ETA provider status    | NOT CONFIGURED | Provider not configured / ETA unavailable; no external result claimed             |
| Regression             | PASS           | 22 distinct hosted regression tests; corrected asset-only rerun documented in AI  |
| Cleanup                | PASS           | 22 categories zero; catalogues retained; bypass revoked and denied                |

## AY. Final Decision

PHASE 5 PASS — READY FOR REVIEW

All critical implementation/hosted acceptance gates have passing evidence. ETA provider remains not configured / ETA unavailable as explicitly permitted; no external ETA integration is claimed. Final documentation HEAD must pass CI before delivery. No merge, Production deployment or Phase6 work performed.
