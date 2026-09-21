# Phase 5 live tracking gap analysis

Date: 2026-09-19. Baseline: b5a6406b69a62bdc9c4d383433efea5b9da86b44. Main remains 184ac2374a7e9611b4b265efc7dac21b57b7a2b1. Clean checkout; feature/phase-5-live-tracking-eta-notifications created from fetched protected develop. Both required checks, independent review, last-push approval, stale dismissal and administrator enforcement remain enabled.

## Existing foundation and gaps

The 25-migration inventory below spans identity/membership/RBAC, request validation/private uploads, exact commercial snapshots, operational state machines, SA/EG resource constraints and internal Driver execution. Generated public types match this accepted baseline. No live-location entity, publication command, Realtime publication, read/unread notification lifecycle or map/ETA adapter exists.

- Identity: private.internal_driver derives an active INTERNAL resource from auth.uid(), active driver-category membership, actual DRIVER role and active Market. EXTERNAL resources cannot have a profile. Reuse this boundary.
- Assignment: private.driver_trip_access checks matching organization/Market, current assignment and Vehicle. Driver mutations and staff reassignment serialize on organization advisory lock namespace 34. GPS must share this lock for reassignment correctness; keep transactions small and measure contention rather than claim unlimited scale.
- Lifecycle: trips.started_at plus nonterminal state distinguishes actual execution from READY. Existing explicit engine, Stop dependencies, one final POD, completed assignment history and commercial immutability must not change. GPS never changes operational status.
- Event geolocation: trip_event_locations is immutable ARRIVE/POD evidence with audit-only reads. It is unsuitable for mutable latest position or high-frequency history; retain it unchanged.
- Customer projection: customer_order_progress returns status-only progress after owns_customer/account.access checks. Add a separate authorized live projection, retaining the fallback and excluding private issues/history/Driver identity.
- Operations: existing organization-scoped operations.manage/dispatch.manage permissions include both Markets. There is no narrower staff Market grant model; filters narrow authorized data, never expand it. Driver execution remains resource-Market constrained.
- Notifications: existing notifications has recipient membership FK, idempotency key and self-read RLS; no payload/read timestamp. Extend it with safe event codes, Trip/Market references and read_at. Emit from actual operational events, never raw GPS callbacks. Reuse the channel-ready domain port, deliver in-app only.
- Browser: existing Driver route permits geolocation=(self); public routes deny it. Supabase SSR/browser clients already exist. A foreground watcher must select samples independently of network publication, stop on hidden/unmount/session loss and recheck authority. No overlapping watchers/offline queue.
- Staging audit: only Preview-scoped NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, APP_ENV and STAGING_AUTH_SMOKE_ENABLED exist. Zero Production deployments/scoped variables. No approved routing/map provider credential is configured. Do not obtain one. ETA will explicitly be unavailable.

## Proposed additive boundaries

Separate bounded private location samples from a minimized public latest-location row with RLS. Derive all tenant/Market/actor/assignment relationships on the server. Use a client-neutral typed payload, mutation UUID, captured timestamp and server receive timestamp. Reject malformed/range/time/identity fields; authorize before replay. Current assignment changes clear current coordinates; completion clears coordinates and rejects future publication. Do not publish private sample history through Realtime.

Use Supabase Postgres Changes for INSERT/UPDATE only on minimized latest rows and owned notifications, with per-event RLS. Subscribe once per bounded screen, never one channel per marker. Use a coordinate-free authorization/lifecycle refresh to clear already-rendered positions on revocation; Realtime RLS alone cannot erase data already delivered. Do not subscribe to DELETE or rely on DELETE authorization. Test actual two-client hosted subscriptions, including negative recipients and suspension.

Configurable defaults: moving publication 30 seconds; stationary heartbeat 180 seconds; moving threshold speed >1.5m/s or displacement >=25m; stale after 90 seconds. Stationary points can intentionally be labelled stale before heartbeat; never falsely label them live. Initial technical timestamp bound: at most 120 seconds old / 15 seconds future. Server rate limit applies regardless of tabs. History uses a Staging-only 24-hour retention setting plus hard per-Trip cap and bounded privileged pruning; Production retention is unset and cannot be inferred from Staging. Replay records are bounded with samples; expired samples cannot re-enter because timestamp validation rejects them.

Map renderer and ETA provider are separate ports. Use an attributed, bounded OpenStreetMap raster viewport for controlled Staging only, browser HTTP caching and normal origin Referer, no prefetch/offline/bulk downloads or personal query parameters. Tile requests disclose approximate viewport and IP to the provider; explain this before loading map tiles and retain accessible textual tracking. No geocoding or guessed destination coordinate. ETA adapter returns unavailable when unconfigured; future provider refresh has independent cache/rate policy, not every GPS update. No Production provider-readiness claim.

Notifications initially cover authoritative Trip started/completed for customer and reassignment/issue/completion for authorized Operations/Dispatch. Use bounded safe template codes, never issue reason, coordinates, actor email or generic JSON dumps. Deduplicate by event+recipient. Do not introduce speculative arrival/ETA or cancellation messaging.

