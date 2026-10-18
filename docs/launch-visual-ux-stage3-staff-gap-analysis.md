# Stage 3 Staff UX gap analysis

Date: 2026-10-12 (Asia/Riyadh). Scope: pre-production Staff / Operations / Finance presentation, not Phase 8.

## Baseline and evidence boundary

- Frozen current application/configuration SHA: `afc34a5cdffa5392e490a8e7259f9214dfd961b4`.
- Accepted develop baseline: `3f5a80e2a4373f20c0cd57fdae73977ae2c0c52f`.
- Canonical protected Preview: `https://naql365-staging-ux-stage3-naql365.vercel.app`.
- Owner now confirms SUPER_ADMIN normal login reached `/ar/portal` on this canonical Stage 3 Preview. Record as owner-operated success, not automated proof of every session gate.
- CUSTOMER/SUPER_ADMIN/DRIVER refresh, navigation, direct-login, logout/Back and cross-role matrices remain formally open. Earlier Stage 2 account success is not Stage 3 evidence.
- This analysis inspects repository source and the owner's portal observations. No new hosted visual acceptance is claimed. All 46 migrations remain immutable. No application, permissions, configuration or deployment changes are made by this analysis.

## Existing route and capability inventory

Routes below have a locale prefix (`/ar` or `/en`).

| Existing page                   | Existing safe source / authority                                                                    | Current gap                                                                                                                        |
| ------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `/portal`                       | `ProtectedShell`, `portalAccess('portal.access')`; per-module checks                                | Static empty-state plus three large links. No operational rows loaded. Not a dashboard.                                            |
| `/portal/quotes`                | `salesQueue()`, `pricing.calculate`, session client + tenant RLS                                    | Submitted Request queue also serves as quote entry; module name hides Requests. Large cards; limited next-action grouping.         |
| `/portal/quotes/[id]`           | `salesRequestDetails()`, existing manual/automated quote commands; guest-link inspect where allowed | Request facts, Sales distance/commercial inputs and quote history need distinct sections; do not alter calculations.               |
| `/portal/operations`            | `operationsWorkspace()`, `operations.manage`                                                        | Orders, Jobs, Trips, Driver/Vehicle resources share one long workspace; resources and planning are poorly discoverable.            |
| `/portal/operations/jobs/[id]`  | `operationalJob()`, `operational_job_summary`                                                       | Needs persistent shell, route context, compact planning/detail hierarchy.                                                          |
| `/portal/operations/trips/[id]` | `operationalTrip()`, `operationalIssues()`, clearance and existing command authority                | Dense stops/assignment/events/issues/POD controls need sections and explicit action feedback.                                      |
| `/portal/finance`               | `getFinanceQueue()` / `finance_queue`, `finance.read`                                               | Existing status filtering and pagination useful; customer ID fallback is technical wording; payment review needs denser hierarchy. |
| `/portal/finance/[id]`          | `getPayment()` / `payment_details`, existing payment commands and proof authorization               | Separate proof evidence, review history, confirmed funds and execution clearance. Keep private proofs on demand.                   |
| `/portal/finance/banks`         | `getBankConfiguration()`, `configure_bank_account`, `finance.accounts.manage`                       | Privileged configuration needs explicit labels/confirmation; must not leak destinations into shell summaries.                      |
| Driver routes                   | Existing dedicated Driver services/pages and assignment rules                                       | Remain separate. Regression review only, no staff authority transfer.                                                              |

No separate implemented staff Requests index, generic Orders detail page, Drivers index, Vehicles index, support dashboard, user-management settings page or global search was found in the portal route tree. Sidebar labels must link to existing sections/workflows, not invented routes or denial pages. Drivers/Vehicles can initially be separate presentation sections of the existing resource workspace.

## Role and module mapping

Source of truth: active membership and `has_permission`, through `portalAccess`, plus existing SQL/RPC authorization. Role names below describe migration grants; implementation must check effective permissions, not names or emails. Resolve one organization context and bind all permission checks/data to it; do not combine grants from different organizations. If existing loaders cannot safely use that same context for a multi-organization identity, fail closed and defer that item rather than broadening a query.

