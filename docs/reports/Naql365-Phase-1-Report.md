# Naql365 Phase 1 — Customer Identity & Request Intake MVP

Date: 2026-09-10  
Scope: Phase 1 only; no Production deployment and no Phase 2 work

## A. Starting State

The accepted Phase 0/0.5 foundation was integrated through protected PR #1 before Phase 1 began. The repository was clean and the Phase 1 branch did not inherit uncommitted work. Supabase Staging and the protected Vercel Preview project already existed; Production was outside the task.

## B. Git / Merge Baseline

PR #1 targeted `develop`, had an independent APPROVED review on accepted commit `57d32d146e4d18ddbde372db9b85bfe420f78825`, both required CI checks passed, and GitHub reported a clean merge state. A protected rebase merge produced remote develop `388c6953b6759657e0748de1aae7c8b2b41bb19e`. Its tree exactly matched the accepted Phase 0.5 commit, with Phase 0 commit `184ac23` preserved as an ancestor. `feature/phase-1-customer-request-intake` was created and pushed from that fetched develop.

Develop remains protected by one approval, last-push approval, stale-review dismissal, strict required checks, conversation resolution, linear history and admin enforcement. Direct pushes, deletion and force pushes remain disabled. Phase 1 was not merged.

## C. Architecture Changes

The existing modular Next.js application remains one deployable unit. New presentation routes/components call application-safe user-scoped infrastructure services. Shared Zod schemas and request rules reside in `src/domain/requests`; PostgreSQL owns tenant membership, roles, request state, revisions, reference allocation and immutable submission. React contains interaction state only.

Server-rendered account/list/detail pages keep customer data off shared client caches. Client JavaScript is limited to identity forms and the eight-step wizard. Cookie-authenticated route handlers enforce bounded bodies and same-origin mutations. No application service-role client was added.

## D. Schema Gap Analysis

The analysis was committed before migration work in `docs/customer-request-intake.md`. Phase 0 already supplied Auth profiles, organizations/memberships, CUSTOMER RBAC, request/file skeletons, private buckets, audit and default-deny RLS. It lacked confirmed onboarding, active bilingual catalogues, request state/revision/reference, normalized route/property/options, usable item fields, controlled private uploads and customer write commands.

The selected lifecycle uses the existing operating-organization model. A private operator-managed enrollment record selects the organization; customers cannot provide tenant or role identifiers. Pricing, quotes, orders, dispatch and all later workflow concepts were excluded.

## E. Migrations

Three additive migrations were added and applied in repository order:

- `20260910000100_customer_request_intake.sql`: onboarding, active bilingual catalogues, normalized request locations/additional selections, request state/revision/idempotency/reference, validated commands, RLS and audit events.
- `20260910000200_storage_upload_completion_guard.sql`: operation-aware private upload preflight and a serialized Storage completion guard.
- `20260910000300_request_revision_conflict.sql`: uses PostgREST's explicit `PT409` mapping for permanent stale-revision conflicts. SQLSTATE `40001` was removed because hosted PostgREST treats it as retryable serialization failure.

Staging history contains all six repository migrations. Reconstruction tests apply the same migrations to fresh PostgreSQL in CI. Hosted assertions passed on 40 public tables with RLS enabled on 40/40; generated SDK types matched without a residual diff.

## F. Customer Identity

Localized registration, email confirmation, login, logout, session persistence and password recovery are implemented with Supabase SSR and PKCE. Registration creates identity/profile only. Generic results prevent account enumeration; the browser cannot supply redirect, tenant, role or privileged metadata. Recovery selects an exact locale-safe callback and global sign-out follows password change.

A real controlled Staging mailbox completed self-registration and the real confirmation link on the Phase 1 Preview. The link was verified to belong to the independent Staging Supabase project before navigation. PKCE exchange reached `/ar/account`, and a server session was established. The address, password, link, tokens and cookies were never written to Git or this report. Recovery callback construction and server behavior are automated; a separate mailbox recovery-delivery loop was not needed for a critical gate.

## G. Customer Onboarding

