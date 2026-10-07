# Launch Visual & UX — Stage 1

Status: LAUNCH VISUAL & UX STAGE 1 PARTIAL — REMEDIATION REQUIRED

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
- SQL/RLS local suite passed. Generated-types/concurrency and exact-head CI evidence will be recorded at closeout.
- Protected hosted screenshots, normal staff logout, Customer/Guest/manual-pricing/Operations/Driver regressions and owned-fixture cleanup are pending. The decision must remain PARTIAL until these gates and visual inspection pass.

Dependency security disposition is unchanged: the development-only `braces` advisory remains technically unresolved upstream and is accepted only through the documented scoped owner risk acceptance. This is not a clean dependency-audit claim.

## Required owner-safe visual evidence

Homepage AR desktop; homepage EN mobile; login AR; signup EN mobile; Customer AR desktop; Request EN mobile; Operations AR desktop; Driver active Trip mobile. Capture only public or owned synthetic data, with no passwords, cookies, bearer tokens or secure guest links.
