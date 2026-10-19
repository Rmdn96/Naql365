# Egypt-first Production release hardening

Preparation only, 19 October 2026. Branch: `feature/unified-egypt-mvp`.
Accepted input application: `10f445fea7007d61f1ed69fe335aa8459677b634`.
Local application correction: `333ae9cd2db5b6be9ff043c0ff0ec70049c8d2b0`.
No push, deployment, migration application, Production configuration write or public activation is authorized by this package.

## Implemented scope

`src/infrastructure/markets/public.ts` now falls back to EG for an absent or invalid public Market preference. Existing valid EG and SA cookies remain authoritative public preferences. Existing EGP mapping and Egyptian coverage are reused. This does not activate Saudi commercial services, grant Market authority, or change authenticated organization/membership resolution. Staff Market resolution and permission checks are unchanged.

Focused tests cover missing/invalid preferences, valid SA/EG preferences, repeated reads, and AR/EN browser refresh/navigation and explicit switching. The existing contact-switch browser test now asserts the Egypt default before exercising SA and EG. No financial workflow is changed.

## Production manifest proposal

See [the non-deployable proposal](production-manifest-proposal.json). Existing authorized CLI access verified project `bglbivhmqcpdakaijhng`, organization `hjfxhwznfgjgywsdsqzn`, at `2026-10-19T12:04:05.791Z`. The actual publishable key was fetched into process memory, fingerprinted and validated against that project's Auth settings endpoint (HTTP 200). No raw key or credential is included here. A read-only transaction confirmed that `private.deployment_identity` does not exist.

The approved canonical origin is `https://naql365.com`. The actual public-key SHA-256 is `c6400a4e9593c6bb84f3363db1c3c4a8be4972289349f2bf74cfb56a80105070`. Marker identity and revision cannot truthfully be populated yet. They must come from separately authorized schema/marker provisioning and subsequent verification; do not manufacture UUIDs.

The active `config/deployment-manifest.json` remains unchanged with `production: null`, preserving fail-closed Production build/startup behavior. The proposal is documentation, not input to the application. Preserve exact-origin, key/project, build identity and backend-attestation checks in `src/infrastructure/config/environment-authority.ts`. Do not copy a Staging build artifact into Production or initialize a marker in this task.

## Legal integration and required owner content

Existing integration is sufficient: `src/domain/legal/content.ts` validates approved copy, `src/proxy.ts` returns a real 404 for missing copy, and navigation omits unavailable legal links. `src/content/legal.json` remains unchanged: all four entries are null.

The owner must supply each of `privacy.ar`, `privacy.en`, `terms.ar`, and `terms.en` in this exact shape:

```json
{
  "title": "OWNER-APPROVED TITLE",
  "paragraphs": ["OWNER-APPROVED PARAGRAPH"],
  "approvedRevision": "OWNER-APPROVAL REFERENCE"
}
```

These are field descriptions, not publishable legal copy. The four routes are `/ar/legal/privacy`, `/en/legal/privacy`, `/ar/legal/terms`, and `/en/legal/terms`. Do not insert placeholders to enable them.

Owner-approved content must identify the legal business/contact and privacy controller; describe Transport and supplier-fulfilled Store responsibilities; establish seller/invoice/tax treatment, delivery responsibility, cancellations, returns and refunds; and address account/contact, location, POD, proof and financial records, purposes, recipients, retention, rights and privacy contact. Supply reviewed Arabic and English wording and an approval revision for each entry. No tax rate, retention period or legal obligation is inferred here.

## Driver location: recommended B, proposal only

**Recommend server-authoritative Production capture disabled until a retention policy is approved. Not implemented by this commit.** Accepted Driver workflows remain unchanged.

There are two distinct persistence paths:

- Migration `20260919000100_live_tracking_authority.sql`: authenticated `public.publish_trip_location` writes foreground samples, sessions and current location. Its per-trip sample cap is not a time-retention policy. The optional `staging_retention_hours` and `private.prune_tracking_history()` are expressly Staging controls.
- Migrations `20260914000100_internal_driver_authority.sql`, `20260914000300_driver_projections_and_issues.sql` and `20260914000400_driver_private_evidence.sql`: optional arrival/POD coordinates pass through `private.record_event_location` into immutable `public.trip_event_locations`. The operational-history trigger rejects updates/deletes. A generic TTL deletion would violate that contract.

Hiding customer tracking via `LAUNCH_CUSTOMER_LIVE_TRACKING` does not disable either capture path. An API-only flag is insufficient because authenticated callers can invoke the RPC directly.

The smallest safe follow-up is a separately reviewed additive database capture policy, disabled for Production pending approval. Guard `publish_trip_location` before persistence with a stable policy-disabled outcome. Guard `record_event_location` so optional coordinates are not retained while legitimate arrival/POD commands still execute normally; never simulate successful location publication. Make disabled capture clear to Drivers and avoid requesting browser location while unavailable. Keep assignment, tenant/Market checks, financial clearance, retries and POD finalization unchanged. Existing immutable location history must not be deleted or altered.

Required focused follow-up tests: direct RPC and API cannot persist disabled location; optional coordinates cannot create event-location rows while authorized arrival/POD still work; role/assignment denials and idempotency remain intact; existing audit history remains immutable; Staging behavior is preserved. No follow-up migration or source change is created now. Alternative A requires an approved bounded foreground-retention procedure plus a separate lawful policy for immutable event evidence; no period or deletion exception is invented here.

