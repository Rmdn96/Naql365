# Testing strategy

## Commands and contracts

| Command                  | Coverage                                                                      |
| ------------------------ | ----------------------------------------------------------------------------- |
| npm run lint             | Next, React, TypeScript, accessibility and domain import boundaries           |
| npm run typecheck        | Generated Next route types + strict TypeScript                                |
| npm run test / test:unit | Vitest pure services and embedded PostgreSQL integration                      |
| npm run test:db          | Same SQL security assertions on complete Supabase via pgTAP                   |
| npm run test:e2e         | Built app in Chromium desktop/mobile, both locales, accessibility and routing |
| npm run build            | Production Next build; requires APP_URL                                       |
| npm run check:secrets    | Tracked environment and known credential-pattern scan                         |

Unit tests cover fail-closed authorization, adapter failure, malformed tenant context, unsafe redirects, localized utilities/dictionary alignment, error redaction and environment validation. Database tests use real PostgreSQL via PGlite locally, with minimal auth/storage schema contracts; the CI job uses complete Supabase services and executes the exact same rollback SQL. The latter is authoritative for Supabase compatibility.

Database assertions verify: automatic profile creation without metadata privileges; tenant/customer isolation; subordinate request records; private object visibility; customer denial to staff/finance/audit resources; tenant-scoped SUPER_ADMIN; explicit permission checks; denied direct mutations/escalation/audit forgery/upload; immediate suspension; anonymous denial; cross-tenant FK failure; versioned quote acceptance uniqueness. Test records use synthetic UUIDs and roll back entirely.

E2E checks root Arabic routing, English switching, html direction/language, canonical URLs, CSP, mobile overflow, noindex on protected shells, invalid locale 404, callback redirect failure, native modal Escape/focus return and axe WCAG 2/2.1 AA checks for both locales. Run on a clean production build with no real credentials; authenticated provider sessions require a separate isolated staging smoke test.

## CI

GitHub Actions executes install, secret scan, lint, types, tests, production build and E2E in one job. A second job starts Supabase, resets the local database, runs RLS tests, generates SDK database types and typechecks adapters again. No continue-on-error, disabled compiler errors or ignored lint failures. Reports/types are uploaded as artifacts. Jobs are bounded and duplicate runs are cancelled for the same branch.

Do not interpret workflow YAML as a passing workflow: inspect the actual run for the exact committed SHA. If a runner/service cannot start, report infrastructure failure separately from assertion failures, then resolve or document the blocker.

## Phase 3 verification

`supabase/tests/phase3.test.sql` exercises multi-Trip execution, assignment history, active resource conflicts, required pickup order, POD, aggregate completion and negative authorization. `scripts/test-operations-concurrency.mjs` requires the named disposable LOCAL Supabase container and uses independent PostgreSQL connections; it is included in CI after pgTAP. It must not be pointed at Staging or Production. An unexecuted concurrency harness is not PASS evidence.

`node scripts/staging/verify-phase3.mjs` creates controlled identities and runs `playwright.phase3.config.ts` against an explicitly verified protected Preview. It uses the existing secret-redacting reporter with screenshots, traces and video disabled. The harness includes a real customer wizard, Sales Quote and customer acceptance before operations. All fixture cleanup is scoped to its created identities and their records. The canonical Phase 3 report records executed coverage, counts and limitations; do not infer acceptance from the presence of test code.

The default Phase 3 run includes the complete operational journey and authenticated bundle inspection. `--assets-only` runs just the supplemental bundle check and cannot establish operational acceptance. SDK probe sessions use local sign-out so they do not revoke the independently authenticated browser session. Hosted network assertions have bounded deadlines; no failed assertions are retried automatically or suppressed. The cleanup removes the isolated fixture organization's creation audit as well as actor-scoped records before deleting that organization.

Cross-customer tracking tests assert the localized not-found content, absence of the Order reference in HTML, a denied customer-progress RPC and empty direct RLS reads. They accept either HTTP 404 or the documented HTTP 200 used after streaming begins; status alone never establishes authorization. See [Next.js not-found response semantics](https://nextjs.org/docs/app/api-reference/file-conventions/not-found).

## Phase 2 acceptance

`npm run test:staging:phase2` requires an explicitly verified protected Preview and the allowlisted healthy Supabase Staging project. It creates disposable customer, Sales and peer identities, verifies the commercial journey and negative access, and cleans its scoped records in finally. Never run hosted suites concurrently. The shared SQL assertions execute against PGlite, complete Supabase in CI and hosted Staging. A separate TAP footer reports completed assertions to the Supabase runner; embedded/hosted SQL runners omit only that reporter footer, not security assertions. Phase 1 and Foundation hosted regression must target the same Phase 2 Preview.

## Phase 3.5 verification

`tests/unit/markets.test.ts` covers explicit currency, contact normalization, IANA winter/summer offsets, DST gaps/overlap and local month boundaries. Shared market SQL covers the same customer in SA/EG, pricing/tax isolation, inactive coverage, forbidden overrides, branch/resource relationships and domestic routes. The upgrade and fixture-isolation tests cover both historical commercial preservation and pre-existing configuration.

The existing `node scripts/staging/verify-phase3.mjs` entry point now runs both SA and EG end-to-end journeys and authenticated bundle checks on the SAME protected Preview. Each market creates a request, accepted quote/order, two trips, four stops per trip and private POD; negative role/tenant/market/resource probes remain enforced. The planner round-trips a winter wall time to different SA/EG UTC instants, then restores the operational test schedule. The same disposable customer identity is reused for both countries. Old Phase 1/2 hosted entry points remain Saudi regression and now explicitly select their market/city IDs.

Use the guarded runner, never launch privileged tests with hardcoded credentials. Screenshots/traces/video remain disabled, safe reporting emits no credential values, and cleanup removes disposable identities/business data/private files. Temporary Vercel automation credentials must be revoked after all suites finish. Test definitions alone are not PASS evidence; consult the report for actual executions.

## Phase 5 verification

`tests/integration/live-tracking.test.ts` covers publication authority, strict validation, anonymous/role/tenant denial, replay/order/rate protection, private history bounds/retention, reassignment, notification ownership and terminal cleanup. `tracking-upgrade.test.ts` reconstructs the accepted populated twenty-five-migration baseline before applying the additive migrations and compares historical facts. Official Supabase CI generates the public types and requires an exact diff.

`scripts/test-tracking-concurrency.mjs` uses independent PostgreSQL connections alongside the retained Operations/Driver harnesses. It checks duplicate/newer/older/concurrent publications, Dispatcher reassignment, old-Driver revocation and a twenty-request burst across two active Trips. The burst must produce exactly two authoritative writes.

The guarded Phase 5 hosted runner reuses the full Phase 4 journeys, then adds foreground browser GPS, real positive/negative WebSocket delivery, suspended-reader revocation, notification ownership, stale/recovery, map tiles/attribution and honest ETA unavailability. It disables traces/screenshots/video, uses safe diagnostics and runs explicit scoped cleanup. A test definition is not acceptance evidence; use the canonical report for results and limitations.
