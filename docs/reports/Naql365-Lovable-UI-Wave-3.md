# Naql365 Lovable UI V2 — Wave 3 Customer Experience

Current decision: **LOVABLE UI MIGRATION — WAVE 3 READY FOR OWNER REVIEW**.

The current closeout below supersedes the historical checkpoints. Earlier failures and superseded candidates remain identified separately; they have not been relabelled PASS. This is not merge or Production authorization.

Branch: `feature/lovable-ui-experience-v2`. Accepted baseline: `2e10349cd6ca84fb42f64a7187513c393b1ece49`; baseline application `04ac38b152a5a847b539d29fb4d9fa9befe4ce82`. No merge or Production authorization.

Current application-changing SHA: `f758f42868f97984999a5673d2f5ed0ca5d13b89`. Protected canonical Preview: <https://naql365-staging-ui-v2-naql365.vercel.app>. Hosted deployment: `dpl_DoWpuNVJaoPqSTwqtpzJweKr9sJo`, READY / Preview, exact Git SHA above. The immutable hostname `naql365-staging-51s1w1b42-naql365.vercel.app` is deployment metadata only; Auth/browser acceptance uses the canonical origin.

Final delivery adds documentation/evidence only after that application commit. The enclosing delivery SHA, exact-head delivery CI and clean-tree/remote confirmation are recorded together in the final owner handoff; a report cannot embed its own Git commit hash. Automatic Git integration may build the later evidence HEAD without changing application source. No manual hosting/DNS/protection reconfiguration is part of Wave 3.

## Application verification

