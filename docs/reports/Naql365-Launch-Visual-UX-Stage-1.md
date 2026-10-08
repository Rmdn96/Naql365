# Launch Visual & UX — Stage 1

Status: LAUNCH VISUAL & UX STAGE 1 PASS

Stage 1 is a representative presentation review, not authorization for a broad rollout, merge, Production, Hostinger acceptance or Phase 8. Baseline: `e43d3ef806bec9361594d38c6808b63bd348a32c`; approved analysis: `70c1e6696db497dedcc0b39b6be54d1c759b1db6`.

## Changes

- Presentation tokens retain Deep Navy, Electric Blue, Cyan and the soft background; accessible action blue remains. Public cards and dense workspace controls have different radii. Typography retains Alexandria and Inter.
- Shared page/section headers, toolbar, summary, status and skeleton patterns provide consistent spacing and hierarchy. Status text and symbols accompany color.
- The homepage identifies the selected Market and Riyadh/Cairo origin coverage, limited to activated destinations. The five-step journey leads to Sales review and a final Quote, with no preliminary monetary promise.
- The responsive header resolves identity through the existing server authority. Its native mobile dialog supports keyboard dismissal and return focus. Locale links retain pathname context without copying queries or capability fragments.
- Login/signup presentation adds clear confirmation guidance and retains email after validation failure. It does not retain passwords or change identity provisioning.
- Customer home promotes the latest Request and sent Quote actions above profile editing. It reuses the existing bounded authorized Request/Quote projections; no new RPC, permission, commercial field or dashboard metric is introduced.
- The eight-step Request wizard has a persistent step/save bar and validation links that focus the relevant step and field.
- Operations provides a representative workspace navigation and section hierarchy. Driver active work prioritizes the next Stop and existing authoritative actions.
- Staff logout uses the existing trusted `customerLogout` session primitive for normal STAFF/SUPER_ADMIN sessions, independent of smoke configuration. Restored browser-history snapshots revalidate through a reload; ordinary navigation never logs out.

## Boundaries and deferred work

All 46 migrations are unchanged. No database authority, pricing, tax, Finance clearance, Operations transition or Driver assignment command was changed. Sales/Finance/Guest/Tracking broad visual rollout remains deferred. Richer customer payment summaries requiring additional projections remain outside this stage. No invented metrics or new domain statuses were added.

Hostinger remains **DEFERRED — RESUME AFTER PRODUCT RELEASE CANDIDATE**. A single exact Vercel Staging alias was added to the reviewed manifest for this visual acceptance. Production configuration remains unavailable.

## Verification checkpoint