## Hostinger readiness

Repository evidence: [runtime compatibility](../../hostinger-runtime-compatibility.md), [deployment acceptance](../../hostinger-acceptance-deployment.md), [runbook](../../production-launch-runbook.md). Historical migration counts in those documents are checkpoints; this candidate has 50 migrations. Existing Hostinger execution remains unproven. No Hostinger account connector is available in this execution environment, so the actual plan/site compatibility is **UNKNOWN**, not established by generic platform support. No account configuration or connector setup was changed.

Necessary account/rehearsal checks, with no deployment performed:

1. Verify the existing plan/site supports this Next.js server, Node `>=24 <25`, native `sharp`, npm lockfile installation with build dependencies, `npm run build`, and `npm run start`. Current package versions are Next.js 16.3.8 and React 19.2.8.
2. Confirm provider PORT/binding, reverse-proxy HTTPS/origin handling, multiple Set-Cookie forwarding, Secure/Lax cookies, dynamic no-store behavior, SSR/Server Actions, image/static assets and Realtime WebSocket connectivity.
3. Preserve `.naql365-build-identity.json` with the matching build. Inventory `APP_ENV=production`, `APP_URL=https://naql365.com`, verified Production public Supabase URL/key, and disabled Staging smoke mode. No service-role, management, database-password or recovery-key material belongs in the application environment.
4. Under separate approval, rehearse on a restricted temporary Hostinger origin using Staging only. Current manifest Hostinger origins/protection mapping are empty: verify the real host protection mechanism and approve an exact origin before configuring it. Do not bypass attestation to make rehearsal run.
5. Separately approve final deployment, exact Auth callbacks/SMTP, HTTPS/canonical redirect and public opening. Retain the previous verified artifact/configuration for rollback; assess schema compatibility before rollback. No DNS, deploy or purchase is part of this preparation.

## Security and evidence reuse

All 50 migrations, dependency files, Auth/RBAC/RLS, Finance and Driver source remain unchanged. Retain the accepted six payment journeys and prior visual evidence; do not repeat them for a public default fallback change.

Accepted input CI: Foundation `39237530232` and Database Types `39237588445`, both PASS on the input candidate. These are not CI results for the new local commit. New exact-head hosted CI requires separately authorized push.

The unchanged lockfile's available 19 October audit evidence reports five High affected dependency nodes for one advisory, `GHSA-vfj7-8cjw-p6xm` / `CVE-2026-93687`: development `eslint-config-next` → `@next/eslint-plugin-next` → `fast-glob` → `micromatch` → `braces` 3.0.3. Production-only audit reports zero known findings. The advisory remains unresolved; passing CI does not fix it. Reuse the explicitly scoped owner risk disposition in [the existing security review](../../production-launch-review.md); monitor for a supported patch. Do not apply the suggested major downgrade or expose build tooling to untrusted pattern input. No dependency change is made.

## Local verification results

- Focused Vitest: **63/63 PASS**, six files: `public-market-default`, `staff-market`, `markets`, `environment-authority`, `finance-market-queue`, and `finance-market-containment`. Eight new unit cases cover the public fallback and preferences.
- Focused Playwright: **12/12 PASS**, `egypt-default.spec.ts` and `public-mvp.spec.ts`, existing desktop and mobile Chromium projects. AR/EN defaults, refresh, cross-locale login navigation, explicit switching, contact destination, guest start readiness, telemetry origin/privacy denial, unpublished legal routes and guest fragment handling passed. No business fixtures or cloud writes were needed.
- ESLint with zero warnings: PASS. Route type generation and strict TypeScript: PASS. Guarded optimized production build: PASS (local environment, no backend credentials). This validates compilation, not an approved Production binding or hosted acceptance.
- Prettier on changed files, Git whitespace check and new-document relative link validation: PASS.
- Migration inventory and SHA-256 comparison: **50/50 unchanged** against the accepted input manifest. Active deployment manifest, legal JSON, lockfile and package manifest unchanged.
- Tracked credential-pattern scan: PASS, 4,389 files. History pattern scan: PASS, 2,102 text blobs before the local correction commit; repeated on final local history before handoff. These are heuristic checks, not proof that every possible secret format is absent.

No hosted tests, Git push or CI dispatch were performed. Unchanged Transport/Store payment, Driver and UI acceptance evidence is retained.

## Remaining release blockers and execution order

1. Approve and install Production schema separately, verify ledger/buckets/RLS, then bind actual deployment marker identity/revision and the verified manifest. Never copy synthetic Staging business data.
2. Supply approved operational/commercial records, real receiving destinations, legal copy, named authorized operators and exact Auth/SMTP configuration under separate authorization. No fictional defaults.
3. Approve and implement a Production location capture/retention control covering both persistence paths before collecting real Driver coordinates.
4. Establish actual Hostinger plan compatibility and restricted rehearsal evidence. No new purchase is assumed necessary.
5. Authorize feature push and exact-head CI, then separately approve a Production deployment and a bounded smoke/rollback procedure before DNS/public opening.

Recommendation: **GO for owner review and authorized hosted CI preparation; NO-GO for public Production activation.** Optional visual expansion, repeated unchanged financial matrices and enterprise recovery infrastructure are deferred.
