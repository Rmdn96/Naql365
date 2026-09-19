# Security baseline

## Implemented controls

- Strict TypeScript and Zod boundary validation; unknown keys rejected by shared schemas.
- User-scoped Supabase clients, server-only markers, getUser identity verification and database permission checks.
- RLS on every application table; cross-tenant composite FKs; no client write privileges for unimplemented workflows.
- Profile-only registration trigger; no permissions from email, metadata or hardcoded identities.
- Private storage buckets, registered object paths, constrained MIME types and short signed downloads. Foundation files retain their bucket limits; Phase 1 request images have the stricter limits below.
- CSP nonces for scripts, no framing, no objects, self-only forms/base, nosniff, restrictive permissions policy, HTTPS HSTS and limited referrer disclosure.
- React text escaping; controlled JSON-LD serialization escapes `<`; no user HTML rendering.
- Same-origin allowlisted PKCE callback redirects. Quote detail reads record idempotent view/expiry metadata for the authenticated owner; commercial acceptance/rejection and pricing changes use protected POST commands. The Auth callback performs the required one-time code exchange.
- Customer intake mutations enforce explicit Origin checks and bounded JSON/multipart bodies in addition to server identity, ownership and database authorization. Server Actions retain framework Origin/Host checks.
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

## Phase 0.5 additions

The optional technical login/logout surface is disabled by default and unavailable in APP_ENV=production. Login/logout Server Actions retain Next.js checks and also compare Origin with the configured canonical origin. Zod validates credentials; failures use generic translated messages. Supabase clients remain user-scoped and never derive privileges from email or user metadata. Logout is available even on the forbidden shell so suspended test users can end their session.

Staging session/file probes are gated, read-only, no-store and noindex. They return only authorization status or a short RLS-authorized file redirect. No administrative mutation endpoint was added. Production/Preview environment mismatches fail before compilation. All non-production pages are excluded from indexing.

SSR cookies explicitly use Secure on HTTPS, SameSite=Lax and path `/`. HttpOnly is not forced because Supabase's shared browser/SSR session design requires browser access when the browser client is used; see the [official advanced guide](https://supabase.com/docs/guides/auth/server-side/advanced-guide). Hosted tests verified cookies and CSP; real Arabic/English email PKCE verified callback, refresh persistence and logout. Logout revokes refresh capability; existing access JWTs may live until expiry, while database membership checks revoke protected tenant access immediately.

Hosted Staging was reconstructed from unchanged migrations. Real customer JWTs verified tenant/customer isolation, denied membership escalation and audit forgery, suspended access, private downloads/signing and signed URL expiry. Scripts isolate admin credentials in operator memory, never application bundles. Synthetic cleanup is restricted to generated fixture UUIDs. See [staging smoke protocol](staging-smoke-test.md) and the [phase report](reports/Naql365-Phase-0-5-Report.md) for executed versus blocked checks.

Both main/develop require reviewed PRs and both CI jobs, with admin enforcement and no force pushes. The owner explicitly authorized a single isolated static infrastructure bootstrap to satisfy Vercel's first-deployment behavior. Subsequent application deployments are genuine Preview deployments and use only the independent Staging Supabase. The bootstrap never connected to a database. See the canonical report for its final cleanup status.

The optional email-link action validates its input and Origin, disables user creation, uses an exact server-chosen callback, and persists the SSR PKCE verifier. It never returns provider details or account-existence information. The temporary controlled mailbox identity was removed after real browser verification. No role is assigned from its address.

Preview toolbar is disabled in project configuration. Existing deployments may retain the provider injection; CSP is not widened for it. The asset audit checks every DOM-observed script in Node, never forwards the automation bypass to third parties, and matches actual source-map directives rather than harmless string literals in vendor code. Runtime logs are inspected in memory and only counts/absence results are recorded. This is bounded smoke evidence, not a claim of exhaustive penetration testing.

## Deferred security work at feature boundaries

Phase 1 request images validate signature/type, limit each image to 3 MiB, cap attachments at eight and cap open drafts at twenty per customer. Private reservations expire for upload after twenty minutes. A completion trigger serializes Storage insert/update with the request state and checks reserved size/type again; finalized objects cannot be overwritten. Pending/removing objects cannot be signed or submitted. Removal first revokes visibility, then deletes bytes, then finalizes registry cleanup. Content scanning is not implemented or claimed; signature checks are not malware protection.

