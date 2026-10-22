# Unified Customer presentation — Phase 4

## Route mapping recorded before implementation

Baseline: `fd87bc8dffdfbddeca2c03251e8a13e4e3160158`.
Visual authority: `Rmdn96/naql365-design-lab@2997c92bb5b00dfbf15ae0d1ccdb289d47c4d891`.

| Canonical route                                     | Starting presentation                             | Original source                                         | Planned treatment                                                                              |
| --------------------------------------------------- | ------------------------------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `/[locale]/account`                                 | Mixed Commerce/legacy account controls            | CustomerPreview dashboard, next action, panels, profile | Customer workspace shell; real next actions and independent histories; retained profile action |
| `/[locale]/account#customer-profile`                | Embedded profile disclosure, no independent route | CustomerPreview profile                                 | Keep real form, validation and save feedback; source form presentation                         |
| `/[locale]/account/requests`                        | Phase 3 frame, legacy list                        | CustomerPreview requests                                | Shared Customer navigation, source panel/list presentation, unchanged pagination               |
| `/[locale]/account/requests/[id]`                   | Accepted Phase 3 summary                          | CustomerPreview detail/snapshot                         | Reuse summary; consistent Customer shell/navigation                                            |
| `/[locale]/account/quotes`                          | Phase 3 frame, legacy list                        | CustomerPreview quote cards/status                      | Source list/panel presentation, unchanged version/status data                                  |
| `/[locale]/account/quotes/[id]`                     | Accepted Phase 3 quote controls                   | CustomerPreview quote                                   | Retain all existing decisions and strict eligibility; consistent shell                         |
| `/[locale]/account/orders/[id]`                     | Accepted Phase 3 tracking                         | CustomerPreview tracking/timeline                       | Retain real Trip/POD data and existing notifications; consistent shell                         |
| `/[locale]/account/orders/[id]/payment`             | Accepted Phase 3 payment controls                 | CustomerPreview checkout/payment                        | Preserve Finance-authoritative controls; consistent shell                                      |
| `/[locale]/store/orders[/id]`                       | Accepted Lovable Commerce history/detail          | CommercePreview portal/orders/order-detail              | Reuse accepted real-service screens; consistent navigation links, no new order service         |
| `/[locale]/login`, register/recover/password        | Accepted Phase 2                                  | AuthPreview                                             | No visual or behavioral changes                                                                |
| `/[locale]/request[/id]`, `/guest/**`, `/transport` | Accepted Phase 3                                  | Transport/CustomerPreview                               | Keep public/Guest Transport frame and workflows                                                |

No standalone Customer profile, notification inbox, Transport order-history route or context switcher is invented. Existing errors, empty/loading and unavailable responses remain truthful. Navigation preferences never confer authority. The original lab's fictional records, profile-save simulation, payment demonstrations, preview controls and tax examples are excluded.

## Scope

Presentation only. Domain, infrastructure, APIs, Auth actions, RPCs, SQL, migrations, grants, payment rules and environment configuration remain unchanged. Experimental multi-context identity code is excluded.

## Implemented presentation

- `CustomerFrame` owns account descendants only; Public, Auth and accepted Store Commerce routes retain their existing layout owners. `DesignFoundation family="customer"`, the official `BrandLink`, canonical market/theme/language controls and authoritative cart badge are reused.
- `CustomerDashboard` adapts the original CustomerPreview shell, next-action panel, two-column records, profile and responsive spacing. Its records and action slots are supplied by the unchanged authenticated account loader. Existing request-country selection, onboarding, profile save, logout and SENT/VIEWED quote filtering remain authoritative.
- Requests, quotes, tracking, payment and notifications keep their actual canonical components and controls inside the consistent Customer workspace. Existing Store history/detail remain the accepted Commerce presentation; navigation joins the two independent domains.
- `customer-workspace.css` is scoped to the Customer foundation and resolves palette roles through Phase 1 tokens. Phase 2 independent Auth and Phase 3 public/Guest Transport remain intact. Scoped alert/link contrast fixes use existing accessible tokens; no alternative logo or theme is introduced.
- The existing Customer navigation remains as dashboard quick actions so accepted application and browser contracts are preserved. The original lab's mock data, preview toolbar, simulated payments, hardcoded roles and profile-save behavior are excluded.

