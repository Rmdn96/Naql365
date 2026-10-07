# Manual Pricing & Launch Coverage — Owner Review

Baseline: `2b0639824442857408844a916d96c170b52984e4`. Approved analysis: `a235b85b481ae44bf3ae37fd16bc43c4d9d62949`. Branch: `feature/preproduction-manual-pricing-coverage`. This is pre-production product completion, not Phase 8. No merge is authorized by this report.

## Architecture and upgrade

Migration 46 is `20261007000100_manual_pricing_directional_coverage.sql`. Migrations 1–45 are unchanged against the accepted develop baseline. The fresh database has 46 migrations.

Existing `pricing_settings` rows receive AUTOMATED without changing existing commercial configuration; subsequently created settings default to MANUAL. Historical evaluation-backed pricing details receive AUTOMATED provenance. No quote/order monetary, currency, tax or distance snapshots are rewritten. Populated 45→46 tests compare complete quote/order/evaluation/item/distance JSON before and after upgrade. Existing coverage retains both directions during schema upgrade; new rows default to neither direction. Existing organization-wide add-ons are backfilled across the existing Market/service combinations only.

The migration is not a commercial launch switch. After local and exact-head CI passed, the guarded Staging configuration script explicitly set SA and EG to MANUAL and authoritative readback confirmed both. Hosted Staging previously had 44 migrations; accepted migration 45 and new migration 46 were applied through the supported migration CLI. The deployment identity table remains empty; no Production marker or manifest was created.

## Pricing authority and provenance

- Organization/Market pricing mode is database configuration, independent of locale, email, hosting provider and client flags.
- MANUAL or missing configuration returns only `WAITING_FOR_REVIEW` from the guest preliminary projection, even when a historical automatic evaluation exists. Registered Customer RLS excludes evaluations and private pricing details. AR/EN copy says Pricing under review / السعر قيد المراجعة. Final sent Quote and accepted Order values remain visible through existing authorized projections.
- The automated engine is preserved. Explicit isolated AUTOMATED fixtures exercise its previous calculation and quote behavior. Recording manual verified distance does not invoke pricing rules.
- `create_manual_quote_draft` verifies Sales authority, Request and expected revision, integer minor-unit subtotal, validity, distance facts and mutation identifier. Organization, Market, currency, effective tax and final tax/total are derived in the database. Existing integer rounding is preserved.
- Mode-dependent CHECK constraints require real evaluation/calculation facts for AUTOMATED and author/revision/manual subtotal/input facts for MANUAL. No dummy or zero evaluation is created. Manual provenance and mutation records are private.
- Request locks, configuration locks and durable mutation replay protect retries/concurrency. Draft revision, sending, quote response and exactly-one accepted Order reuse the existing commercial workflow. Sent/superseded/accepted values are preserved across later pricing-mode changes.
- Customer, Guest, Driver, unprivileged Operations and other-tenant Sales cannot author manual pricing. No direct client table-write grants were introduced. Finance verification and execution clearance remain unchanged.

## Coverage and catalogue

`service_areas.active` remains the master availability flag. `pickup_eligible` and `delivery_eligible` express direction per organization/Market/service/city without route pairs. One shared server predicate validates both registered and Guest submissions, including stale wizard selections and add-on applicability.

The launch configuration allows Riyadh and Cairo as pickup/delivery hubs and the representative domestic destinations as delivery-only. Cross-Market, reverse, inactive, forged and unsupported selections are denied server-side. A 36-case matrix exercises both identities and Markets, including a third synthetic destination in each isolated local Market.

The separate [configuration inventory](../launch-coverage-configuration-inventory.md) records actual Staging cities: Riyadh/Jeddah and Cairo/Alexandria. This is not nationwide coverage. An owner-approved supported-city inventory and operational activation are still required before advertising all cities. No Production city activation occurs in the migration.

Existing services/add-ons are reused. Staging explicitly adds household and office relocation service records and unpacking, alongside cargo/furniture and packing/loading/unloading/dismantling/assembly. `service_addon_applicability` scopes options by Market/service. The controlled four-service setup disables irrelevant applicability before enabling supported options; furniture dismantling/assembly are not activated for general cargo. Production availability remains a separate owner-controlled configuration task.

## Validation evidence

