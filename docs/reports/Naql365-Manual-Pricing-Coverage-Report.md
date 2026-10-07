# Manual Pricing & Launch Coverage — Implementation Evidence

Status: IN PROGRESS — not accepted, not deployed. Baseline: `2b0639824442857408844a916d96c170b52984e4`; approved analysis: `a235b85b481ae44bf3ae37fd16bc43c4d9d62949`.

## Migration and backfill

Migration 46: `20261007000100_manual_pricing_directional_coverage.sql`. Migrations 1–45 are immutable.

Existing pricing settings retain AUTOMATED; only subsequently inserted settings default to MANUAL. Existing quote pricing details receive AUTOMATED provenance without changing their previous values. No historical quote/order money, distance, currency or tax is updated. Existing coverage rows retain both directions; new coverage rows default to neither. Existing organization-wide add-ons are backfilled to existing Market/service contexts only, preserving previous applicability. New options require explicit applicability rows.

This is not a commercial switch. SA and EG require explicit Staging configuration and authoritative readback before hosted manual acceptance. No Production configuration is supplied.

## Implementation boundary

- Manual command derives organization, Market, currency and effective tax from the Request; verified road distance does not call pricing rules.
- Mode-dependent provenance constraints distinguish real automated evaluations from manual author/revision/subtotal/input facts.
- Private mutation ledger retains retries after draft replacement. Existing quote send/accept/reject/Order engine is reused.
- MANUAL/missing configuration suppresses guest preliminary monetary projection, including historical evaluations. Customer RLS continues excluding pricing evaluations.
- Shared Request command validates one directional coverage predicate for both account and capability callers.
- Service/add-on applicability uses one organization/Market/service/add-on relation, not new service engines.

## Evidence checkpoint

- Fresh 46-migration reconstruction and populated 45→46 commercial snapshot preservation: PASS.
- Full unit/integration: 231 PASS across 48 files after the final provenance/coverage assertion.
- Native Supabase SQL/RLS: PASS, seven SQL files / 14 TAP assertions plus their internal assertions.
- Official generated types: regenerated from a pristine 46-migration database; exact-head CI checks equality.
- Independent connections: Operations, Driver, Tracking, Payment, manual quote and Guest suites PASS. Manual suite covers duplicate draft/send/accept, conflicting payload, request revision and pricing-mode races.
- Local E2E: 32 PASS. Formatting, lint, strict types and production build PASS after the Arabic copy correction.
- Tracked/history secret scans: PASS for 427 staged/tracked files and 1122 history text blobs; heuristic checks, not a guarantee for every secret format.
- Exact-head CI: PENDING.
- Protected Preview and hosted regression/cleanup: NOT RUN.
- Hostinger remains deferred; main, Production and DNS untouched.

## Catalogue and applicability

The read-only Staging inventory contains Riyadh/Jeddah and Cairo/Alexandria only. See `docs/launch-coverage-configuration-inventory.md`. Nationwide coverage cannot yet be advertised. Destination additions and Production activation remain owner-controlled configuration.

The bounded Staging setup explicitly configures household and office relocation as existing service records, unpacking as an existing add-on record, and Market/service applicability. No new domain engine or migration-seeded city/service activation is introduced. Both SA and EG must be read back as MANUAL before hosted acceptance.

## Remaining acceptance work

Complete exact-head CI, protected hosted Customer/Guest/Sales/Finance/Operations/Driver regression, explicit SA/EG MANUAL readback, owned-fixture cleanup and the full approved negative-coverage matrix. No hosted PASS is inferred from local tests.

Dependency security disposition remains the documented scoped owner acceptance of the development-only braces advisory; the upstream advisory is not represented as resolved.

MANUAL PRICING & COVERAGE PARTIAL — REMEDIATION REQUIRED
