# PR #14 — Staff Market and context remediation

Reviewed baseline: `53971904d9ae19aa62e1a4f31f8f462a42bc5c5e`.
Target: `develop` at `3f5a80e2a4373f20c0cd57fdae73977ae2c0c52f`.

## Owner-approved scope

The owner retained the prohibition on migration 48 and explicitly approved
temporary server-side containment of Finance views that cannot guarantee the
selected Market. Finance queue restoration is a separate future task requiring
review and authorization before any migration. This correction does not restore
that queue or claim completion of its deferred read model.

## M01 — Sales correction and Finance containment

The shared server-only `staffMarket` resolver first requires the existing
canonical staff permission and single-organization context. It validates the
selected country against an active Market belonging to that organization.
Missing preference defaults to SA; malformed, unavailable, inactive or foreign
Markets fail closed. A country cookie is a preference, never authorization.

Sales now applies organization, Market and submitted-state predicates in the
server query **before** the 100-item limit. The list remains a bounded window,
not a total count. Stable ID ordering breaks timestamp ties. Direct Request
review must pass the same Market predicate before loading details. Pricing,
Quote commands and commercial snapshots are unchanged.

The existing `finance_queue` RPC accepts organization, status and offset, but
not Market; it paginates before returning its JSON array. FINANCE has no direct
Orders/Requests read authority for rebuilding its contact projection. Neither
post-fetch filtering nor scanning all organization pages is an acceptable fix.

Therefore:

- `/portal/finance` authorizes as before, then renders a localized unavailable
  notice on the server without invoking the queue or notifications projection.
- The dashboard does not invoke the organization-wide Finance queue and shows
  the same containment notice instead of filtering its results in memory.
- A single payment detail can still be displayed: the existing Finance-readable
  payments table must match organization, selected Market and order **before**
  invoking the unchanged payment-detail RPC. Missing/cross-scope rows are denied.
- Bank configuration can be safely scoped using existing RLS: require
  `finance.accounts.manage`, constrain organization and Market before its
  30-row limit, and provide only the selected authorized Market to the form.

Payment commands, the existing Finance RPCs, verification, postings, balances,
settlement rules and permission grants remain unchanged. The containment is in
server data loading/rendering, not a hidden link or browser-side filter.

## L01 — Safe workspace context

The server reads the authorized organization's `name` through existing member
RLS and the selected Market's localized name. Only these display strings reach
the shell. No organization UUID, private account identity, email, token,
credential or financial value is added to the context display. Long names wrap.
Membership selection, Auth, role routing and permission semantics are unchanged.

## Regression evidence

- 353 unit/integration tests across 69 files pass locally with two workers.
- New focused tests cover SA-only/EG-only Sales rows; predicates before limits;
  switching/subsequent navigation; invalid, foreign and inactive Markets;
  cross-Market direct Request/payment denial; missing/revoked staff permission;
  restricted bank readers; safe names; and authorized bank Market scoping.
- Server-rendered tests in both languages and both Markets assert that the
  dashboard and Finance queue cannot invoke the unscoped Finance loader.
- Existing canonical-context and Operations command tests remain unchanged.
- Local restricted-role browser regression is extended to assert successful
  Market-change responses, refresh and locale persistence, displayed context,
  and actual Finance containment. Its execution, SQL/RLS, independent concurrency
  and full E2E results must be read from the new exact-head PR CI, not old CI.
- Formatting, lint, strict types, production build and all 60 local E2E tests
  passed. Tracked and history secret-pattern scans passed (heuristic coverage,
  not proof of absence of every secret format). The exact corrective SHA and
  new CI run are recorded in the PR verification update after this commit is
  pushed; historical old-head CI is not substituted for the new run.

Historical intermediate failures are retained: the first local concurrent run
timed out at 30 seconds in the existing market-fixture isolation integration
test (343 pass, one timeout, before the final test additions). No timeout or
assertion was weakened; the final full run with two workers passed 353/353.
An intermediate test-only TypeScript assertion referenced an unselected field;
it was corrected to assert the organization predicate on the query instead.

## Deferred Finance read model — design only

A future proposal may add one narrow read-only Market-scoped Finance queue RPC,
with the same approved row fields, active canonical staff membership,
`finance.read`, explicit organization/active-Market validation and status
predicate, stable ordering, bounded pagination and filtering before pagination.
Tests must include two-Market page boundaries and cross-tenant/revoked access.
Names, signature, SQL, migration number and rollout are **not approved here**.
Do not extend current RPC authority or introduce customer/Orders read grants.

## Change control and review

All 47 migrations and Store architecture remain untouched. No Auth, RLS, RBAC,
payment-command, Driver, Guest or Transport lifecycle implementation changes.
No hosted fixtures or temporary credentials are created for this correction.
Required SQL tests run only in disposable CI/local test databases; no Supabase
cloud SQL or configuration operation is performed.

The prior review remains historical. A new corrective commit invalidates any
old-head approval and requires fresh exact-head CI and independent review.
Finance queue restoration remains blocked by the owner's no-migration decision.
No merge, deployment, Production, DNS or Hostinger action is authorized.
