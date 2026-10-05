# Hostinger acceptance deployment — preflight design checkpoint

Status: **HOSTINGER RUNTIME ENABLEMENT PARTIAL — FURTHER SOURCE CHANGE REQUIRED**.

No deployment is authorized by this document. No application implementation, environment guard, provider adapter or migration was added at this checkpoint. The owner explicitly requires stopping before an additive backend-marker migration for review. This checkpoint records that decision boundary rather than claiming runtime enablement is complete.

## Verified source and branch

- Accepted remote develop: `518aef34128dd31413f1e4fc7c31e30a19f15832`.
- Remote main: `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`, unchanged.
- New branch: `feature/preproduction-hostinger-runtime`, created directly from remote develop.
- Documentation-only commits `b30c0e337b1e99f5a56b3cafc9f90900f814f4a3` and `b23811216bfe852a62942d041ce46e4e501802b4` descend from the accepted develop and were not its ancestors. Inspected each changed-file list before cherry-picking them as `f14db28` and `844fd4e` respectively. Only the Production launch review/runbook and Hostinger compatibility document changed.
- Existing 44 migrations and application source remain unchanged. No Production reference has been invented.

## Why backend attestation needs owner review

Inspection of migrations and generated database types found no environment-identity table or attestation RPC. Existing public endpoints can show that a key reaches a project, but cannot attest that its database has been independently designated as the approved Production environment. URL/key format validation, duplicated environment variables and a local manifest alone cannot establish that database-side designation. Reading protected business tables with a service-role key in the web runtime would introduce unnecessary authority and is rejected.

For the proposed live backend-marker design, an additive database interface is required. It is not required merely to run Next.js on Hostinger. The owner may instead approve a separately designed signed external attestation architecture, but no such system currently exists and none is assumed.

### Smallest proposed additive design — NOT APPLIED

Propose one new migration (45 only after explicit approval), leaving migrations 1–44 untouched:

1. A singleton `private.deployment_identity` table containing protocol version, environment enum, opaque non-secret deployment identity UUID, and approved configuration revision. No keys, email addresses, payment values or business data. No row is seeded by the migration; a missing row means unprovisioned and fails Production startup.
2. Deny direct table/schema access to anon/authenticated; retain RLS/default denial as defense in depth. Only an audited privileged setup procedure may initialize/change the marker after independent verification. Application users, including ordinary staff RPCs, cannot write it.
3. A narrowly scoped `public.deployment_attestation()` read-only RPC, with fixed empty search_path and fully qualified references, returning only that non-secret tuple. Revoke default PUBLIC execution and grant only the API roles explicitly needed. Startup has no user session: the proposed anon publishable-key execution exposes only non-secret environment identity, never business data. This deliberate limited disclosure requires owner review; do not claim it is an authenticated staff-only endpoint. No caller-provided SQL, reference, organization selector or write operation.
4. Production startup requests this RPC at the manifest-allowlisted HTTPS Supabase origin using the matching publishable key. Exact response/schema, marker, environment and revision must match a separately reviewed release manifest. Bound timeout/response size; no redirect following; errors contain codes only. Missing row/RPC, denied key, timeout or mismatch prevents readiness. The future Production manifest entry remains absent until the real project is authorized and independently recorded.
5. The marker attests environment designation, not financial correctness. A configuration revision is meaningful only with a separately approved inventory/readback procedure and invalidation on relevant configuration changes. Do not claim this minimal RPC automatically detects arbitrary TEST payment data. Extending automated financial-configuration attestation requires an explicit further design, not access to private account values from anon.

Required migration review tests: empty reconstruction creates no marker; no anon/authenticated writes or direct reads; exact safe RPC result; unprovisioned/invalid-marker rejection; no business/financial data disclosure; populated 44-migration upgrade leaves existing records unchanged; generated types exact. No existing schema constraint or RLS policy is weakened.

## Application implementation plan after marker decision

Use one provider-neutral authority shared by Next build validation, startup preflight and server initialization. Next's installed instrumentation documentation confirms register completes before readiness; additionally validate the supported npm start path before listening. Never rely only on a later page render.

- Local: preserve current supported loopback/development behavior.
- Staging: explicit APP_ENV=staging; exact reviewed origin allowlist and project `zuvyfeflkzlciuaauxba`; preserve approved Vercel origins, with Hostinger list empty until its exact hostname is known and reviewed.
- Production: exact https://naql365.com; reject localhost/IP/www/temporary/Vercel origins, missing values and staging smoke. Require a reviewed Production manifest entry and successful backend attestation. No entry currently exists, so Production stays unavailable.
- Build writes an artifact identity recording environment, canonical origin, approved manifest revision and digest of public backend configuration. Start independently reads runtime inputs, compares them with the built artifact and performs backend preflight. Do not mistake statically inlined NEXT_PUBLIC reads for runtime process environment. No key values in diagnostics.
- Bounded errors include ENV_CANONICAL_ORIGIN_MISMATCH, ENV_BACKEND_IDENTITY_MISMATCH, ENV_STAGING_BACKEND_IN_PRODUCTION, ENV_BUILD_RUNTIME_MISMATCH and ENV_BACKEND_ATTESTATION_UNAVAILABLE.
- Automated synthetic-manifest tests must cover all owner-listed rejections, safe local/staging/synthetic Production, wrong key/marker, RPC failure and timeout. Synthetic Production approval exists only in test injection, never in the shipped manifest.

