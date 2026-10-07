# Hostinger acceptance deployment — runtime enablement

> Owner decision (7 October 2026): **DEFERRED — RESUME AFTER PRODUCT RELEASE CANDIDATE**. Hostinger remains the intended Production host; development, Staging and Preview work resumes on Vercel. No Hostinger runtime remediation or deployment is authorized in this candidate. See [runtime candidate separation](preproduction-runtime-candidate.md).

Implementation date: 6 October 2026. No Hostinger deployment, DNS change, Production project/marker/configuration or Phase 8 work is authorized here. Hostinger runtime acceptance is NOT EXECUTED; Vercel historical evidence is not substituted for it.

## Baseline and approved scope

Branch: feature/preproduction-hostinger-runtime, created from protected develop 518aef34128dd31413f1e4fc7c31e30a19f15832. Documentation-only b30c0e3 and b238112 were ancestry/file-audited and cherry-picked as f14db28 and 844fd4e. Main remains 184ac2374a7e9611b4b265efc7dac21b57b7a2b1. Existing migrations 1–44 are immutable; candidate now has 45.

The owner subsequently approved the marker design recorded at 862a3e2. The former stop pending migration approval is resolved. Migration 20261006000100_deployment_attestation.sql creates no marker row.

## Schema and anonymous boundary

private.deployment_identity is a singleton enforced by a boolean primary key constrained true. It contains protocol_version=1, environment, opaque deployment_identity UUID and opaque configuration_revision UUID only. RLS is enabled with no application policies; PUBLIC/anon/authenticated have no table privileges. No ordinary staff command writes it.

public.deployment_attestation() takes zero arguments and returns at most one row with precisely those four fields; no marker returns zero rows. SQL is STABLE, SECURITY DEFINER, has empty search_path and fully qualified objects, no dynamic SQL or mutation. Default PUBLIC execution is revoked; anon/authenticated receive only execution of this RPC. The migration owner must be the trusted schema operator: the function uses that owner's ability to read its private table, not caller-provided authority. Its narrow fixed body is the boundary; it does not grant callers the owner's other powers.

Anonymous disclosure is deliberately limited to the owner-approved non-secret designation tuple. This is NOT certification of prices, taxes, bank/wallet destinations, payment approval or operational readiness. Those remain separate launch gates. Marker initialization/change is a separately authorized privileged operator action, never migration seed or application signup.

## Environment authority and artifact lifecycle

config/deployment-manifest.json is reviewed version-controlled authority, independent of runtime environment variables. It pins the approved Staging project and exact historical Vercel origins. Hostinger origins/protection entries are empty and production is null. No real Production startup/build can pass until a separately approved Production manifest entry exists.

src/infrastructure/config/environment-authority.ts enforces explicit non-local origins/backend and matching publishable configuration. Production requires exactly https://naql365.com, approved project/key digest, disabled staging smoke, and successful matching protocol/environment/identity/revision attestation. It rejects missing configuration, localhost/IP/www/temporary/Vercel canonical origins and the known Staging project. Failures expose bounded ENV_* codes only.

npm run build and npm start invoke scripts/guarded-next.mjs. The build loads Next environment configuration, validates inputs, and records a non-secret .naql365-build-identity.json artifact (ignored in Git). It contains the public-target/key digest and manifest digest, not raw keys. Start reads actual runtime process inputs and compares against the artifact before listening. Next instrumentation repeats validation before readiness, including when starting Next directly; next.config.ts validates direct builds. The artifact is included in output-file tracing for managed packaging. Do not omit it from the hosted build output. It must be generated on the target by the approved build command, not copied from Staging to Production.

Production preflight makes a bounded POST with the publishable key to the exact approved Supabase RPC endpoint. It follows no redirects, caps response bytes at 2048 and waits at most five seconds. Missing RPC/row, invalid schema, extra fields, different identity/revision/environment, network error and timeout fail closed. No service-role key, customer session or financial details are used. The approved project/key digest plus independent database marker establish backend designation; duplicate environment variables are not treated as independent proof.