- Unit/integration: 271 passing across 49 files.
- Local E2E: 36 passing, including existing 32 cases and AR/EN Stage 1 navigation/dialog checks.
- Responsive local homepage checks: 360, 390, 768, 1280 and 1440 pixels, AR/EN; automated axe and horizontal-overflow checks. Automated axe is not WCAG certification.
- Formatting, lint, strict types, build and tracked/history secret scans passed locally.
- SQL/RLS local suite passed. Fresh local reconstruction retained 46 migrations and exact official generated types. The six independent-connection concurrency suites passed (44 PASS assertions). Local generated-types verification initially encountered an inherited database-password setting and then leftover test assertion functions; removing that inherited setting and reconstructing the disposable local database produced an exact match, without changing the schema or generated source.
- Exact candidate `7475f8ceb9308d62b8c344ea0518d8521e42bd91`: [CI 37641692147](https://github.com/Rmdn96/Naql365/actions/runs/37641692147) PASS, including application quality/E2E and Supabase reconstruction/RLS/types/concurrency.
- Protected [Stage 1 Preview](https://naql365-staging-ux-stage1-naql365.vercel.app): deployment `dpl_AjkiQJUN8NJMLVoi1tFHWQ4ujmdF`, READY, Preview target, exact candidate SHA above. Unauthenticated access returned Vercel protection (302). Both build/runtime smoke flags were explicitly disabled for normal staff-logout acceptance.
- This checkpoint was incomplete; the final hosted results below supersede its pending gates, not its historical infrastructure failure.

## Hosted execution blocker — 2026-10-07

After Preview deployment, the execution environment changed to restricted network access. The hosted runner failed at its first read-only Vercel deployment lookup; a bounded connectivity probe returned `ENOTFOUND` for `api.vercel.com`. It did not reach automation-credential creation or the fixture runner. Thus this attempt created no fixtures or temporary bypass credentials; it is not a hosted acceptance PASS or a completed visual review.

Before this attempt, authoritative Staging readback confirmed SA and EG pricing modes are MANUAL. A preservation baseline recorded three existing Customers and zero Quote Versions/Orders, with digests kept outside Git. Existing identities were not modified. This task made no Production, DNS, main, migration or Hostinger changes.

The remediation below resumed this checkpoint. The original ENOTFOUND attempt remains an infrastructure failure, never an application PASS.

Dependency security disposition is unchanged: the development-only `braces` advisory remains technically unresolved upstream and is accepted only through the documented scoped owner risk acceptance. This is not a clean dependency-audit claim.

## Required owner-safe visual evidence

Homepage AR desktop; homepage EN mobile; login AR; signup EN mobile; Customer AR desktop; Request EN mobile; Operations AR desktop; Driver active Trip mobile. Capture only public or owned synthetic data, with no passwords, cookies, bearer tokens or secure guest links.

## Migration reconciliation — 2026-10-08

Migration 45, `20261006000100_deployment_attestation.sql`, adds the private singleton non-secret backend designation and limited zero-argument public attestation RPC. It seeds no marker and certifies no commercial readiness.

Migration 46, `20261007000100_manual_pricing_directional_coverage.sql`, originated in commit `118d78c86bc64c07b857f28219b9f772d2ce29cd` under the owner-approved Manual Pricing & Directional Coverage task, and reached protected develop through approved PR #11, squash commit `e43d3ef806bec9361594d38c6808b63bd348a32c`. It is not a Stage 1 visual migration.

Its additive schema introduces organization/Market pricing mode, pickup/delivery eligibility, service/add-on applicability, mode-dependent Quote provenance constraints and private manual-mutation idempotency. Trusted functions extend manual Quote creation, Quote send, registered/Guest preliminary-price suppression, shared Request coverage checks and public catalogue projection. RLS grants Sales pricing-mode reads through quotes.manage; scoped catalogue read policies protect applicability; private mutation records have no application-table access. No client direct writes are added.

Backfill preserves existing AUTOMATED pricing settings and Quote provenance, existing directional eligibility and existing add-on applicability. New settings default MANUAL and new coverage rows require explicit directions. No existing commercial amounts or Production city activation are changed by the migration. Manual SA/EG Staging activation was a separate approved configuration action.

Git blob comparisons of every migration present at `2b0639824442857408844a916d96c170b52984e4` against the application candidate returned **45/45 identical**. Total remains 46; none was deleted, rewritten or renumbered.

## Final remediation and hosted results — 2026-10-08

Application SHA: `4a2f155b13358757e567a59dd66c69b266449cac`. Exact application [CI 37771902706](https://github.com/Rmdn96/Naql365/actions/runs/37771902706): PASS. Protected Preview alias is unchanged; deployed ID is `dpl_ASCH7SNgfs1tLKhA5ubR3eMd8pUv`, Preview target, READY, with smoke disabled.

The failed hostname was `api.vercel.com`. The earlier local runner returned DNS `ENOTFOUND` under the then-restricted execution environment, before HTTP/TLS and before Vercel protection could evaluate a request. Normal network access now resolves that same hostname (HTTP 308) and the unchanged Preview hostname (expected unauthenticated protection 302). No DNS, application allowlist, Auth, RLS or protection-policy weakening was needed. The evidence establishes a runner-environment resolution/egress failure; it does not identify a specific upstream DNS resolver defect.

The original stack ends at run-ux-hosted.mjs line 5, its first read-only deployment lookup. Credential creation occurs later and the fixture child is spawned later still. Therefore that failed attempt created zero fixture Auth identities, temporary roles/permissions, business records and Storage objects. No fixture runner executed on that attempt.

The first reachable rerun returned 7/10 PASS. Both guest deliveries completed but the new test incorrectly expected Driver logout at /login instead of the existing /driver/login. The second Customer journey inspected a streamed profile before it arrived. These test timing/route expectations were repaired without changing Auth authority. Screenshot capture now waits for actual page content.

Actual visual inspection required a small application change: the floating WhatsApp control overlapped the mobile wizard Next action; it now sits in normal flow on wizard pages. Two-column mobile step labels no longer break English words awkwardly. The How It Works heading/grid now agrees with its five steps. These CSS/copy changes explain why preserving application SHA 7475f8c was inappropriate. No migrations or backend files changed.

Final guarded hosted suite: **10/10 PASS** on the new deployment. This includes SA Guest CASH through delivery/POD; EG Guest BANK_TRANSFER, private proof, reject/reupload/Finance confirmation through delivery/POD; guest Quote rejection without Order; SA and EG registered manual Quote/CASH; AR and EN public responsive/axe/SEO/Market/contact; capability isolation; AR and EN normal SUPER_ADMIN session/navigation/direct-login/refresh/logout/Back denial. CUSTOMER and DRIVER explicit logout and protected-route denial are included in their journeys. The staff test runs without smoke authority.

Local rerun: **271 unit/integration, 36 E2E PASS**. Exact application CI repeats quality/build/E2E and native reconstruction/RLS/types plus independent-connection concurrency. All 46 migration blobs remain unchanged from accepted develop.

Final cleanup PASS: all 16 run-owned Auth identities and their scoped business/role/file fixtures were handled by the existing ledger cleanup; owned isolated organization removed and temporary guest policy restored. Preservation digests for existing Customers, Quote Versions and Orders match the pre-run baseline (3/0/0 respectively). Existing owner/admin records were not used as destructive fixtures. The owned automation credential was revoked and denied with protection redirect 302.

Bounded runtime review: final deployment, last-hour window, requested limit 200, 50 records returned, all responseStatusCode 200; tested JWT/secret-key/Bearer patterns absent. Only counts were retained, not raw messages or request values. This bounded sample is not proof that every historical log is secret-free.

## Visual review and limits

All eight requested representative categories were captured after successful protected access and inspected: Homepage AR desktop / EN mobile, Login AR, Signup EN mobile, Customer AR desktop, Request EN mobile, Operations AR desktop, Driver active Trip mobile. Public/owned synthetic data only. The screenshot index records hashes and filenames. Five widths (360/390/768/1280/1440) and both directions were exercised; automated axe is not WCAG certification. A loading-state image is historical from the first rerun and is explicitly not a final active-Trip screenshot.

The evidence covers public signup presentation and existing normal password/session flows. This remediation did not repeat delivery of a fresh external-mailbox confirmation; it does not replace the previously accepted Phase 7 genuine public-registration evidence. It also does not certify every possible server-error state or every long-text permutation on every screen. Broader Sales/Finance/Tracking visual rollout, and the dense secondary live-tracking/notification panels, remain deferred as originally scoped. Owner visual approval is still required before broad rollout.

Main remains `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`; develop remains `e43d3ef806bec9361594d38c6808b63bd348a32c`. No merge, Production, DNS, Hostinger or Phase 8 action was performed. Documentation/evidence-only follow-up must receive its own exact-head CI.