| Gate                                      | Result and scope                                                                                                                                                |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local unit/integration                    | 269 PASS / 49 files, including manual revision/provenance, authorization and 36 directional cases                                                               |
| Local browser E2E                         | 32 PASS, desktop/mobile AR/EN                                                                                                                                   |
| Format / lint / strict TypeScript / build | PASS; final closeout CI also reruns these gates                                                                                                                 |
| Fresh reconstruction / populated upgrade  | PASS; 46 migrations; historical snapshots unchanged                                                                                                             |
| SQL / RLS / official types                | PASS locally and hosted; all 60 public tables have RLS; hosted public types match canonical CLI types                                                           |
| Independent-connection concurrency        | PASS: Operations, Driver, Tracking, Payment, manual quote and Guest suites                                                                                      |
| Manual races                              | Duplicate draft/send/accept; conflicting retry; request revision versus draft; mode change versus draft; exactly-one Order                                      |
| Source/history credential scans           | PASS, heuristic patterns; not proof against every possible secret encoding                                                                                      |
| Implementation exact-head CI              | [37617321428](https://github.com/Rmdn96/Naql365/actions/runs/37617321428), PASS on `237937804d8779b235f9052f1fa6b632d36e68ab`                                   |
| Final closeout CI                         | Required on the final branch HEAD; exact SHA/run is recorded in the owner handoff. Closeout changes after the hosted application commit are tests/evidence only |
| Hosted browser regression                 | 8/8 complete test groups PASS on one protected Preview                                                                                                          |
| Hosted cleanup                            | PASS; owned fixtures removed, original Customer rows preserved, temporary automation credential revoked                                                         |

Protected Preview: <https://naql365-staging-manual-pricing-naql365.vercel.app>. Full hosted suite deployment: `dpl_64LrhiJNNtrHAWBjMZkePUvfteBP`, application SHA `237937804d8779b235f9052f1fa6b632d36e68ab`. Vercel Preview, never Production. Anonymous requests redirect to the Vercel SSO gate. The application, migration, dependency and deployment-manifest content must remain identical when a documentation/test-only closeout commit is redeployed; that redeployment does not imply the full suite was rerun.

The eight hosted groups prove SA Guest → manual Quote → CASH → Driver execution/POD; EG Guest → manual Quote → synthetic transfer destination → proof rejection/reupload → Finance confirmation → Driver execution/POD; Guest Quote rejection without Order; SA and EG registered Customer manual Quote/CASH/session/unauthorized mutation denial; Arabic and English public mobile/accessibility/Market/WhatsApp checks; and capability replay/isolation/revocation/privacy negatives. No real payment details were configured.

The initial hosted run was aborted after two role-switch failures: this new Preview had explicitly disabled the existing Staging auth-smoke setting, while the accepted staff shell exposes its logout action only when that setting is enabled. Cleanup and credential revocation passed. The successful run restored the existing protected Staging test configuration. No application RBAC or authentication bypass was added. This staff-shell configuration dependency remains an existing Production-readiness concern to address separately; this report does not certify Production readiness.

Bounded runtime review inspected up to 50 records per filter; no observed 5xx, error records, credential patterns or auth-token query values in that sample. This is bounded evidence, not exhaustive logging certification. Public response checks observed CSP and private/no-store cache headers.

## Cleanup and preserved state

Each hosted run owned 16 temporary Auth identities and one isolation organization. The runner cleaned owned Requests, Quotes, Orders, payments/proofs, execution resources, POD/files, capability grants and the new manual-mutation ledger, then removed those identities. Existing catalogues and intended SA/EG MANUAL configuration were retained. Both runs' temporary Vercel automation credentials were revoked. Before/after fingerprints confirm the three original Customer records are unchanged, with original quote/order counts unchanged (both zero on this Staging baseline). Populated historical commercial preservation is independently proved in the upgrade tests.

No main/develop merge, Production resource/configuration, real payment destination, DNS, Hostinger acceptance, visual redesign, MFA, legal publication or Phase 8 work occurred. Hostinger remains **DEFERRED — RESUME AFTER PRODUCT RELEASE CANDIDATE**.

Dependency disposition remains the documented scoped owner acceptance for the development-only braces advisory. It is technically unresolved upstream; the audit is not described as fully clean.

## Changed areas

Additive migration and official types; trusted manual Quote API/domain/service/Sales form; shared Request coverage and catalogue/wizard filtering; minimal AR/EN copy; scoped Staging configuration/inventory/cleanup tooling; SQL/RLS/unit/upgrade/concurrency/hosted tests; CI concurrency gate; exact protected Preview allowlist; this report and the catalogue inventory. No visual styling or dependency versions changed.

## Decision

MANUAL PRICING & COVERAGE PASS — READY FOR OWNER REVIEW

Do not merge without owner authorization. Production catalogue, tax, payment configuration and launch decisions remain separate.
