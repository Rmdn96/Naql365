# Architecture and decisions

## ADR-001 — A modular application

One Next.js App Router application, with separate route groups for public web, customer account, operations portal and driver portal. Core Platform resides in domain/application/infrastructure, not a fifth UI. Separate deployable apps are unnecessary in Phase 0; modules can later be extracted at stable interfaces. Domain imports cannot depend on React, Next.js, Supabase or infrastructure (enforced by ESLint).

Presentation composes services. Application services orchestrate authorization. Domain models and ports contain no framework/runtime state. Infrastructure implements user-scoped data access and provider interaction. No global client state library or generic repository layer is introduced without a use case.

## ADR-002 — Tenant identity is relational

Profiles identify people; organization memberships identify tenant participation, type and suspension state. User roles belong to a membership. Branches belong to organizations; a branch reference never crosses its organization. `SUPER_ADMIN` is scoped to an organization, not a cross-tenant platform bypass. This adds one essential table to the proposed initial list: `organization_memberships`.

Composite `(organization_id, id)` keys and FKs preserve tenant integrity even for trusted privileged imports. UUIDs are stable identifiers. Tenant context must be explicitly supplied to future server operations and reauthorized each time. The placeholder portal guard can discover an authorized membership to show an empty shell; it must not become implicit tenant selection for mutations.

## ADR-003 — Database authority, deny writes by default

Supabase Auth verifies identity; membership, roles and permissions are resolved from PostgreSQL on every protected server operation. No permissions are read from email or editable auth metadata. RLS enforces the same decisions for direct API access. No browser/service-role client exists. Operational tables in Phase 0 support only explicitly allowed reads. Future mutations require transaction boundaries, permissions, validation and negative tests before privileges/policies are added.

## ADR-004 — Skeleton business schema

Create the requested relational backbone now, without speculative prices, addresses, statuses or workflow fields. Pricing, dispatch, payments and driver workflows are unimplemented by design. Quote versions have a positive revision and unique per-quote version number. Orders reference a specific version and permit one order per quote. A database uniqueness rule, not a process-memory lock, prevents duplicate acceptance. A future acceptance implementation must be atomic and return the existing order on a matching retry; Phase 0 does not implement acceptance.

## ADR-005 — Explicit provider ports

Pricing rules, quote acceptance, notifications and payments expose typed domain ports. No external provider is configured or called. Money uses integer minor units at the domain boundary. No floating-point monetary calculations or credentials appear in components. Payments, transactions and invoices are distinct relational entities. Notification delivery must later use a transactional outbox with retries/deduplication; a port alone is not a delivery guarantee.

## ADR-006 — Small localization and design foundations

Arabic is the default at `/ar`; English lives at `/en`. Shared dictionary types keep keys aligned. The root locale layout sets `lang` and `dir`; logical CSS properties preserve RTL. Metadata is localized. Actual request/track workflows are reserved for `/[locale]/request` and `/[locale]/track`, with no deceptive nonfunctional forms now.

Native HTML inputs, selects, tables and dialogs minimize JavaScript and provide accessible semantics. Only interactive dialogs, error boundaries and browser SDK entry points are client modules. The public homepage uses Server Components. UI tokens include the specified brand palette and darker semantic blue for accessible small text and button contrast. The design-system route is a public, noindex demonstration containing no internal data.

## ADR-007 — Per-request security headers

Nonce-based script CSP requires dynamic rendering. Public pages therefore render on the server, with private/no-store responses to avoid nonce reuse; robots and sitemap are static. This is an intentional security/cache tradeoff at foundation scale. Future public CDN caching requires an explicit CSP strategy review. Personalized responses must never be shared-cached. JSON-LD is serialized and escapes `<`, and its script receives the nonce. Inline CSS is allowed for framework/style compatibility; arbitrary inline script execution is not.

## ADR-008 — Compatible dependencies, reproducible tooling

Registry checked during implementation: Next 16.3.4, React 19.2.8, Supabase SSR 0.12.7 and supabase-js 2.116.0. Exact installed versions live in package.json and package-lock.json. Node is constrained to the 24 LTS family.

TypeScript 7 and ESLint 10 were available, but the current typescript-eslint peer contract requires TypeScript <6.1 and Next's React/accessibility lint plugins require ESLint 9. Pin TypeScript 6.0.3 and ESLint 9.39.5 for compatibility; npm reports ESLint 9 as unsupported, which is a known tooling limitation requiring a coordinated plugin upgrade. Do not force incompatible peers or disable lint rules to silence this. npm audit reported no advisories during initial installation.

Official references checked: [Next.js installation](https://nextjs.org/docs/app/getting-started/installation), [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [Supabase session verification](https://supabase.com/docs/guides/auth/server-side/advanced-guide).

## ADR-009 — Phase 1 customer intake

Phase 1 adds confirmed customer onboarding and request intake to the foundation described above. The wizard is an interactive client component; list/detail pages remain server rendered. Shared Zod schemas and pure request utilities live in domain/requests. User-scoped infrastructure services validate identity, call transactional PostgreSQL commands and orchestrate private Storage. Route handlers enforce same-origin writes and bounded payloads. React never decides tenant membership, role assignment, request ownership or reference allocation.

The private enrollment setting selects one operating organization for self-registration. The database assigns only CUSTOMER and preserves suspension. Requests use normalized locations/items/options and a revision-checked draft command. DRAFT transitions only to SUBMITTED or CANCELLED; there is no downstream quotation/order behavior. See [schema-gap analysis and decisions](customer-request-intake.md) for the inspected baseline, migration rationale, autosave and attachment lifecycle.
