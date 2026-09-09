# Security baseline

## Implemented controls

- Strict TypeScript and Zod boundary validation; unknown keys rejected by shared schemas.
- User-scoped Supabase clients, server-only markers, getUser identity verification and database permission checks.
- RLS on every application table; cross-tenant composite FKs; no client write privileges for unimplemented workflows.
- Profile-only registration trigger; no permissions from email, metadata or hardcoded identities.
- Private storage buckets, registered object paths, 10 MiB limits, constrained MIME types, short signed downloads and no upload policy.
- CSP nonces for scripts, no framing, no objects, self-only forms/base, nosniff, restrictive permissions policy, HTTPS HSTS and limited referrer disclosure.
- React text escaping; controlled JSON-LD serialization escapes `<`; no user HTML rendering.
- Same-origin allowlisted PKCE callback redirects. No mutable GET endpoint except the required one-time Auth code exchange.
- No business mutation API yet. Future Server Actions retain framework Origin/Host checks; future cookie-authenticated route handlers need explicit origin/CSRF checks, not CORS as a substitute.
- Error boundaries expose translated generic messages, never raw stack traces, database details or credentials.
- No password, session, URL token, uploaded content or API response logging in application code.
- SQL is migration-based, static and parameterized through the SDK. Narrow SECURITY DEFINER functions have empty search_path and revoked PUBLIC execution.
- Role/membership and key entity audit triggers run transactionally. Audit records are read-only to authorized staff and immutable to API roles.
- Exact dependency lock, read-only CI token, SHA-pinned Actions and automated secret-pattern check.

The secret scanner detects known credential formats and tracked environment files. It is a baseline control, not proof that arbitrary secrets cannot exist. Before releases, review the staged diff and history; enable GitHub native secret scanning/push protection where available.

## Environment boundaries

`.env.example` contains names only. NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY are intentionally browser-visible. APP_URL is server-only. No service-role or gateway credential is required for the app. Missing Supabase settings render an unavailable protected state, never grant access. Invalid APP_URL fails production builds.

Local Supabase settings are not automatically synchronized to hosted Supabase. Before enabling hosted Auth, configure canonical site/callback URLs without broad wildcards, email confirmations, secure password changes, password minimum, refresh-token rotation and appropriate rate limits. Enable staff MFA operationally before privileged production use. Customer self-registration does not imply staff self-registration.

## Deployment gate

1. Apply migrations to an isolated staging Supabase project and verify RLS tests against PostgreSQL 17 compatibility.
2. Set only this project's environment values in Vercel. Preview environments use isolated development/staging data. Never reuse a different project's keys.
3. Configure hosted Auth URLs/email/MFA and test a real PKCE session, refresh and logout/revocation behavior in staging.
4. Provision the first organization/staff membership through a reviewed trusted transaction; no demo production seeds.
5. Require CI checks on develop/main and review migrations and role grants before merge.
6. Establish backups, recovery checks, audit retention and incident ownership before production data exists.

These operational steps are not silently assumed to have been completed. No production database migration or Vercel deployment is required to review the foundation branch.

## Deferred security work at feature boundaries

Uploads need server-verified content type, content scanning, lifecycle/registry transactions and abuse limits. MIME metadata alone is not malware protection. Payment webhooks require raw-body signature verification and unique event processing; no gateway is active. Driver visibility must depend on assignment. New writes require authorization, validation, idempotency where applicable, audit coverage and negative RLS tests. Published quote immutability requires a lifecycle rule before quote writes are opened.