| Role/category     | Existing grants relevant here                                                                                                                       | Safe navigation                                                                                                              |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| SUPER_ADMIN       | portal, pricing.calculate, quotes.manage, operations.manage, dispatch.manage, fleet.manage, finance.read/verify/accounts.manage, guest.links.manage | All implemented modules allowed by effective grants, including bank configuration                                            |
| SALES             | pricing.calculate, quotes.manage, guest.links.manage                                                                                                | Submitted Requests / Pricing / Quotes, existing request-scoped guest-link tools; no Finance/Dispatch link                    |
| OPERATIONS        | operations.manage, dispatch.manage, fleet.manage, pod.read, guest.links.manage                                                                      | Orders awaiting planning, Jobs/Trips/Dispatch, Drivers/Vehicles; no commercial or Finance page links                         |
| DISPATCHER        | operations.manage, dispatch.manage, fleet.manage, pod.read                                                                                          | Same implemented execution/resource routes, actions still checked individually                                               |
| FINANCE           | finance.read, finance.verify                                                                                                                        | Finance queue/payment review; bank settings only if separately granted accounts.manage                                       |
| CUSTOMER_SERVICE  | portal.access, customers.read, requests.read, support.read                                                                                          | No compatible support workspace currently implemented; do not route to pricing.calculate pages or expose guest-link mutation |
| ACCOUNTANT label  | No independent ACCOUNTANT role definition found                                                                                                     | Do not create/alias a role. Existing finance permissions determine visibility                                                |
| CUSTOMER / DRIVER | Separate category/destination                                                                                                                       | No staff shell or module access                                                                                              |

`StaffWorkspaceNav` currently emits Sales, Operations and Finance links unconditionally. Destination guards prevent data access, but the navigation itself is misleading. Replace with server-resolved permission-filtered navigation; retain destination and command checks. `ProtectedShell` currently performs module checks without passing its selected organization, so the future shell must avoid cross-organization link decisions.

## Dashboard source/gap table (before any new projection)

| UI need                                       | Existing safe source                                                                                         | Can reuse                                                                                          | Backend addition required                                                                               |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| Submitted Requests needing Sales attention    | `salesQueue`, SUBMITTED, oldest first, maximum 100                                                           | Yes, bounded work list and count of displayed items only                                           | No for bounded list; yes for organization-wide totals                                                   |
| Quote draft/send/customer-response sections   | Nested quote_versions(id,status,version,total_minor,expires_at) in salesQueue                                | Yes; choose latest by explicit numeric version, not array `.at(-1)` ordering; show actual statuses | No for returned subset; no invented viewed timestamps                                                   |
| Accepted Orders awaiting planning             | operationsWorkspace orders with `jobs(id)`, accepted_at non-null, latest 100                                 | Yes, existing no-job predicate                                                                     | No; cannot claim comprehensive backlog total                                                            |
| Trip assignment / active / completed          | operationsWorkspace trips up to 200 and current assignments up to 500                                        | Yes, retain existing predicates and window-limit wording                                           | No for bounded list; yes for exact all-trip counts                                                      |
| Deliveries completed today                    | Current trip window/status is not a complete delivery/order daily aggregate                                  | Omit                                                                                               | Permission-scoped timezone-aware aggregate only if owner requests it                                    |
| Payment proofs requiring review               | finance_queue existing status filter + latestProof, 30-row page                                              | Yes, actual review states with pagination; count visible rows only                                 | No for queue; yes for total outstanding count                                                           |
| Rejected proof / resubmitted proof            | payment details/history and finance returned state                                                           | Yes, only when explicitly supported by returned facts                                              | No; do not infer resubmission from an ambiguous status alone                                            |
| Unresolved operational issues                 | `operationalIssues(tripId)` limited to a single authorized trip                                              | Yes on trip detail                                                                                 | Cross-trip dashboard queue requires approved bounded read projection; omit from global dashboard        |
| Driver/Vehicle resources                      | operationsWorkspace active flag + current assignments                                                        | Yes for resource list and active/inactive labels                                                   | Availability/conflict-free capacity cannot be inferred; omit availability KPI                           |
| Notifications                                 | `getNotifications`, recipient-scoped RLS, existing InAppNotifications                                        | Reuse existing personal feed only after permission behavior verified                               | No fabricated count/global feed; broader feed requires approval                                         |
| User context/logout                           | canonical access principal and existing explicit customerLogout primitive                                    | Show safe localized role/category; reuse existing identity presentation if available               | Do not add profile/account mutation or broaden profile reads                                            |
| Support-safe Requests / guest-link operations | CUSTOMER_SERVICE has read grants but no safe implemented support loader/page; guest.links.manage excludes it | Not via Sales loader or by granting a role implicitly                                              | Owner decision required for a dedicated scoped support read model; mutation authority remains unchanged |