Local behavior remains supported for loopback origins; a public origin cannot use missing/local APP_ENV to evade hosted validation. When testing an optimized local artifact, build and start with the same APP_URL (the local E2E suite uses http://127.0.0.1:3000); the artifact guard correctly rejects changing it after build. Production build mode NODE_ENV=production is distinct from APP_ENV=production.

## Provider adapters, protection and fixtures

scripts/staging/target.mjs provides VERCEL_STAGING and HOSTINGER_ACCEPTANCE authority shared by hosted harnesses and Playwright configurations. Both require APP_ENV=staging and exact approved project/origin; management verification separately checks the exact Staging organization/reference and healthy project. Arbitrary CLI URLs, suffix-only matches and Production targets are denied.

Only VERCEL_STAGING sends the Vercel bypass header, and only to the verified origin. Hostinger sends no such header and cannot be approved just by setting a bypass variable. The currently implemented Hostinger mode requires an independently reviewed NETWORK_ALLOWLIST platform restriction recorded for the exact origin. Actual platform support/enforcement must be verified in hPanel before adding an entry; if unavailable, leave Hostinger denied and implement a supported adapter after review. This is not an application-level bypass and does not claim Hostinger currently provides a verified restriction for this account.

Existing business tests and scoped cleanup are retained. Exclusive-run locking prevents overlapping fixtures. The common ignored JSONL ledger records safe fixture-root Auth/organization UUIDs; existing Phase 7 guest ledger supplements it. Cleanup failures/nonzero runs retain the ledger for recovery, successful completed runs remove it. Never treat a ledger entry for a shared organization as permission to delete the organization; use existing per-user/request cleanup predicates. No email/password/token/financial data belongs in a ledger. Public signup still requires actual confirmation, never pre-provisioned fixture membership as a substitute.

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

## Required acceptance and verification

Run the complete Hostinger matrix in hostinger-runtime-compatibility.md only after separate deployment authorization. It covers real registration/confirmation, all role sessions and logout, Guest/Finance/Operations/Driver/POD, private Storage, Realtime, AR/EN/SA/EG, mobile, headers/cookies, safe logs and cleanup. No result on Hostinger is claimed by this source task.

Source verification includes synthetic environment/adapter tests, real PostgreSQL migration security assertions, fresh 45 reconstruction, populated 44→45 table/policy snapshot comparison, complete unit/integration and local E2E. Official Supabase-generated types and independent-connection concurrency are verified in GitHub CI; see the final task evidence for exact final-head run and totals. Local Docker was unavailable and attempting to start it exhausted machine memory; that local stack gate is not represented as executed successfully.

The full dependency audit is not clean: preserve the existing scoped owner acceptance for the development-only braces advisory, technically unresolved upstream. No package version was changed.

## Manual hPanel values still unknown

Exact temporary origin, plan/region, Node/npm patches, deterministic install control, build-output retention, supported access restriction, PORT/proxy/TLS/cookie handling, resource/upload limits, logs and operational rollback must be verified on the real account. No credentials or real Production identifiers are requested or stored here. Production remains disabled; financial configuration approval is separate.

## Source verification evidence

- 219 unit/integration tests PASS locally before the additional local-origin hardening; the final suite has 220 cases (45 files), including 19 environment/adapter cases and two migration security/upgrade cases.
- 32 local desktop/mobile E2E PASS; optimized build, strict TypeScript, lint and formatting PASS.
- Initial implementation CI 37430815661 PASS: both application and Supabase jobs; six SQL TAP files (containing their internal assertions), all five independent-connection concurrency suites, generated-type diff check. These suite counts are not represented as six individual SQL assertions.
- Official Supabase CLI types artifact from generation run 37430815666 is byte-identical to committed types (SHA-256 6429ed5bd00c72a905ff14f7fe291de0d1ca2cba8d60e94de81fcca20cbdfe8d).
- Tracked and history heuristic credential scans PASS. History scan is now in CI; it does not claim detection of every possible secret format.
- Final exact-head CI must also PASS after this documentation update; its SHA/run are recorded in the final task response. No hosted tests ran and no hosted fixture cleanup was necessary in this source task.

Changed areas: deployment manifest/authority, build/start/instrumentation and output tracing; one migration, SQL assertions and generated types; shared hosted target/protection adapters, Playwright protection headers and fixture ledger; unit/upgrade tests; CI history scan; the four Hostinger/Production documents. No commercial/Auth/RLS business behavior was redesigned.