## Evidence and acceptance boundaries

The external local evidence directory is `deliverables/naql365-customer-phase4-20261022/` at the workspace root, outside this checkout. `VISUAL-REVIEW.md` links matching source/baseline/integration captures; `visual-integrity.json` records hashes. Source provenance is pinned in `CUSTOMER-SOURCE.json`.

The Customer component/browser harness uses explicit synthetic DTOs and controlled data/command boundaries, not authenticated cloud records. It exercises actual canonical server/client presentation components, with both locales, Light/Dark/System and dashboard widths 360/390/768/1280/1440. Its 156 paired captures cover dashboard, profile, requests/detail, quotes/detail, tracking and Store history/detail. The unchanged original source contributes 90 separate captures. Original lab illustrative content is distinguished from canonical synthetic records; pixel identity is not claimed for different business controls/data.

No standalone profile route, notification inbox, Transport order-history route or multi-context switcher is invented. Profile remains the supported disclosure; notifications remain attached to real tracking. Staff/Driver migration and the multi-context security experiment remain separate workstreams.

Fresh unit/integration, generic E2E, Transport and actual isolated-local Commerce results are recorded in the external final report. The new controlled Customer presentation harness is included in Foundation CI with failure artifacts, but no hosted run is performed or claimed here. Existing migrations 1–51 and generated database types are unchanged. No database migration or environment mutation is included.

## Security observation requiring separate release work

The unchanged Next.js 16.3.8 dependency now has published runtime advisories. The npm audit result is retained outside Git; it is not represented as remediated by this UI work. The image-optimization advisory's stated Sharp workaround is present (0.35.5), but that does not resolve the other advisories, including the App Router/Server Action DoS report. No uncontrolled dependency upgrade is mixed into Phase 4. Hosted CI of this exact local change and a separately scoped framework security review/remediation are required before deployment approval.

## Completed local acceptance (2026-10-22)

- Full unit/integration: **494/494 PASS**, including the preserved 10 bilingual CustomerAccount quote-state cases and Transport UUID fixture regression.
- Generic E2E: **90/90 PASS**, one worker, unchanged test deadlines and assertions, no retries. Earlier concurrent-load deadline failures and the initial scoped contrast failures are retained in external evidence.
- Customer browser/presentation: **156 paired captures**, 10 quote-state checks and two profile-feedback checks PASS; 90 unchanged original Lovable reference captures. Both locales, all three themes and all five dashboard widths are covered.
- Transport presentation: four Guest/Customer AR/EN draft/autosave/validation/submit journeys, 48 captures and 20 quote-state checks PASS.
- Actual isolated-local Commerce: **8/8 PASS**; direct RPC, SSR HTML and browser DOM each show one eligible product. Cart, checkout, isolation, paused denial, cleanup and deleted-credential reuse denial PASS. Final local Auth/product/order/fixture-organization counts return to zero.
- Local PostgreSQL 17: **12/12 original SQL/RLS assertion bodies PASS** in rollback transactions. Only unavailable pgTAP display calls are omitted; no new hosted pgTAP or concurrency execution is claimed.
- Production build, explicit TypeScript, ESLint, formatting and source/history credential-pattern scans PASS. All 51 migration bytes/Git blobs, generated types and original source hashes are unchanged.
- A strict optional-property build defect in the new navigation wrapper was corrected by omitting an absent prop; no runtime behavior changed. No tests were skipped or assertions weakened.

Local UI acceptance is complete. Exact-head hosted CI needs separate owner authorization. Deployment remains gated by the separately documented, unchanged framework runtime advisories; this UI commit does not claim they are remediated.
