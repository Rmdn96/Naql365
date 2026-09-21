# Native Driver location contract

Phase 5 implements the client-neutral backend and foreground web client. No native application or guaranteed screen-locked/background service is implemented.

## Authentication and authority

A future native client uses Supabase Auth's supported email/password/session lifecycle and its own secure session storage. Send the user access token to the Supabase `publish_trip_location` RPC; never embed a service-role credential. The browser uses same-origin `POST /api/tracking` with SSR cookies and Origin validation. The HTTP adapter calls the same RPC. Native clients do not bypass or disable browser CSRF protection.

The database derives actor, INTERNAL Driver resource, tenant, Market and current execution-active assignment. Active membership, actual DRIVER role and active Market are required at every publication and before retry replay. Source labels confer no authority. EXTERNAL resources cannot publish.

## Payload

RPC: `publish_trip_location(p_trip, p_sample, p_location)`.

- `p_trip`: assigned Trip UUID.
- `p_sample`: random UUID, retained with exactly the same payload for transport retries.
- `p_location`: `latitude` (-90..90), `longitude` (-180..180), `accuracy` metres (0..1000), optional nullable `speed` metres/second (0..100), optional nullable `heading` degrees [0,360), ISO `capturedAt`, `clientType` WEB or NATIVE.
- HTTP equivalent: `{tripId, sampleId, location}`.
- No driver/organization/Market/customer fields are accepted.
- Altitude is intentionally omitted: no accepted Phase 5 feature needs it.

Server `received_at` is separate from device `capturedAt`. Samples older than 120 seconds or more than 15 seconds ahead are rejected by the initial configurable policy. No durable offline backlog is accepted. Device location is not proof of physical presence.

## Ordering, idempotency and rate

Read `tracking_policy()` for validated settings. Moving: 30 seconds; stationary: 180 seconds; speed >1.5m/s or displacement at least the maximum of 25m and both point accuracies. Observations may be more frequent than publications. If the watch supplies no fresh fix at the stationary deadline, the foreground client requests one uncached observation; it never rewrites an old fix timestamp. Select the latest valid observation rather than uploading every callback.

The server serializes with staff reassignment and enforces rate independently of device timers/tab coordination. Returns ACCEPTED or REPLAY with server receipt time, THROTTLED with retryAt, or OUT_OF_ORDER. Older/equal captured timestamps cannot replace a newer accepted point. Reusing a sample UUID with changed facts is rejected. Discard expired pending samples and obtain a fresh observation. Retry identity is bounded by retention; an expired old sample cannot become current again.

## Lifecycle and privacy

Eligible only after actual Trip start and before COMPLETED/CANCELLED/FAILED. Start session evidence on first accepted sample. Reassignment ends the prior session and clears the latest point; the old Driver's next request fails, replacement can publish. Terminal state ends tracking and clears coordinates. GPS cannot change Trip/Stop state or complete delivery. Existing execution and POD remain usable without GPS.

Foreground web watchers stop on hidden page/unmount/logout or denied authority, with safe restoration when visible and eligible. A Web Lock reduces duplicate browser publishers; database rules remain authoritative without it. Native/background services need separate owner authorization, OS-specific consent, lifecycle and acceptance testing.

Customer/Operations subscriptions see only minimized latest rows through RLS; private raw history is not published. Inactive rows contain no coordinates. UI revalidates authority, clears hidden/denied views and shows freshness. Stale after 90 seconds, including a stationary gap before its 180-second heartbeat. No false always-live claim.

## Retention and providers

Hard cap: 2,880 samples per Trip. Staging retention is explicitly configured to 24 hours by the guarded Staging setup; the privileged bounded prune operation is scheduled separately. Production time-based retention remains unset. No precise location goes to analytics or general audit payloads.

Map rendering and ETA are independent interfaces. Controlled Staging may load attributed OSM tiles after disclosure; no offline/prefetching. ETA provider is unconfigured and returns unavailable. The future ETA refresh policy is separate from GPS: minimum 300 seconds, 500m movement/next-Stop changes, maximum 600-second validity; a real provider and tests are required before claiming an ETA.

Browser acquisition semantics: [MDN watchPosition](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/watchPosition) and [fresh getCurrentPosition options](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation/getCurrentPosition).
