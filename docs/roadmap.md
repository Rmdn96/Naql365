# Phase boundaries

## Phase 0 — Foundation

Repository audit; compatible stack and strict typing; modular server/domain/data boundaries; ar/en routing and translation; accessible public/auth/protected shells; design tokens and primitives; Supabase SSR clients and PKCE callback; relational organization membership/RBAC; default-deny RLS; private file registry/storage; audit triggers; typed pricing/notification/payment ports; migrations; tests; CI; documentation.

No operational feature is complete or presented as available. Tables and interfaces establish relationships and extension points only.

## Exact next phase: Phase 1 — Customer identity and request intake MVP

Start only after explicit Phase 0 review and staging configuration. Implement customer registration/sign-in/recovery and verified enrollment into an organization; then a bounded request intake and customer request list/detail. Agree on request schema, ownership, allowed transitions and validation before adding write policies. Add transactional audit events, tenant-scoped permissions, negative RLS tests and authenticated E2E coverage for each operation. If attachments are included, implement secure upload/scanning and registry lifecycle first.

This recommendation does not authorize implementation now.

## Deliberately deferred

Full Smart Quote/pricing calculations and database rule evaluation; quote acceptance service; operations dispatch; complete driver portal; GPS; payment gateways, charges, webhook processing and invoices; provider notification delivery; AI; marketplace; SaaS billing; extensive SEO content; branch-specific authorization beyond tenant-safe references. No external messaging or payment provider is activated.
