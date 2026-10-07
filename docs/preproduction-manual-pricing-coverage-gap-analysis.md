# Pre-production manual pricing and launch coverage gap analysis

Date: 2026-10-07. Analysis only; implementation requires owner review. This is not Phase 8 or the Visual/UX workstream.

## Accepted starting point

- PR [#10](https://github.com/Rmdn96/Naql365/pull/10) was merged by the protected Squash Merge workflow at 2026-10-07T10:36:09Z.
- Independently approved source: `1fd1dc42c92e8fa7f0f4991e2fb94e8c46b68724`; reviewer: `Rmdn696`, approval on that exact commit.
- Resulting protected develop: `2b0639824442857408844a916d96c170b52984e4`. Its tree matches the approved source exactly.
- Required PR CI [37606731682](https://github.com/Rmdn96/Naql365/actions/runs/37606731682), candidate CI [37606265654](https://github.com/Rmdn96/Naql365/actions/runs/37606265654), and post-merge CI [37608491300](https://github.com/Rmdn96/Naql365/actions/runs/37608491300): PASS. Both required application and Supabase jobs succeeded after merge.
- Final pre-merge checks: exact HEAD, current approval, zero unresolved conversations, no conflicts, CLEAN/APPROVED, enforced administrator protection. Protection was identical after merge; no bypass or direct develop push was used.
- Migration count: 45. Migrations 1–45 remain unchanged in this analysis.
- Main remains `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`. No Production, DNS, payment configuration or hosted data was changed in this task.
- Analysis branch: `feature/preproduction-manual-pricing-coverage`, created from the resulting develop commit.
- Hostinger: **DEFERRED — RESUME AFTER PRODUCT RELEASE CANDIDATE**. Runtime guard, attestation, adapters, documentation and deployment branch are preserved. The reusable manifest has no temporary Hostinger origin enabled and no Production entry.

**PRE-PRODUCTION RUNTIME SAFETY — CLOSED & MERGED**

## Owner-approved launch behavior

Launch SA and EG together. Customers submit a Request and see **Pricing under review / السعر قيد المراجعة**, followed by a Sales-prepared final Quote and Accept/Reject. No automatic preliminary monetary price is shown to registered customers or guests. Preserve the automated engine for a future explicitly enabled mode.

Coverage is domestic and directional: Riyadh to any supported Saudi destination, including Riyadh itself; Cairo to any supported Egyptian destination, including Cairo itself. This does not authorize other origins, every city pair, or SA↔EG freight. “Supported” means explicitly activated service coverage, not every geographic catalogue entry.

## Repository findings

| Area                       | Current authority and evidence                                                                                                                                        | Gap                                                                                                                                                                                       |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Calculation                | `20260913000200_market_commands.sql`, `calculate_preliminary_price`: verified distance, class, workers, effective pricing rules and tax version produce an evaluation | A manual quote cannot currently bypass this calculation dependency                                                                                                                        |
| Draft quote                | Same migration, `create_quote_draft`; `src/domain/pricing/model.ts`; `src/infrastructure/pricing/service.ts`                                                          | Input is evaluation ID plus adjustment, not an independently entered final subtotal                                                                                                       |
| Send quote                 | Same migration, `send_quote` joins quote pricing details to a QUOTED evaluation                                                                                       | A new manual path must preserve validation while supporting explicit manual provenance                                                                                                    |
| Commercial schema          | `20260910000400_pricing_quote_schema.sql`, extended by Market migrations                                                                                              | `quote_pricing_details.evaluation_id` and calculated subtotal are required. Sent quote/accepted order constraints require verified distance. Simply hiding calculation UI is insufficient |
| Guest preliminary amount   | `20260926000500_guest_quotes.sql`, `guest_preliminary_price()`; `src/app/[locale]/guest/requests/[id]/page.tsx`                                                       | RPC returns the latest non-stale calculated amount; page displays it and emits preliminary-view analytics                                                                                 |
| Registered customer access | Existing ownership/RLS and customer quote projection in pricing service                                                                                               | Keep final sent quote visibility; regression must prove no preliminary amount leaks through any registered request response                                                               |
| Marketing                  | `src/i18n/public.ts`, `src/i18n/guest.ts`                                                                                                                             | Hero, quick entry, How It Works and FAQ promise preliminary prices; AR/EN need minimal state/copy corrections                                                                             |
| Coverage                   | `service_areas` has unique organization/Market/service/city and an active flag (`20260913000100_market_foundation.sql`)                                               | No route-pair table is needed, but cities currently have no pickup/delivery eligibility distinction                                                                                       |
| Submission                 | Registered `submit_request` in Market commands and guest authority in `20260926000200_guest_request_authority.sql`                                                    | Both endpoints validate active city coverage for both locations symmetrically, allowing any covered city as origin                                                                        |
| Catalogue and wizard       | `20260927000500_public_route_catalogue.sql`, request service, `src/domain/requests/quick-entry.ts`, request wizard                                                    | Same coverage list feeds pickup/delivery; public catalogue must expose service-specific direction safely                                                                                  |

The observed pricing is Sales-triggered, not necessarily automatic on Request submission. Nevertheless, the final-quote dependency and guest projection violate the intended manual-only launch behavior once that calculation exists. Disabling only a button or relying on zero pricing rules is not a safe solution.

This is repository analysis, not a live catalogue audit. Initial geography provisions Riyadh/Jeddah and Cairo/Alexandria but does not activate coverage. Staging configuration scripts are test setup, not evidence of approved Production service availability.

## Smallest recommended implementation

### One authoritative pricing-mode boundary

Add an organization/Market-scoped mode to existing `pricing_settings`, with a bounded `MANUAL`/`AUTOMATED` domain and audited privileged changes. Proposed safe default for new configuration is MANUAL. Explicitly configure SA and EG together in the later controlled rollout. Do not derive mode from locale, an email, Hostinger/Vercel, or a customer-supplied flag. Missing mode/configuration must never fall back to publishing an estimate.

Persist mode/provenance on newly created quote pricing details so a later mode change cannot reinterpret a sent quote. Existing evaluation-backed records remain AUTOMATED and immutable. Do not rewrite their monetary, currency, tax or distance snapshots.

In MANUAL mode, the existing preliminary-calculation command should reject creation of new automated evaluations with a bounded error. Keep its implementation and rules available for an explicitly enabled future automated mode. The guest preliminary RPC must return review state without any amount, including when an older evaluation exists. Apply the same safe projection to registered customers and server-rendered/serialized responses. A presentation flag alone is insufficient. Preserve final Quote/Order monetary displays after authorized Sales publication.

### Manual final quote on the existing commercial engine

Extend quote pricing details with conditional provenance: AUTOMATED continues requiring a real evaluation and calculation facts; MANUAL records staff author, request revision and manual subtotal provenance without fabricating an evaluation or a zero-price calculation. Nullable evaluation/calculation fields must be guarded by explicit mode-dependent CHECK constraints, not simply relaxed globally.

Add a trusted manual-draft operation using existing `quotes.manage` authority. Inputs: Request, expected revision, final pre-tax subtotal in currency minor units, validity and mutation ID, plus the existing verified-distance facts. Derive tenant, Market, currency and effective tax version on the server/database. Reject forged amounts outside valid integer bounds, negative subtotal, wrong Market, unauthorized staff, stale request and conflicting retry payloads. Preserve current tax rounding and amount equations; the UI clearly labels subtotal, tax and total.

Reuse the existing quote/version/items tables, version sequencing, locks, idempotency, send, view, accept/reject, expiry and exactly-one Order behavior. A manual quote item can describe the manually priced service total without copying fictional automatic components. Make `send_quote` validate the correct provenance branch, current request revision and valid commercial facts. Customer-visible descriptions must exclude staff-only calculation and adjustment reasons.

Keep verified road distance as an internal Sales input and retain the existing sent-quote/order distance constraints for this smallest change. Extract/reuse distance capture without invoking pricing rules. No routing provider or route optimization is required. Making distance optional would additionally change accepted commercial constraints and is deliberately not proposed here. Existing distance snapshots can remain factual history; no automatic monetary result is required to create one.

Review all revision-invalidation paths and quote-detail joins when adding MANUAL provenance. A new request revision invalidates an unsent manual draft, while sent/accepted commercial snapshots remain frozen. Preserve Finance clearance, CASH/BANK_TRANSFER, guest authorization, operational aggregation and Driver/POD behavior unchanged.

### Directional city coverage without route pairs

Extend existing `service_areas` with explicit pickup/delivery eligibility flags, scoped by its existing organization/Market/service/city identity. Retain `active` as the master switch. This reuses one coverage row per city/service rather than enumerating pairs. Existing coverage can initially retain equivalent semantics during upgrade; the controlled launch configuration explicitly narrows pickup eligibility before launch. No silent city activation in a migration.

For every offered service:

- SA: active pickup eligibility only for the Riyadh city record; delivery eligibility for Riyadh and each explicitly supported SA city.
- EG: active pickup eligibility only for the Cairo city record; delivery eligibility for Cairo and each explicitly supported EG city.
- Intra-city works by the same city having both flags. Country/Market/organization composite relationships remain mandatory.

A shared authoritative coverage predicate should validate both endpoints and be used by registered and guest submission, not just dropdown filtering. Public catalogue and quick-entry/wizard projections must use that same meaning per service. A newly added destination requires one city coverage activation, not an origin/destination cross-product. Unlisted destinations, reversed routes, foreign cities and inactive services fail safely. Re-check policy at submission after configuration changes; preserve historical accepted journeys.

### Services and activation

Current Staging intake catalogue contains furniture, goods, within-city, intercity and business services; packing, loading, unloading, disassembly and assembly add-ons. These are not proof that household/office relocation or unpacking are explicitly represented or operationally supported in both Markets.

Reuse configurable services/additional-services rather than create new domain engines. During implementation review, give household and office relocation explicit catalogue meaning and add unpacking where supported. Map service and add-on availability per Market/coverage; do not promise an option merely because an organization-wide add-on exists. Verify whether a small Market/service add-on applicability relation is necessary before selecting its final schema. Existing generic business/furniture labels alone should not be treated as acceptance evidence for every requested service.

The owner still supplies the actual destination lists and operational availability for activation. These are launch configuration inputs, not missing authorization to design the Riyadh/Cairo coverage rule. Prices, tax settings and payment destinations remain separately approved configuration; this analysis supplies none of them.

## Proposed change boundary

An additive migration after 45 is genuinely required for manual quote provenance, pricing mode and directional coverage. Do not edit migrations 1–45. Final migration split/filename is implementation work after review, not created by this document.

Expected source areas: pricing domain schemas/service/Sales forms and API, request catalogue/service/quick-entry/wizard, guest review projection/page, AR/EN public/request/quote copy, official generated DB types, SQL/RLS/concurrency tests and hosted harnesses. Preserve automated-mode tests with explicit test configuration; do not replace them with assertions that merely hide broken behavior. Reuse existing privileged catalogue permissions and audit, without direct client table-write authority for commercial mutations or runtime service-role credentials.

No auth/session/routing redesign, payment-engine rewrite, visual redesign, Production setup or Hostinger runtime work is required. Dependency security closeout retains scoped owner acceptance of the development-only braces advisory; it remains technically unresolved upstream.

## Required implementation acceptance

1. Fresh reconstruction and populated 45→new upgrade; unchanged historical migrations, records and accepted snapshots; exact generated types, RLS and permissions.
2. Guest and registered SA/EG Requests show review state without preliminary amounts in HTML, JSON, RPC, hydration or analytics, even with legacy evaluations present. Final sent amounts remain visible only to the correct journey.
3. Sales creates, revises and sends a manual final Quote with no automatic evaluation/rule dependency; verified distance remains available; currency/tax/rounding, request revision and expiry are authoritative.
4. Independent-connection races: duplicate draft/send/accept, conflicting retry payload, quote versus request revision, pricing-mode/config change versus command. Exactly one accepted Order and safe stale rejection.
5. Reject customer/guest/Driver manual quote mutation, tenant/Market forgery, invalid minor amounts and private staff detail access. Preserve CASH/transfer verification and execution gates.
6. Coverage positives: Riyadh→Riyadh/Jeddah/another activated SA destination; Cairo→Cairo/Alexandria/another activated EG destination. Negatives: Jeddah origin, Alexandria origin, reverse routes, cross-Market, inactive city/service, unsupported add-on and forged request location. Repeat via both submission paths, including stale wizard configuration.
7. Retained AUTOMATED mode regression in isolated test configuration; no launch fallback into it. No quote/order reinterpretation after mode changes.
8. Full formatting/lint/strict types/unit/integration, local E2E, SQL/RLS/types/concurrency, build and tracked/history secret checks; exact-head CI. Later hosted Vercel Staging acceptance, bounded ledgers and cleanup for Guest, Customer, Sales, Finance, Operations and Driver; AR/EN and mobile minimal copy/state verification.

None of these new behavior tests is claimed as executed by this analysis. The successful post-merge CI validates the accepted runtime baseline only. This branch changes documentation only.

## Decision

The launch policy is sufficiently defined for the proposed implementation review. Current code cannot meet it through catalogue configuration alone. Review this design before implementing; destination/service activation and tax/price approval remain controlled launch inputs.

**MANUAL PRICING & COVERAGE GAP ANALYSIS COMPLETE — READY TO IMPLEMENT**