Profile onboarding requires confirmed Auth identity and a trusted private enrollment configuration. Editable email/metadata never grant roles. The transaction creates only CUSTOMER participation, serializes duplicate enrollment and cannot reactivate suspension. Request commands reject unknown fields, enforce ownership/active membership, compare revisions, allocate references atomically and protect submitted payloads. Raw table write privileges remain closed to customer clients. Application credentials remain user-scoped; operator admin credentials exist only in guarded test processes.

Payment webhooks require raw-body signature verification and unique event processing; no gateway is active. Driver visibility must depend on assignment. New writes require authorization, validation, idempotency where applicable, audit coverage and negative RLS tests. Published quote immutability requires a lifecycle rule before quote writes are opened.

## Phase 2 commercial authorization

Pricing and quote commands derive auth.uid(), active tenant membership and explicit permissions inside PostgreSQL. Customers cannot provide authoritative distance or money, read internal pricing details, modify sent snapshots, or promote their permissions. Distance corrections create a new evaluation and stale earlier drafts. Customer acceptance locks the sent version and creates one Order from its immutable commercial facts. Sent versions and their components reject direct mutation. Operator fixture cleanup is confined to guarded Staging scripts; authenticated clients cannot invoke the cleanup path. Safe query diagnostics contain only an operation label and database error code.

## Phase 3 operational authorization and POD

Operations commands enforce current tenant membership and separate operations, dispatch and fleet permissions in the server adapter and PostgreSQL. Customer and Sales roles have no operational mutation privilege. External Driver records require no Auth identity; the authenticated staff member remains the event/POD actor. Driver and Vehicle execution constraints are authoritative in the database, with revision and idempotency checks for retries. Started-Trip reassignment requires explicit confirmation and a bounded reason, retaining prior assignments.

Customer tracking exposes a fixed own-Order projection and excludes signatures, Driver identity, internal notes and assignment reasons. Sent commercial facts remain immutable when operational completion changes. Raw operational history writes are revoked.

POD signatures are private. Server image decoding/re-encoding strips metadata; database reservation/finalization guards and Storage policies apply independently of the UI. A signed URL is a short-lived bearer capability and must not be logged. Unauthorized Customer, Sales, cross-tenant and direct public access are covered by hosted tests, including expiry and duplicate final POD denial. This does not constitute malware scanning or legal signature verification.

Identity/customer verification diagnostics record only operation labels, provider error codes and HTTP status; never tokens, cookies, email addresses or provider error messages. Hosted acceptance disables screenshots, traces and video. SDK probe sessions use local logout so they cannot revoke the separate browser session mid-test. The canonical Phase 3 report records prior failures, final evidence and cleanup; successful local tests alone are insufficient.

## Phase 3.5 market security

Market selection is explicit input, validated against active tenant markets. City IDs, service activation/coverage, pricing classes, tax versions and operational resources must match the record market. Composite foreign keys enforce this even for trusted writers; the application never substitutes UI filtering for database checks. Customers cannot override currency/tax or change committed market context. Configuration writes require the separate `markets.manage` permission, initially assigned only to SUPER_ADMIN.

International contact numbers do not establish market, identity or authorization. No routing credential or legal tax policy is inferred. Shared SQL fixtures are tenant-scoped and transactional; a populated configuration test proves existing catalogues/enrollment survive them unchanged. Initial hosted testing exposed nested commercial main landmarks; these were corrected without weakening authorization, RLS or assertions.

## Phase 5 location boundary

Location publication rechecks active membership, DRIVER role, INTERNAL profile mapping, current assignment, Trip activity and tenant/Market under the existing operational lock before accepting or replaying a sample. Customer/Operations read permission never grants publishing authority. Reassignment clears the last position and closes the old session; terminal execution clears live coordinates. Client labels such as WEB/NATIVE carry no privilege.

Latest rows expose only bounded operational location facts. Raw samples/session actors/assignment history stay private and are excluded from Realtime. Postgres Changes rechecks row security for each subscriber; no DELETE event is used as an authorization boundary. Customer notifications contain safe event codes, not issue reasons, emails or precise location. Only recipient read_at can be updated.

The web collector stops when hidden or disposed and revalidates authority. Server publication limits remain mandatory across tabs/clients. GPS is device-reported evidence, not certified physical presence. OpenStreetMap tile requests disclose approximate viewport to that provider only after an explicit load action; attribution and referrer are retained. No paid provider secret or fabricated ETA is introduced.
