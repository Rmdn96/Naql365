# Internal Driver execution

Phase 4 extends the Phase 3 execution engine; it does not introduce a second operational state machine. INTERNAL Drivers use `/{locale}/driver/login` with email/password. EXTERNAL resources remain non-authenticated and staff-operated.

## Trusted account provisioning

Provision accounts through the existing privileged Supabase Auth/admin process. Do not enable a public Driver signup or trust Auth metadata. Use the verified Auth UUID, not a lookup rule based on email text.

1. In the intended environment, create/invite the controlled Auth identity using trusted administration. Complete the existing secure password setup/recovery flow. Never commit credentials or provision via client metadata.
2. Create the INTERNAL operational resource in the correct organization and Market through authorized Operations. Confirm its active status and branch compatibility.
3. A trusted administrator creates the profile's active `driver` organization membership, assigns the existing `DRIVER` role through `user_roles`, and links that resource's `profile_id` to the verified profile UUID, in a transaction. Existing membership-type and identity constraints apply. The organization/profile uniqueness constraint permits one resource in that organization; different organizational contexts are explicit.
4. Sign in at the Driver login route. `driver_identity()` must return the intended resource. An EXTERNAL resource never qualifies, including if a future data repair accidentally introduces a profile link.
5. Suspend membership or revoke DRIVER authorization to remove access. Deactivating the resource or its Market also removes execution access. Never modify role catalogues to enroll one individual.

The application has no service-role key and no public provisioning endpoint. Dashboard/admin access is required for lifecycle administration, as in the accepted foundation.

## Authority and privacy

Each command checks authenticated profile, active driver-category membership, DRIVER role and permission, active INTERNAL resource, active assignment, organization and Market under the shared organization lock. The database rechecks authority before idempotent replay; an old Driver cannot replay a mutation after reassignment away.

Driver reads use fixed projections. Raw Trips, Stops, assignment history, staff events, customers, Requests and commercial tables remain unavailable. Only execution contact/address and explicitly driver-visible instructions are returned for live assignments. Staff notes are not copied. Completed Trips are attributed to the final assignment and omit contact/address/private issues. Completed history is paginated in groups of twenty; issue presentation is capped at fifty, while the independent attention flag includes every OPEN issue.

Today uses Market-local date and includes unfinished overdue/unscheduled Trips. Upcoming uses the same IANA Market timezone. Existing READY execution rules remain authoritative; no new future-date prohibition was invented.

## Commands, retries and issues

The Driver adapter accepts only dispatch/start, arrive, start service, complete Stop, depart and complete Trip. The accepted Phase 3 order/dependency checks, revisions, active resource conflicts, final POD and aggregate Job/Order completion remain unchanged. Assignment/reassignment/Vehicle changes are staff-only.

The current page retains each request's mutation ID and immutable retry intent. Unconfirmed network responses do not show success. Explicit refresh reloads authoritative state; Phase 4 has no durable offline outbox. Users should inspect that state before beginning a new request after a page reload.

Issues use the existing `issues` entity, with bounded category, mandatory reason and separate optional image. An OPEN issue creates attention and blocks Driver progression without terminal failure/cancellation. Authorized Dispatch resolves it with a reason; resolution does not invent refund/rescheduling rules. Operations can still use accepted staff commands according to existing permissions.

## Evidence

Arrival and final POD support optional one-shot browser location. Denial/unavailability continues without location. Typed location rows bind coordinates, timestamp and actor to the event created in the same transaction. No watch/poll/background tracking, maps, ETA or location analytics exist.

POD uses the existing one-per-Trip reservation and finalization flow. Actor is the authenticated Driver; recipient is separate. Touch drawing and an accessible signature image upload are supported. Image bytes are decoded and re-encoded, with PNG/JPEG input, 2 MiB limit and eight-megapixel decode bound. No legal certification or malware-scanning claim is made.

`pod-files` and `issue-files` are private. Signed URLs expire after sixty seconds when requested through the app. Already-issued URLs are bearer capabilities until expiry; assignment removal immediately stops new reads/URLs/commands but does not revoke a previously issued URL early. Final POD and event evidence are immutable. Staff can clear incomplete reservations using the existing reservation abort/remove/finish protocol; final evidence cannot be cleared this way.

## Verification and Staging

Run `npm run test:unit`, `npm run test:e2e`, formatting/lint/typecheck/build and secret scan. The CI database job reconstructs all migrations, runs SQL/RLS and both independent-connection scripts. `scripts/test-driver-concurrency.mjs` only accepts the named local Supabase container; it never accepts a cloud URL.

The committed database types come from the pinned Supabase CLI's local workflow. Hosted comparison must match all public schema declarations exactly. It excludes only the optional hosted `__InternalSupabase.PostgrestVersion` client hint, which local CLI generation does not emit; a unit test proves real schema changes still fail comparison.

`scripts/staging/verify-phase4.mjs` requires explicit Staging project/org, verified Preview origin and an in-memory protection bypass. It creates disposable identities, runs `playwright.phase4.config.ts`, and cleans their scoped data/files in `finally`. Never run overlapping hosted fixture suites. Test credentials remain only in process memory/environment, with screenshots/traces/video disabled and a safe reporter. The Preview must point to Supabase Staging, never Production.

The canonical [Phase 4 report](reports/Naql365-Phase-4-Report.md) records actual execution and cleanup evidence. Phase 5, merging and Production remain outside authorization.