`onboard_customer` requires `auth.uid()`, a confirmed Auth record and private enrollment configuration. It locks the profile, normalizes profile data, establishes the existing operating-organization customer membership/record, grants only CUSTOMER and audits the event transactionally. Retry is idempotent and suspension is never reactivated. Hosted journeys performed onboarding in both locale/device projects.

## H. Request State Machine

The implemented transitions are `DRAFT → SUBMITTED` and `DRAFT → CANCELLED`. Submitted and cancelled data cannot be edited. Commands lock the row, verify active membership and ownership, validate operation-specific payloads, compare the expected revision and retain the last mutation ID for safe response retries.

## I. Request Reference

Submission allocates `N365-YYYYMM-NNNNNN` from a Riyadh-month counter using row-safe `INSERT … ON CONFLICT UPDATE`, never `MAX()+1`. Allocation, transition and audit occur in the same transaction. A repeated submit returns the assigned reference without creating another submission.

## J. Wizard

The bilingual responsive wizard contains the requested eight stages: service, pickup/delivery, shipment/items/images, property, additional services, schedule, contact and review. Service/property relevance and active option identifiers are read from the tenant catalogue. Pickup and delivery are separate normalized concepts. Review renders the persisted draft before submission.

## K. Draft / Autosave

Draft creation uses a client-generated idempotency key and enforces twenty open drafts per customer. Autosave waits 750 ms, serializes writes, captures changes made during a pending save and reuses its mutation ID after a network failure. Stale revisions surface a visible conflict and never overwrite. Internal navigation flushes unsaved changes; unload warns. Hosted refresh/resume restored route and item data from PostgreSQL.

## L. Attachments

Phase 1 accepts JPEG, PNG and WebP request images only, up to 3 MiB and eight per draft. The server checks content length, file bytes and MIME signature; paths are generated and bound to tenant/owner/request. Storage stays private. Reservation, upload, finalization and two-phase removal prevent readable partial or removing objects. A database trigger locks request/reservation state when Storage completes, closing a submit/upload race and finalized overwrite path.

Hosted tests uploaded a harmless PNG through the application, read it through the authenticated signed-download route, denied access after logout, cancelled another draft, removed its private bytes/registry entry and proved the cancelled request could not return to the wizard. Foundation hosted tests independently proved peer/cross-tenant/public denial and sixty-second signed URL expiry. No malware scanner is implemented or claimed.

## M. Submission Transaction

Submission validates the persisted service, two complete locations, shipment description/items, schedule, contact and ready attachments. It atomically assigns state/reference/time and writes a payload-free audit event. Hosted tests proved the reference remains stable after refresh and customer edits return denial after submission.

## N. My Requests

The customer list is server-rendered, ownership-scoped and bounded to twenty rows per page with a maximum page input. It displays draft/submitted/cancelled states, references when assigned and localized resume/detail links. Hosted acceptance opened the submitted request from this list.

## O. Request Details

The server-rendered detail reads only the authenticated customer's request and normalized children. Unknown or peer identifiers return unavailable/not found. Submitted and cancelled routes render immutable details; only draft routes render the wizard. Private attachments use identifier-based signed redirects rather than browser-supplied paths.

## P. RLS / Authorization

Hosted negative acceptance proved anonymous creation rejection, same-tenant customer IDOR rejection, cross-tenant rejection, mass-assignment rejection, stale-write conflict, incomplete-submit rejection, submitted-edit rejection and immediate suspension denial. A CUSTOMER did not gain `portal.access`; supplied `SUPER_ADMIN` metadata granted no role. Direct membership promotion and audit insertion failed. Protected routing remained server-authoritative with an otherwise-valid session.

## Q. Audit

Transactional events cover customer onboarding, request creation, submission, cancellation and protected identity/file milestones where appropriate. Request started/completed metadata is payload-free. Customers cannot read or forge audit records. Existing immutable audit triggers remain active for role and core entity changes.

## R. Accessibility