- Local full unit/integration run: **318/318 PASS**, 62 files. Count reconciliation: accepted 308 + navigation 2 + payment accessible-name 2 + pending Quote presentation 5 + matrix completeness contract 1 = 318.
- Exact application CI [38739352214](https://github.com/Rmdn96/Naql365/actions/runs/38739352214): both required jobs PASS on `f758f42868f97984999a5673d2f5ed0ca5d13b89`. Machine-readable job/step evidence: `evidence/lovable-wave3/application-ci.json`.
- Full Playwright suite: **56/56 PASS in exact-head CI** (accepted 52 + four desktop/mobile AR/EN Guest/theme cases); formatting, ESLint, strict TypeScript, production build and tracked/history secret scans PASS.
- Fresh database reconstruction, 8 SQL/RLS suites, official generated types/diff, six independent-connection concurrency suites and restricted-staff workspace regression PASS in that CI. All 47 migration Git blobs remain byte-identical to the accepted baseline; `evidence/lovable-wave3/migration-integrity.json` includes their SHA-256 values.
- No change to protected authority/config/dependency paths: `evidence/lovable-wave3/architecture-integrity.json`.
- Runtime dependency audit: zero findings. Full audit retains five high findings in the development-only braces/micromatch/fast-glob/Next ESLint chain, under the existing scoped owner acceptance in `docs/production-launch-review.md`; no dependency change or suppression was introduced.

## Design Lab and integration review

Existing [Naql365 Design Lab](https://lovable.dev/projects/45d7c85b-e937-48ee-8d57-251cc16a57b8) generated Wave 3 customer concepts via its authenticated browser interface. The connector lacked `projects:write`; the authorized UI workflow was used instead. The project was unpublished, workspace-only in the owner's one-member workspace, with database disabled. No backend credentials were supplied or integration enabled. Export comparison against the accepted Wave 2 lab archive is recorded with file hashes in `evidence/lovable-wave3/generated-diff-review.json`.

Accepted concepts: compact customer navigation, next-action panel, bounded request rows, semantic surfaces, route facts, money/tax/expiry hierarchy, distinct payment methods/status, eight-step progress. Rejected: generated router/runtime, synthetic LAB records/amounts/tax calculations, preview state selectors and authorization predicates, independent localStorage theme implementation, package/lockfile/instruction changes. Canonical Next.js server actions, loaders, validation and existing theme cookie remain authoritative.

## Existing data and scope

| Surface                       | Existing safe source                                               | Presentation scope                                                                                                                                         |
| ----------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer dashboard            | `customerRequests`, `customerQuotes`, canonical enrollment/profile | Next action prioritizes an already-returned SENT or VIEWED Quote, otherwise latest returned Request or new Request; bounded recent list, secondary profile |
| Request wizard/detail/history | Existing request/page-access loaders, eight-step draft/commands    | Grouped fields, localized progress, save/error/review hierarchy; no validation or workflow changes                                                         |
| Final Quote/decision          | `customerQuoteDetails`, existing accept/reject commands            | Route, final amount, tax, validity and response hierarchy; no commercial calculation or lifecycle changes                                                  |
| Checkout                      | Existing `PaymentDetails` and payment commands                     | Cash/transfer separation, proof vs Finance review/confirmed distinction; same private proof access                                                         |
| Tracking                      | `customerProgress`, existing authorized tracking                   | Recorded lifecycle/Stop facts only; no fabricated ETA/location/POD                                                                                         |
| Guest                         | Existing capability/session/page-access authority                  | Same scoped shared presentation; no reference-only access or capability disclosure                                                                         |

No global statistics, complete Order-history projection, new query/RPC, schema or backend is added. All 47 migrations must remain byte-identical to baseline. Existing application Auth/RBAC/RLS, Finance/manual pricing, Guest capabilities and lifecycle authority remain unchanged.

## Canonical implementation and before/after

| Before                                                           | Wave 3 integration                                                                                                                                                                                 |
| ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Customer actions spread between profile, lists and journey pages | Localized Overview / My requests / Quotes navigation and a next-action panel using already-returned facts; profile remains secondary                                                               |
| Shared legacy surfaces did not consistently follow Dark tokens   | One scoped Customer V2 stylesheet for account, forms, Request summary, final Quote, checkout and tracking; existing Light/Dark/System authority is reused                                          |
| Wizard navigation had weak visual grouping                       | Eight-step position, current/previous-step treatment, grouped fields and reachable sticky navigation; existing draft/save/submit logic is unchanged and position does not certify field completion |
| Checkout actions lacked a strong method hierarchy                | Distinct Cash/Transfer choices, decorative accessible icons and a customer-safe payment-state summary; proof submission remains separate from Finance confirmation                                 |
| Commercial and route facts competed visually                     | Bounded route cards, final-total/tax/validity hierarchy, readable history rows and responsive contained tables                                                                                     |

Application files changed from the accepted baseline:

- `src/components/ui/customer-workspace.tsx` — server-rendered localized navigation only.
- `src/components/requests/account.tsx` — next action, recent activity and secondary profile hierarchy; no new loader.
- `src/components/requests/wizard.tsx` — progress presentation only.
- `src/components/payments/checkout.tsx` — payment method/status presentation; existing commands remain untouched.
- `src/styles/customer-v2.css` — semantic theme surfaces, spacing, responsive forms/cards/tables, focus and action hierarchy.
- `src/app/[locale]/layout.tsx` — scoped stylesheet import.
- `src/app/[locale]/(account)/account/requests/page.tsx` and `quotes/page.tsx` — Customer navigation.
- `src/app/[locale]/guest/requests/[id]/page.tsx` — shared Customer presentation scope.

No Auth action/callback/cookie code, database types, dependency manifest/lockfile, environment manifest or backend/domain/infrastructure source changes are included. Final Quote decisions, eight-step validation, private proof handling and accepted snapshots keep their existing authority.

## Hosted acceptance — final application

**10/10 hosted business cases PASS** on application `f758f42868f97984999a5673d2f5ed0ca5d13b89`: SA Guest cash through delivery; EG Guest transfer/proof rejection/reupload/Finance confirmation through delivery; Guest Quote rejection without Order creation; SA and EG registered Customer manual Quote/Cash; AR and EN public/accessibility/contact smoke; Guest replay/capability isolation; AR and EN SUPER_ADMIN session/logout/history denial. Results and safe reporter log: [hosted/results.json](evidence/lovable-wave3/hosted/results.json).

Both Markets are authoritatively read back as MANUAL in the Customer tests. Final Quotes have real MANUAL provenance without dummy evaluations. Customer attempts to invoke Sales pricing are denied. Opening a Quote records VIEWED through the existing command; the dashboard still prioritizes it, and acceptance proceeds through the unchanged decision authority. Final amounts remain equal across delivery. Transfer upload, rejected proof/retry, Finance confirmation and execution remain distinct. Private proof access/expiry and unauthorized denial checks pass. Tracking shows recorded lifecycle/Stop/POD facts only.

Accepted Foundation [6/6 role-session evidence](evidence/ui-v2-market-theme-final/auth-sessions.json) remains valid: CUSTOMER/SUPER_ADMIN/DRIVER × AR/EN, public/locale/Market navigation, direct login recognition, refresh, logout/Back/protected denial and cross-role isolation. Wave 3 does not change Auth/session/role source. The new journeys additionally exercise Customer login/direct-login recognition/logout, both localized SUPER_ADMIN session cases, and normal Driver execution/login/logout on both Guest journeys. The accepted genuine-mailbox gate was not repeated.

## Visual matrix and review

**371/371 PASS; missing 0; failed 0; N/A 0.** All indexed files are committed under [hosted/index.json](evidence/lovable-wave3/hosted/index.json), with exact application SHA, state, locale, theme, width, timestamp, source kind and SHA-256. The completeness command verifies every required key and every image hash:

```text
node scripts/staging/check-ui-v2-wave3-evidence.mjs docs/reports/evidence/lovable-wave3/hosted f758f42868f97984999a5673d2f5ed0ca5d13b89
```

The documented risk matrix is 39 real journey-state families × 9 presentation samples, plus 20 controlled real-SSR loading samples. It is not a claim that every possible state/Market/locale/theme/viewport Cartesian product was tested.

| Dimension     | Coverage                                                                        |
| ------------- | ------------------------------------------------------------------------------- |
| Arabic / RTL  | 190 samples                                                                     |
| English / LTR | 181 samples                                                                     |
| Market        | Both SA and EG Customer journeys in AR/EN; native Guest journey SA/AR and EG/EN |
| Light         | 195 samples; all five widths for every real state                               |
| Dark          | 78 samples; mobile/desktop breakpoint extremes for every real state             |
| System        | 98 samples; same two extremes plus loading at all five widths                   |
| Widths        | 360: 121; 390: 43; 768: 43; 1280: 43; 1440: 121                                 |

The new System captures emulate a Light OS. Explicit Dark captures exercise the other semantic palette; accepted Foundation OS-preference/persistence evidence is retained because the theme implementation is unchanged. No independent Lovable theme store was ported.

Country codes in capture names identify the authoritative synthetic Request/Order Market. They do not claim that the independent public-header Market cookie filters an existing Customer's owned journeys. A Customer account can contain both Markets; that existing distinction and the accepted Foundation 4/4 public switching evidence are preserved.

Every indexed capture passed page-overflow and axe smoke checks; native states also assert RTL/LTR direction and focusability of the first available main action. Controlled loading retains the real localized SSR layout. Existing semantic labels, keyboard controls and eight-step validation remain. Representative images were inspected for hierarchy, long Arabic wrapping, readable totals, reachable actions and capture artifacts. Automated axe/focus smoke is not WCAG certification or an exhaustive assistive-technology audit.

Real states include empty/populated account, pending VIEWED Quote, request validation/review, final/rejected/accepted Quote, Cash, transfer pending/rejected/retry/confirmed, completed tracking and revoked Guest continuation. Loading uses the actual SSR fallback with replacement scripts suppressed only inside the operator's response interception; the real response is reloaded afterward. This is explicitly controlled presentation evidence, not prolonged live loading or an application bypass. No Staging infrastructure was corrupted to manufacture error states.

Representative owner-review images:

| Surface                                          | Image                                                                               |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| Pending Quote priority, Arabic Dark mobile       | [360px](evidence/lovable-wave3/hosted/customer-pending-quote-sa-ar-ar-dark-360.png) |
| Customer account, English Light desktop          | [1280px](evidence/lovable-wave3/hosted/customer-eg-en-en-light-1280.png)            |
| Wizard review, English Light mobile              | [390px](evidence/lovable-wave3/hosted/wizard-review-eg-en-en-light-390.png)         |
| Final Quote, Arabic Dark mobile                  | [360px](evidence/lovable-wave3/hosted/quote-sa-ar-ar-dark-360.png)                  |
| Finance-confirmed transfer, English Light mobile | [390px](evidence/lovable-wave3/hosted/payment-confirmed-eg-en-en-light-390.png)     |
| Actual completed tracking, Arabic Dark mobile    | [360px](evidence/lovable-wave3/hosted/guest-sa-tracking-ar-dark-360.png)            |
| Request history, English Light tablet            | [768px](evidence/lovable-wave3/hosted/request-history-eg-en-en-light-768.png)       |

## Cleanup, protection and limits

- Final run: all 16 run-owned Auth identities, profiles, memberships, roles, Customers, isolated organization, financial/file fixtures removed; Guest policy restored exactly. The main runner asserts scoped Request/Quote/Order/Job/Trip/payment/proof/Storage cleanup. Independent identity/configuration counters are zero in [cleanup.json](evidence/lovable-wave3/hosted/cleanup.json).
- Additional read-only verification finds zero records for two preserved Guest Request IDs, zero related grants and zero Storage objects owned by the 16 run identities; Staging migration count is 47. Its exact bounded scope is recorded in [supplemental-readback.json](evidence/lovable-wave3/hosted/supplemental-readback.json). Owner accounts, retained real Customer, catalogues and existing configuration are outside cleanup scope.
- Origin-scoped short-lived same-project OIDC material was used only by the operator runner. Its temporary file was removed; fixture identities are deleted. No long-lived bypass secret or grant outside fixtures was created. Normal owner CLI login is retained. An expiring OIDC token is not described as a separately revoked bypass secret; see [credential-disposal.json](evidence/lovable-wave3/credential-disposal.json).
- Preview protection remains `all_except_custom_domains`; an unauthenticated canonical request returns 302. See [deployment.json](evidence/lovable-wave3/deployment.json). No arbitrary Vercel alias or wildcard callback was added.
- Evidence contains only public/run-owned synthetic content and test payment destinations. No passwords, cookies, JWTs, raw Guest capabilities, private proof URLs or real financial destination data are committed. Secret scans are heuristic, not proof against every possible secret format.
- Lists remain bounded by existing projections; this does not add complete Order history, global statistics, ETA/GPS or new backend capabilities. Generic infrastructure outages were not manufactured for screenshots. The existing development-only dependency risk remains within its prior scoped acceptance.
- All 47 migrations, Auth/RBAC/RLS, manual pricing and Finance/lifecycle authority remain unchanged. `main` remains `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`. No merge, Production, DNS, Hostinger, Commerce or Phase 8 operation was performed. Work stops for owner review.

The final documentation/evidence delivery must also pass both required exact-head CI jobs. Its immutable SHA and CI run are supplied in the owner handoff; application CI above is not substituted for that later HEAD.

## Historical verification checkpoints

- Initial new navigation unit assertions incorrectly assumed serialized HTML attribute ordering: two failures. Corrected to inspect the actual current-link element; the focused two tests pass. No application change was needed for that test defect.
- First local lint included an exported Lovable archive inside the checkout's ignored temporary folder. Generated lab runtime is not canonical source; the archive was moved to the adjacent review directory. It is not shipped, lint rules were not weakened.
- The initial local Playwright launch could not bind port 3000 (`EADDRINUSE`) and stopped before tests ran. The existing process was preserved. The required full 56-test suite subsequently passed in exact-head CI; the port interruption is not application acceptance evidence.
- The first hosted invocation used an incorrect script argument layout and selected legacy visual tests as well as business journeys. A dedicated operator wrapper now requires the bounded `--stage3-business` selection. The initial validation capture also assumed that Next enforces per-step validation; it now exercises the existing final-submit validation without changing application validation.
- Hosted accessibility found two genuine Dark-theme contrast defects: the inherited light wizard save-status surface (`823382f…`, repaired in `f372738…`) and the inherited white commercial-summary surface (`f372738…`, repaired in `da3751c…`). Scoped semantic surface tokens repair these without changing commercial facts.
- The `da3751c…` run then stopped at Cash selection: generated CSS glyphs polluted the accessible button name. `452d540…` replaces those glyphs with explicitly decorative `aria-hidden` spans. Exact action-name assertions remain unchanged; focused AR/EN component tests cover the correction.
- The failed hosted runs, partial indexes and independent cleanup results are retained under `evidence/lovable-wave3/historical-*`. They are not final acceptance passes.
- A local full-suite run alongside hosted browser capture produced 312 passes and one 30-second timeout in the existing market-fixture isolation test. No assertion or timeout was weakened. Exact-head CI and a later isolated rerun determine its final disposition.
- The isolated market-fixture test subsequently passed with the five focused navigation, payment-name and matrix-definition tests (6/6). This supports a local concurrent-run timeout classification, not a demonstrated application regression.
- The first `452d540…` capture run passed both Guest delivery journeys and Quote rejection but stopped after 254 captures: Next's inline streaming replacement removed the real loading fallback even while external scripts were delayed. Independent cleanup passed for all 16 identities and owned relations. A test-only response interception now preserves the actual SSR fallback by suppressing replacement scripts; the untouched application response is restored before continuing. This is controlled presentation evidence, not a live prolonged-loading claim.
- Manual image inspection also found a full-page capture artifact: focusing a below-fold action scrolled the viewport and painted an offscreen fixed skip link into the image. The harness now resets scrolling before capture. The provisional images/index remain historical; final evidence uses a separate directory. No application change was made for either capture issue.

At that earlier checkpoint, hosted results and final identity were still pending; Wave 3 was not ready for review.

The `452d540…` candidate completed 353/353 capture/hash checks, 2/2 Customer business cases and the remaining 8/8 hosted cases in scoped batches; both cleanups passed. Its successful evidence remains historical for that application candidate. Final source review found an inherited dashboard presentation gap: opening a sent Quote changes it to VIEWED, but the pending-action filter included SENT only. The smallest UI filter correction now retains VIEWED as pending, matching the existing Quote decision component without changing decision authority. Five server-rendered component cases cover SENT/VIEWED versus ACCEPTED/REJECTED/EXPIRED. The final hosted matrix adds both Markets' pending-VIEWED dashboard state (371 required combinations) and will be rebuilt against the new application SHA rather than relabeling old captures.
