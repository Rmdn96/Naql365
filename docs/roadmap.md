# Phase boundaries

## Phase 0 — Foundation

Repository audit; compatible stack and strict typing; modular server/domain/data boundaries; ar/en routing and translation; accessible public/auth/protected shells; design tokens and primitives; Supabase SSR clients and PKCE callback; relational organization membership/RBAC; default-deny RLS; private file registry/storage; audit triggers; typed pricing/notification/payment ports; migrations; tests; CI; documentation.

At the Phase 0 checkpoint, no operational feature was complete or presented as available. Tables and interfaces establish relationships and extension points only.

## Accepted baseline: Phase 1 — Customer identity and request intake MVP

The owner authorized Phase 1 after accepted Staging closeout and the independent approval required to integrate PR #1 into develop. The implementation adds customer registration/sign-in/recovery, confirmed onboarding, persisted draft intake, private images, atomic submission and customer list/detail. Schema-gap decisions preceded migrations. Final acceptance depends on the Phase 1 report's evidence; implementation alone does not establish PASS. Malware scanning remains an explicit limitation, not a claimed feature.

## Accepted baseline: Phase 2 — Smart Quote and pricing foundation

Phase 2 was separately authorized from accepted develop `4d3b25730e3b604882a860ade414f98fd888766b`. It adds server-authoritative pricing, owner-approved MANUAL_VERIFIED distance, Sales review, immutable quote versions and exactly-one Order acceptance. Acceptance is recorded in the Phase 2 report; protected PR #3 integrated it into develop.

## Accepted baseline: Phase 3 — Operations, multi-Trip dispatch and POD

Phase 3 was separately authorized from accepted develop `86ba612a5f6f7f4afd7a5c0650d5b4d3848f2b6f`. It adds one operational Job per accepted Order, multiple Trips and ordered Stops, independent Driver/Vehicle assignment, conflicts and emergency reassignment, private POD, derived completion and safe customer tracking. The canonical Phase 3 report determines acceptance. Phase 3 was subsequently merged through protected review.

## Accepted baseline: Phase 3.5 — Saudi Arabia and Egypt

Protected develop `167f2caba4685e71c44d19b20423115acf0100da` contains nineteen migrations and the accepted SA/EG Market foundation, market-scoped resources, currencies and IANA scheduling.

## Accepted baseline: Phase 4 — Internal Driver execution

Owner-authorized INTERNAL-only Email/Password portal, active-assignment execution through the existing engine, Today/Upcoming/Completed, private issues/photos, optional milestone location, private POD and safe customer progress. EXTERNAL resources remain staff-operated. Six additive migrations bring the total to twenty-five. The canonical Phase 4 report controls acceptance; implementation alone is not PASS. Do not merge or deploy Production without separate authorization. Phase 4 was merged through protected review as develop b5a6406b69a62bdc9c4d383433efea5b9da86b44.

## Current phase: Phase 5 — Live tracking and in-app notifications

Owner-authorized foreground Internal Driver GPS, server-controlled moving/stationary publication, minimized RLS latest location, private bounded history, customer/Operations Realtime views, safe event notifications and a native publication contract. Two additive migrations bring the total to twenty-seven. The canonical Phase 5 report controls acceptance. Provider-backed ETA is unavailable; no routing credentials are configured. Phase 6 has not started.

## Deliberately deferred

External routing integration; External Driver portal/login; phone OTP; reliable background GPS; offline synchronization; automatic ETA and route optimization; payment gateways, charges, webhook processing and invoices; provider notification delivery; AI; marketplace; SaaS billing; extensive SEO content; branch-specific authorization beyond tenant-safe references. No external messaging or payment provider is activated.