Hosted axe checks reported zero WCAG 2 A/AA/2.1 AA violations on Arabic/English public pages, login, customer account and request review for desktop/mobile coverage. Tests also verified labels, headings/landmarks, keyboard focus, no horizontal overflow, Arabic RTL and English LTR. The eight-step controls use native labelled inputs/selects/buttons and visible focus tokens.

## S. Security

The accepted Preview retained nonce CSP, `frame-ancestors 'none'`, HSTS, nosniff, restrictive permissions policy, noindex and private/no-store protected responses. Hostile callback destinations returned localized login. Every DOM-observed script was inspected in the Node test process: no admin/test credential or source-map directive appeared. Vercel logs contained no recognized secret/token query pattern; raw logs were never printed.

Vercel contains four Naql365 variables in Preview only: public `NEXT_PUBLIC_SUPABASE_URL`, public `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, server-only `APP_ENV`, and server-only `STAGING_AUTH_SMOKE_ENABLED`. The public URL/key were independently matched to Supabase Staging. Development and Production contain no Naql365 variables. No service-role, database password or management token exists in the deployment configuration.

## T. Tests

- Unit/integration: 85/85 passed across 11 files, including domain validation, redirects, identity actions, signed files and sanitized 409 mapping.
- Local browser: 18/18 passed on desktop/mobile.
- SQL/RLS: both shared SQL suites passed on hosted Staging and fresh CI Supabase.
- Phase 1 hosted journey: 6/6 passed (three scenarios on desktop and mobile).
- Foundation hosted regression: 12/12 passed on desktop/mobile.
- Hosted service verification: password Auth, refresh/revocation, permissions, RLS and Storage all passed.
- Formatting, secret scan, lint, strict typecheck and production build completed without a critical failure.

CI run [34478118831](https://github.com/Rmdn96/Naql365/actions/runs/34478118831) passed both required jobs on code/test commit `2f6699b68553a8737d118a7f0d21deabb46705bd` without ignored errors. An earlier hosted run exposed the incorrect `40001` conflict mapping; it was fixed by the third additive migration and the complete hosted suite then passed.

## U. Hosted Staging Acceptance

Accepted Preview: https://naql365-staging-iiyfses3k-naql365.vercel.app  
Deployment: `dpl_6eRYjg9oJE82xqjTmzcQ6TvDEuAg`  
Classification/state: genuine Vercel Preview (`target: null`), READY  
Application source: `ebd2a63a156a022953c6625701889630c59c2016`

The commits after the deployed source contain only hosted test expansion, exact Auth/deployment documentation and this report; application runtime files are unchanged. Deployment Protection remains enabled and no Preview was promoted. The exact Site URL and four explicit AR/EN account/recovery callbacks point to this Preview. The bootstrap is not acceptance evidence and no Production resource was connected.

## V. Data Cleanup

Each automated suite cleaned exact generated users, memberships, customers, requests, normalized children, private objects, audit fixtures and temporary organizations in `finally`. The controlled mailbox identity was confirmed to belong to this test window, then deleted after its session evidence was recorded. Required roles, permissions, operating-organization enrollment and five service/five extra catalogue rows were retained as configuration. No real customer, payment, messaging or Production data was created or modified.

## W. Files Changed

The branch changes 57 files before this report: 34 additions and 23 updates, with approximately 4,049 added and 41 removed lines. Main groups are database migrations/assertions/types; identity and request routes/components/services; guarded tests; and canonical documentation.

## X. Commits / CI

Logical Phase 1 commits before this report:

1. `2d5777f` — record protected baseline and schema gap analysis.
2. `03ad44b` — transactional customer intake and private attachment lifecycle.
3. `98b18bf` — bilingual customer identity and persisted request journey.
4. `b2d2988` — guarded hosted journey and abuse acceptance.
5. `0c9ae5d` — hosted schema types and acceptance formatting.
6. `54f6f32` — navigation-save and Storage completion race safeguards.
7. `80669bc` — bounded HTTP conflicts for stale draft revisions.
8. `ebd2a63` — identity lifecycle and Staging operation documentation.
9. `2f6699b` — private download and cancelled attachment cleanup acceptance.

Required CI on `2f6699b`: PASS, run 34478118831. The final report-only commit is also pushed to the same feature branch and must remain subject to the same checks before review.

## Y. Known Limitations

- Image signature/type/size checks are implemented; malware scanning is future hardening.
- The self-registration enrollment setting currently selects one operating organization. It is tenant-safe but not a customer-created multi-tenant SaaS signup flow.
- Autosave requires connectivity; browser local storage is not an authoritative offline database.
- Vercel deployment is operator-controlled CLI because automatic Git deployment is not connected.
- Preview Auth callbacks require exact-origin rotation when a replacement Preview is accepted.
- Password recovery implementation/configuration is verified automatically; this run did not repeat a second operator-assisted mailbox delivery after the real registration confirmation flow.

## Z. Deferred Items

Phase 2+ remains fully deferred: Smart Quote, pricing/rules, quote acceptance, orders/jobs/trips workflow, dispatch, driver workflows, GPS, payments, WhatsApp/SMS/email notification delivery, AI, marketplace and SaaS billing. PDF request attachments, malware scanning, multi-stop customer intake and offline editing are also deferred.

## AA. Acceptance Matrix

| Gate                  | Result | Evidence                                                                     |
| --------------------- | ------ | ---------------------------------------------------------------------------- |
| Git baseline          | PASS   | Protected PR #1 rebase to develop `388c695`; exact accepted tree             |
| Schema/migrations     | PASS   | Six ordered migrations; hosted history and fresh CI reconstruction           |
| Customer registration | PASS   | Real controlled mailbox registration and confirmation on Preview             |
| Authentication        | PASS   | Real PKCE session plus hosted password login/refresh/logout/revocation       |
| Customer onboarding   | PASS   | Transactional RPC; hosted AR/EN journeys                                     |
| RBAC                  | PASS   | Fixed CUSTOMER grant; metadata/email/staff access denied                     |
| Request Draft         | PASS   | Idempotent hosted creation and persisted draft                               |
| Autosave              | PASS   | Hosted save, refresh/resume and bounded conflict behavior                    |
| Request wizard        | PASS   | All eight stages completed in AR desktop and EN mobile                       |
| Attachments           | PASS   | Private image upload/read/logout denial/cancel cleanup plus isolation/expiry |
| Submission            | PASS   | Atomic submit, incomplete denial and immutable post-submit payload           |
| Reference generation  | PASS   | Atomic monthly counter; stable idempotent reference                          |
| My Requests           | PASS   | Hosted submitted record opened from owned bounded list                       |
| Request Details       | PASS   | Hosted immutable owned detail; peer routes denied                            |
| RLS                   | PASS   | Shared SQL and real-JWT negative tests; 40/40 public tables enabled          |
| Tenant isolation      | PASS   | Hosted cross-organization REST/request/file denial                           |
| Customer isolation    | PASS   | Hosted same-tenant peer request/file denial                                  |
| Accessibility         | PASS   | Zero axe violations on covered hosted surfaces                               |
| Mobile                | PASS   | iPhone-sized public/auth/intake/negative/cancel coverage                     |
| AR/EN                 | PASS   | Hosted Arabic desktop and English mobile journeys plus both public locales   |
| Security              | PASS   | CSP/headers/redirects/cookies/bundles/logs/Storage checks passed             |
| CI                    | PASS   | Required jobs passed in run 34478118831                                      |
| Hosted Staging        | PASS   | Genuine protected READY Preview; 6 intake + 12 regression tests passed       |
| Cleanup               | PASS   | Synthetic and controlled-mailbox fixtures removed; catalogues retained       |
| Scope compliance      | PASS   | No Production, Phase 2 feature or merge to main/develop                      |

Critical gates contain zero BLOCKED and zero PARTIAL results.

## AB. Final Decision

**PHASE 1 PASS — READY FOR REVIEW**

This decision authorizes review of the feature branch only. It does not start Phase 2, merge Phase 1 or deploy Production.
