# Phase boundaries

## Phase 0 — Foundation

Repository audit; compatible stack and strict typing; modular server/domain/data boundaries; ar/en routing and translation; accessible public/auth/protected shells; design tokens and primitives; Supabase SSR clients and PKCE callback; relational organization membership/RBAC; default-deny RLS; private file registry/storage; audit triggers; typed pricing/notification/payment ports; migrations; tests; CI; documentation.

No operational feature is complete or presented as available. Tables and interfaces establish relationships and extension points only.

## Current phase: Phase 1 — Customer identity and request intake MVP

The owner authorized Phase 1 after accepted Staging closeout and the independent approval required to integrate PR #1 into develop. The implementation adds customer registration/sign-in/recovery, confirmed onboarding, persisted draft intake, private images, atomic submission and customer list/detail. Schema-gap decisions preceded migrations. Final acceptance depends on the Phase 1 report's evidence; implementation alone does not establish PASS. Malware scanning remains an explicit limitation, not a claimed feature.

Phase 2 was separately authorized from accepted develop `4d3b25730e3b604882a860ade414f98fd888766b`. It adds server-authoritative pricing, owner-approved MANUAL_VERIFIED distance, Sales review, immutable quote versions and exactly-one Order acceptance. Final acceptance is recorded in the Phase 2 report. Phase 3 remains locked.

## Deliberately deferred

External routing integration; operational execution and operations dispatch; complete driver portal; GPS; payment gateways, charges, webhook processing and invoices; provider notification delivery; AI; marketplace; SaaS billing; extensive SEO content; branch-specific authorization beyond tenant-safe references. No external messaging or payment provider is activated.