All sums/counts must be marked as the current displayed result window, not business totals. Do not fetch every page, join unrelated private data, or execute one query per trip to manufacture a dashboard aggregate. Market filtering applies to already-authorized rows and does not establish authorization. Finance's 30-row page has no current server Market filter; any local Market filter must explicitly describe its loaded-page scope, not pretend to search the entire queue.

## Deficiencies and proposed presentation corrections

| Classification                    | Observed source/owner evidence                                                                 | UI-only correction                                                                                                                                                                     |
| --------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Navigation / inconsistent design  | Locale layout always wraps staff in public marketing Header/Footer; no dedicated portal layout | Staff presentation shell with a persistent collapsible sidebar, topbar and compact workspace. Preserve locale root, CSP, HistoryRefresh and route guards. No duplicate main landmarks. |
| Information hierarchy / usability | Portal is a mostly-empty Card with static EmptyState                                           | Permission-filtered bounded work sections, direct workflow links, legitimate empty states per module                                                                                   |
| Navigation                        | Subnavigation exposes denied destinations                                                      | Permission-filtered module model; authorize server-side before fetching each module                                                                                                    |
| Responsiveness                    | Multiple modules/forms share tall pages                                                        | Compact desktop rows, mobile cards or contained table scroll; drawer at small widths, logical RTL spacing                                                                              |
| State clarity                     | One status can stand in for multiple commercial/payment/execution facts                        | Localized semantic badges with text/icon; separate Quote, proof, payment and execution clearance                                                                                       |
| Technical wording                 | Finance fallback exposes customerId; raw identifiers can dominate controls                     | Localized unavailable-name fallback, business reference primary, retain technical IDs only internally                                                                                  |
| Missing feedback                  | Commands and forms spread across sections                                                      | Shared busy, success, validation summary, error/retry and confirmation presentation around existing commands                                                                           |
| Accessibility                     | No cohesive sidebar/drawer interaction model                                                   | Keyboard operation, Escape/return focus, current-page labels, visible focus, touch targets and form error associations                                                                 |
| Usability                         | Unsorted nested versions may cause misleading queue badge                                      | Select maximum explicit version from returned facts; preserve immutable snapshots and lifecycle                                                                                        |
| Information hierarchy             | Resources are mostly buried create/manage forms                                                | Separate Driver/Vehicle list sections before creation/edit controls; keep fleet/manage checks                                                                                          |

Do not call missing route optimization, ETA, global search or advanced analytics a visual defect. They are outside scope. No Naqlk assets/layout/copy imported; benchmark comparison is conceptual and not a new verified live audit.

## Exact implementation scope possible without backend expansion

1. A staff-only shell: compact navy sidebar, white topbar, breadcrumb/page context; desktop collapse, tablet/mobile accessible drawer. Preserve Deep Navy #0B1F33, Electric Blue #1677FF, Cyan #22C7E8 accents, #F5F7FA background, Alexandria/Inter. Do not force large rounded cards onto dense workflows.
2. Reuse current canonical permissions for each visible module and action. Reuse existing SA/EG selector semantics; preserve safe locale context without copying sensitive fragments. No fake search/notification bell. Use existing explicit logout unchanged.
3. Compose portal attention panels from existing authorized Sales, Operations and Finance functions, only after matching module permission succeeds. Display bounded queues; avoid KPI totals. Do not call unauthorized loaders and then hide their output client-side. Never move a service-role client into runtime.
4. Separate Requests/Quotes and Orders/Trips/resources in navigation using existing destinations and section anchors; refine list/filter/detail layouts and loading/error states. New presentational route wrappers, if needed later, must reuse exactly the same authority/data and cannot introduce new data queries.
5. Refine Sales facts vs manual commercial entry, Finance proof vs confirmed payment, Operations plan vs execution states. Existing commands, revision/idempotency fields, calculations and confirmations remain unchanged.
6. SUPPORT: honest role-safe landing with only currently implemented permitted tools. No false support queue, Sales denial link, role upgrade or promise of support completeness. See owner decision below.

