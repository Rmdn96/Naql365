# Pre-Production Runtime Safety & Deployment Attestation

## Owner decision and exact starting comparison

7 October 2026: **DEFERRED — RESUME AFTER PRODUCT RELEASE CANDIDATE**.

Hostinger remains the intended final Production host. Development/Staging/Preview work resumes on Vercel. This candidate is not Phase 8 and authorizes no deployment, Production resource, DNS change, merge or product behavior change.

Protected develop is `518aef34128dd31413f1e4fc7c31e30a19f15832`. Both `feature/preproduction-hostinger-runtime` and `deploy/hostinger-acceptance` started this review at `ace2f71936fa4f4001c66f0afe68f6087a3719ff`; their trees are identical. That deployment checkpoint has exact-head CI `37587498560` PASS. The deployment branch remains frozen at that historical checkpoint; the source branch carries this clean merge candidate.

The starting develop-to-runtime diff contains 40 files, 1,251 insertions and 61 deletions. The reusable implementation is preserved: provider-neutral environment authority; build/start identity artifact and instrumentation; output tracing; additive deployment attestation migration and generated types; SQL/security/upgrade tests; shared provider/protection adapters and fixture ledgers; CI history scan; Production review/runbook and Hostinger documentation. No dependency versions or business workflows are changed by this separation.

## Temporary deployment configuration

Commits `a105400`, `cb62ee1` and `ace2f71` changed only the exact Hostinger acceptance origin. Their temporary hostnames were Staging allowlist entries, never Production authority. This candidate removes the last `purple-skunk-677919.hostingersite.com` entry: `staging.hostingerOrigins` is empty, `hostingerProtection` remains empty and `production` remains null. No wildcard or suffix trust is introduced. Hostinger builds/acceptance against those old origins are now denied by the existing guard; the preserved deployment branch is not promoted or redeployed.

Historical setup observations and reviewed SHAs remain evidence, not Hostinger runtime PASS. No existing Hostinger website, environment variable or DNS record is modified by this candidate. On resumption, verify the current resource and exact origin, obtain fresh owner authorization, review its allowlist/protection configuration, pass exact-head CI, and promote only the reviewed candidate. Rebuild artifacts after manifest changes; do not reuse an old identity artifact.

## Immutable database and security boundary

All 44 accepted develop migrations are byte-unchanged. The sole additive migration is `20261006000100_deployment_attestation.sql`, making 45. Migration 45 is also unchanged from the reviewed runtime checkpoint. It creates an unseeded private singleton with no direct anon/authenticated table access and a zero-argument read-only RPC exposing only protocol, environment, opaque identity and revision. This is backend designation, not certification of pricing, tax, payment destinations or operational readiness.

Production remains fail-closed without an approved independent manifest and matching backend attestation. Build/runtime public identity matching, local-origin restrictions, exact Staging project verification, Vercel-only protection headers and Hostinger protection gates remain intact. No migration, RLS policy or environment guard is weakened.

## Validation and protected review

Required candidate gates: formatting, lint, strict TypeScript, all unit/integration tests, 32 local desktop/mobile E2E, optimized build, tracked/history heuristic credential scans, and exact-head CI. CI additionally reconstructs the database, checks official generated types and SQL/RLS assertions, and runs independent-connection concurrency suites. Local Docker availability must not be represented as a local database PASS; CI provides the PostgreSQL evidence. Final SHA/run and totals are recorded in the PR and closeout after execution.

Dependency security closeout: PASS — scoped owner risk acceptance. The development-only braces advisory remains technically unresolved upstream; the audit is not fully clean.

The PR targets protected develop and requires independent review and required checks. Do not merge without owner authorization. Preserve main and the dedicated Hostinger deployment branch.

## Subsequent work is gated

Do not create `feature/preproduction-manual-pricing-coverage`, begin its gap analysis, or implement manual pricing/coverage until this reusable runtime work is merged into develop. The owner's SA/EG simultaneous launch, Riyadh/Cairo origin coverage and manual-pricing-only policy is deferred to that next task. Automated pricing is to be preserved, not removed. Visual polish, MFA, legal publication, Production and Phase 8 are outside this candidate.