## Acceptance-tool adaptation plan

Existing verify-browser/intake/phase2/phase3/driver scripts contain Vercel origin/bypass assumptions. Playwright fixtures and helper fetches also emit Vercel bypass headers; changing only the top-level origin check is insufficient.

Create one shared target authority and protection adapter for VERCEL_STAGING and HOSTINGER_ACCEPTANCE. Require exact HTTPS origin, reviewed hostname entry, APP_ENV=staging, exact project/reference/organization verification, manifest identity and disposable-fixture ledger before mutation. Reject arbitrary command-line targets and suffix-only allowlists. Keep shared business tests, exclusive-run lock, cleanup and secret-safe reporters. Extend consistent ledger/cleanup coverage across harnesses before claiming this gate passed.

Only the Vercel adapter consumes/emits VERCEL_AUTOMATION_BYPASS_SECRET. Hostinger must use a verified platform-supported restriction (for example an approved operator network restriction if actually available) and its corresponding browser/request access method. No Hostinger mechanism is currently certified. Do not simulate protection with a new application bypass or send Vercel headers to Hostinger. Missing approved Hostinger protection means acceptance mutation is denied.

## Non-secret hPanel checklist — values to verify, not deployed configuration

| Field                                      | Required setting / owner verification                                                                                         |
| ------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Account / plan                             | Confirm managed Node entitlement, region, limits and responsible operator                                                     |
| Website type                               | Full-stack Next.js Node application, not static export/PHP                                                                    |
| Application name                           | Separate non-production acceptance application                                                                                |
| Domain                                     | Actual Hostinger temporary HTTPS origin: NOT YET ASSIGNED; add exact hostname to reviewed allowlist before use                |
| Repository / source                        | Rmdn96/Naql365; frozen reviewed candidate SHA; no Production mapping from develop                                             |
| Root                                       | Repository root containing package.json                                                                                       |
| Node                                       | 24.x; actual patch NOT YET OBSERVED                                                                                           |
| Package manager                            | npm; actual patch NOT YET OBSERVED                                                                                            |
| Install                                    | npm ci; confirm build log uses deterministic lockfile install including build dependencies                                    |
| Build                                      | npm run build                                                                                                                 |
| Start                                      | npm start; verify platform PORT/bind, no next dev                                                                             |
| Output                                     | Next preset .next with required runtime/public assets; not static-only copy                                                   |
| NODE_ENV                                   | production (optimized Node build, not environment designation)                                                                |
| APP_ENV                                    | staging                                                                                                                       |
| APP_URL                                    | Exact approved temporary HTTPS origin; no guessed hostname                                                                    |
| NEXT_PUBLIC_SUPABASE_URL / PUBLISHABLE_KEY | Approved Staging project and its matching public configuration, privately configured; no values in this checklist             |
| STAGING_AUTH_SMOKE_ENABLED                 | false/absent normally; any bounded technical test needs documented controls and cleanup                                       |
| Production guard manifest                  | Production entry absent; production must fail closed                                                                          |
| Access protection                          | Supported Hostinger mechanism to verify; no Vercel token assumption                                                           |
| TLS/proxy                                  | Original HTTPS/host preserved, full Set-Cookie attributes, no personalized-response caching                                   |
| Logs / capacity                            | Bounded access/redaction, RAM/process/upload/timeouts, restart and sharp/Next runtime behavior                                |
| Auth                                       | Exact temporary callbacks added to Staging only after separate authorization; preserve historical callbacks during transition |
| DNS                                        | No naql365.com/www binding or record changes in this task                                                                     |

## Verification at this stopped checkpoint

Only documentation changed. Formatting, diff hygiene, tracked-file secret-pattern scan and migration/source equivalence checks are applicable. No new guard tests exist yet; full unit/integration, E2E, database/RLS/types and concurrency suites were not rerun and must not be reported as newly PASS. No exact-head CI run is claimed. After implementation, run every requested regression and secret/history scan before requesting deployment authorization. Historical CI is not evidence for unfinished enablement.

## Owner decision required

Approve or reject the proposed single additive private marker + minimal read-only RPC, including its deliberately non-secret anon result, before implementation continues. No migration, infrastructure, app source or hosted setting has been changed at this checkpoint.

**HOSTINGER RUNTIME ENABLEMENT PARTIAL — FURTHER SOURCE CHANGE REQUIRED**