## Browser and future native contract

A. Foreground web tracking can publish device observations while the page is visible, permission granted, session/assignment active and network available. Acceptance demonstrates this flow and server rejection paths; it does not certify physical presence.

B. Screen lock, hidden/suspended tabs, browser termination, battery restrictions and GPS/network denial can stop updates. UI shows last trusted time and LIVE/STALE/UNAVAILABLE; operational commands/POD remain usable without GPS. No interpolation, background guarantee or employee-day surveillance.

C. A future Capacitor/native client will send the same authenticated location RPC/HTTP contract with Trip, sample UUID, captured_at and coordinates. Authority, replay/rate/time checks remain database-owned. Native background permission/service implementation is explicitly deferred; browser source labels never grant extra authority.

## Verification before acceptance

Fresh reconstruction and populated upgrade from all 25 migrations; preserve commercial/operational history and types. Unit clocks/publication selection, SQL/RLS security negatives, independent connections for reassignment and simultaneous/duplicate/out-of-order samples, bounded multi-Trip load, hosted SA and EG on one protected Preview, real customer/Operations Realtime delivery and denial, read/unread notification isolation, mobile/AR/EN/axe, logs/bundles, full prior-phase regression. Clean synthetic identities, samples/latest rows/notifications and revoke temporary bypass credentials. No gate passes from implementation alone.

## Migration inventory

- `20260909000100_identity_and_domain.sql`: create schema if not exists private;
- `20260909000200_private_storage.sql`: insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
- `20260909000300_role_integrity_indexes.sql`: create index user_roles_role_idx on public.user_roles(role_id);
- `20260910000100_customer_request_intake.sql`: alter table public.profiles add column phone text check(phone ~ '^\+[1-9][0-9]{7,14}$');
- `20260910000200_storage_upload_completion_guard.sql`: create or replace function private.can_upload_request_image(bucket text,path text,object_metadata jsonb) returns boolean
- `20260910000300_request_revision_conflict.sql`: create or replace function public.request_command(p_operation text, p_request_id uuid, p_revision integer, p_mutation_id uuid, p_p
- `20260910000400_pricing_quote_schema.sql`: create table public.vehicle_pricing_classes (
- `20260910000500_pricing_quote_commands.sql`: create function private.commercial_event(tenant uuid, event text, entity_type text, entity uuid, details jsonb default '{}'::jsonb
- `20260910000600_pricing_quote_rls.sql`: insert into public.permissions(code) values('pricing.calculate'),('quotes.manage') on conflict(code) do nothing;
- `20260910000700_persist_quote_expiry.sql`: create or replace function public.respond_to_quote(
- `20260912000100_operations_schema.sql`: alter table public.drivers alter column profile_id drop not null;
- `20260912000200_operations_commands.sql`: create function private.next_operational_reference(p_kind text) returns text
- `20260912000300_pod_and_tracking.sql`: create function public.trip_pod_command(p_trip_id uuid,p_file_id uuid,p_action text,p_recipient text default null,p_mime text defa
- `20260913000100_market_foundation.sql`: create table public.markets (
- `20260913000200_market_commands.sql`: create or replace function public.request_command(p_operation text, p_request_id uuid, p_revision integer, p_mutation_id uuid, p_p
- `20260913000300_market_snapshot_guards.sql`: create function private.freeze_sent_tax() returns trigger language plpgsql set search_path='' as $$
- `20260913000400_market_relationship_metadata.sql`: do $$ declare r record; begin
- `20260913000500_market_tracking_projection.sql`: create or replace function public.customer_order_progress(p_order_id uuid) returns jsonb
- `20260913000600_initial_market_geography.sql`: create function private.provision_initial_market_catalogue(p_organization_id uuid) returns void
- `20260914000100_internal_driver_authority.sql`: alter table public.trip_stops add column driver_instructions text not null default '' check(length(driver_instructions)<=1000);
- `20260914000200_shared_driver_execution.sql`: create or replace function private.operational_event(p_org uuid,p_trip uuid,p_action text,p_stop uuid default null,p_facts jsonb d
- `20260914000300_driver_projections_and_issues.sql`: create table private.driver_mutations(
- `20260914000400_driver_private_evidence.sql`: insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('issue-files','issue-files',false,2097152,ar
- `20260914000500_bounded_driver_projection.sql`: create or replace function public.driver_trip(p_trip uuid) returns jsonb language plpgsql stable security definer set search_path=
- `20260915000100_completed_driver_assignment.sql`: create table private.completed_trip_assignments (

## Sources checked

- https://supabase.com/docs/guides/realtime/postgres-changes — per-subscriber RLS and throughput tradeoff; DELETE limitations.
- https://supabase.com/docs/guides/realtime/authorization — Broadcast authorization differs from Postgres Changes.
- https://operations.osmfoundation.org/policies/tiles/ — attribution, normal Referer, HTTP cache and no bulk/offline prefetch.

No unresolved owner-level decision blocks this design. Missing ETA credentials has an explicitly approved unavailable fallback. Commit this analysis before creating migrations. Phase 6/main/Production remain excluded.
