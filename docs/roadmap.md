# Phase boundaries

## Phase 0 — Foundation

Repository audit; compatible stack and strict typing; modular server/domain/data boundaries; ar/en routing and translation; accessible public/auth/protected shells; design tokens and primitives; Supabase SSR clients and PKCE callback; relational organization membership/RBAC; default-deny RLS; private file registry/storage; audit triggers; typed pricing/notification/payment ports; migrations; tests; CI; documentation.

No operational feature is complete or presented as available. Tables and interfaces establish relationships and extension points only.

## Accepted baseline: Phase 1 — Customer identity and request intake MVP

The owner authorized Phase 1 after accepted Staging closeout and the independent approval required to integrate PR #1 into develop. The implementation adds customer registration/sign-in/recovery, confirmed onboarding, persisted draft intake, private images, atomic submission and customer list/detail. Schema-gap decisions preceded migrations. Final acceptance depends on the Phase 1 report's evidence; implementation alone does not establish PASS. Malware scanning remains an explicit limitation, not a claimed feature.

## Accepted baseline: Phase 2 — Smart Quote and pricing foundation

Phase 2 was separately authorized from accepted develop `4d3b25730e3b604882a860ade414f98fd888766b`. It adds server-authoritative pricing, owner-approved MANUAL_VERIFIED distance, Sales review, immutable quote versions and exactly-one Order acceptance. Acceptance is recorded in the Phase 2 report; protected PR #3 integrated it into develop.

## Current phase: Phase 3 — Operations, multi-Trip dispatch and POD

Phase 3 was separately authorized from accepted develop `86ba612a5f6f7f4afd7a5c0650d5b4d3848f2b6f`. It adds one operational Job per accepted Order, multiple Trips and ordered Stops, independent Driver/Vehicle assignment, conflicts and emergency reassignment, private POD, derived completion and safe customer tracking. The canonical Phase 3 report determines acceptance. No merge, Production deployment or Phase 4 implementation is authorized.

## Deliberately deferred

External routing integration; complete driver portal; GPS; automatic ETA and route optimization; payment gateways, charges, webhook processing and invoices; provider notification delivery; AI; marketplace; SaaS billing; extensive SEO content; branch-specific authorization beyond tenant-safe references. No external messaging or payment provider is activated.