## Backend decision boundary and smallest optional proposals

The core staff shell and bounded queues can proceed without migrations or new query authority. The full requested CUSTOMER_SERVICE experience cannot currently be delivered through an existing compatible application projection. Consequently the overall gap-analysis status requires an owner backend decision, while the UI-only subset above remains independently feasible.

- Support proposal, not implemented: one paginated read-only request-summary projection, session-authenticated, active organization membership + `support.read` AND `requests.read`, explicit tenant and Market validation, capped page size/cursor. Return business reference, approved customer-safe contact/context, service/route summary and current journey label only after field-level owner review. No bank destinations, private proof paths, guest capability, internal pricing reasons or Driver private data. It must not grant `guest.links.manage`; any support link mutation authority is a separate decision.
- Optional exception queue, not implemented: permission-scoped read-only bounded issue summary using existing operations authority, tenant/Market filters, trip reference and issue category/status; no private photos or driver location. Omit until separately approved.
- Global totals/availability are not prerequisites for a credible first dashboard. Omit rather than request broad aggregate authority.

Owner choices: approve the UI-only shell/queues with support and global metrics deferred, or separately review the smallest support read projection. No SQL/RPC/schema expansion is authorized by this document.

## Acceptance plan and remaining gates

Before declaring any Auth closeout, complete canonical Stage 3 CUSTOMER, SUPER_ADMIN and scoped DRIVER normal password/session matrices, direct login, public/locale/Market navigation, refresh, cross-role denial, explicit logout, Back and protected denial. Keep Stage 2 control separately identified. Never test password login via unapproved immutable Vercel URL or broaden callbacks.

After UI implementation: synthetic role-specific dashboard/Requests/Quotes/Operations/Finance/resources matrices, AR/EN, RTL/LTR at 360/390/768/1280/1440. Cover actual loading/empty/validation/error/retry/success states, keyboard/focus/drawer behavior, axe smoke (not WCAG certification), no page overflow and no sensitive captures. Test existing permissions using restricted roles, not only SUPER_ADMIN. DRIVER experience receives regression only. Preserve SQL/RLS/types/concurrency, commercial/manual-pricing, Customer/Guest and Finance/Operations/Driver regression; full unit/E2E/lint/types/build/secret scans and exact-head CI after implementation. Ledger and clean only owned fixtures, revoke temporary credentials and retain protected Preview.

Existing 279 unit/integration, 40 E2E and CI 38164851603 are historical results for afc34a5; they do not certify a future shell redesign. No new implementation test PASS is claimed here.

## Decision

STAGE 3 STAFF UX GAP ANALYSIS COMPLETE — OWNER BACKEND DECISION REQUIRED

Core UI work can reuse current bounded projections. CUSTOMER_SERVICE support read experience requires either explicit deferral or separately approved scoped backend work. Stop before backend/schema expansion. No application implementation, migration, Auth change, Production deployment, main/DNS/Hostinger change or Phase 8 work performed in this analysis.

## Owner decision and implementation checkpoint — 2026-10-12

The owner subsequently approved the reusable UI shell/queues and exactly one additive support projection (migration 47). Global totals, exception aggregation and resource-availability KPIs remain deferred. The earlier decision above is retained as historical analysis, not a current blocker to this approved scope.

Implementation uses one active staff organization context; ambiguous memberships fail closed. Module links are gated by effective permissions in that organization. Sales, Operations and Finance reuse their existing capped sources. Dashboard Market filtering is presentation-only on those authorized rows; displayed counts are explicitly not organization totals. CUSTOMER_SERVICE receives only the newly approved support read projection, requiring both support.read and requests.read. There are no new mutation grants, Auth/session changes, pricing/payment rules or lifecycle changes.

The sole new SQL file is `20261012000100_support_request_queue.sql`. Migrations 1–46 remain unchanged. The support page returns approved contact/reference/service/city/journey fields, with a paired keyset cursor and at most 30 items. Its pagination identifier is metadata, not an authorization capability or primary UI label.
