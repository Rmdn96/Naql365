# Naql365 Lovable UI V2 — Market Fix + Theme Foundation

Current decision: **READY FOR OWNER ACCEPTANCE**

## Final verification — 15 October 2026

This current closeout supersedes the incomplete delivery checkpoints below. Earlier failures remain historical failures. This is not merge or Production authorization. The final delivery is gated on both required exact-head CI jobs for the commit containing this report; its immutable delivery SHA and CI run are recorded in the owner handoff, rather than claiming the application CI for a later evidence commit.

### Repository and deployment identity

- Branch: `feature/lovable-ui-experience-v2`.
- Accepted Wave 2 baseline: `bd2495c010fe6f50c09532b2f7efb07643033b82`.
- Final application-changing SHA: `04ac38b152a5a847b539d29fb4d9fa9befe4ce82`.
- Tested remote HEAD matched that application SHA; the working tree was clean before the final harness/evidence closeout. Final delivery adds only the Auth verification harness, evidence and this report. It changes no application/runtime source relative to `04ac38b`.
- Official canonical Preview: <https://naql365-staging-ui-v2-naql365.vercel.app>.
- Hosted verification deployment: `dpl_F21QLm1D4temPuZYNhAKt1m7Zqe1`, READY / Preview, Git SHA `04ac38b152a5a847b539d29fb4d9fa9befe4ce82`.
- The immutable Vercel URL is `https://naql365-staging-ab2io113h-naql365.vercel.app`; all browser/Auth tests used the canonical alias, not that alternative origin.
- Existing Git integration creates Preview deployments on branch push. No hosting configuration, DNS, alias rule, protection rule or Production deployment was changed. Final evidence-only pushes may produce a later deployment Git SHA without changing the application source above.
- `main` remained `184ac2374a7e9611b4b265efc7dac21b57b7a2b1`. No merge, Hostinger, Commerce, Wave 3 or Phase 8 work was performed.

### Verified defects and corrections

| Finding                                           | Proven cause                                                                                                                                                                                                          | Correction and verification                                                                                                                                                                                                                                                                      |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Light-theme contrast and inherited foreground     | More specific legacy/public selectors overrode semantic text tokens; the floating contact link is under the footer, outside the previous selector                                                                     | Scoped CSS fixes cover hero tracking text, final-section text, route-story surfaces and the footer contact foreground. Full E2E and hosted axe/viewport checks pass.                                                                                                                             |
| Desktop/mobile theme controls disagree            | Two independently mounted controls held separate local state                                                                                                                                                          | Shared `useSyncExternalStore` subscription synchronizes both controls. Existing cookie persistence is retained. E2E verifies both controls and keyboard drawer behavior.                                                                                                                         |
| Theme selection lost before hydration             | Native select could be used before its client event handler was ready                                                                                                                                                 | Existing `useHydrated` primitive disables the control until readiness, with `aria-busy`. Hosted mode selection, reload and System checks pass. No Auth implementation was changed.                                                                                                               |
| Market header assertions omitted security headers | Playwright synchronous `headers()` did not include the full Origin/Set-Cookie header set                                                                                                                              | Test code uses `allHeaders()` and records only status, origin and cookie-attribute booleans. Security assertions were retained.                                                                                                                                                                  |
| Hosted Auth runner interrupted after logout/Back  | The runner issued `reload()` while the protected Back navigation was still redirecting; safe diagnostics identified `CUSTOMER ar refresh after logout`, `page.reload`, protected pathname, and navigation unavailable | Harness now explicitly proves the localized login destination after Back before reload. It then checks reload and a fresh protected navigation. Six role/locale sessions pass with unchanged application Auth source. Session-only mode avoids repeating already accepted presentation captures. |

Application changes are limited to theme/presentation files listed below and dependency security patches. Next.js/eslint-config-next were updated to `16.3.8`, sharp to `0.35.5`, and the lockfile received compatible transitive patches. The automated pricing engine, Finance authority and commercial lifecycle are unchanged.

### Automated and hosted results

Application exact-head [Foundation CI 38715491921](https://github.com/Rmdn96/Naql365/actions/runs/38715491921) is **PASS** on `04ac38b152a5a847b539d29fb4d9fa9befe4ce82`:

- **308 unit/integration tests**, 58 files, PASS.
- **52 local E2E tests**, PASS, including the theme/market/accessibility additions. The original 18 failing E2E cases were not disabled or weakened.
- Formatting, ESLint, strict TypeScript, production build, tracked/history secret scans: PASS.
- Supabase reconstruction, eight SQL/RLS test files, official generated types and six independent-connection concurrency suites: PASS. Restricted staff workspace tests also pass.
- Local full unit suite: 308/308 PASS. Local Docker was unavailable and port 3000 was occupied by a prior server, so the complete DB/E2E gates are evidenced by the exact-head Linux CI, not misreported as fresh local executions.

Hosted theme matrix: **150/150 PASS**, zero missing, 12 indexed/hash-verified representative screenshots. Coverage is AR/RTL and EN/LTR; Light, Dark and System; widths 360/390/768/1280/1440; homepage, login, signup, recovery and unauthenticated password-route denial. The password row explicitly represents its redirect to login, not a fabricated valid recovery form. The earlier scoped Auth visual attempts additionally captured real authorized password/profile forms and validation/error states, but their interrupted session runs are not counted as complete hosted acceptance.

Verified: initial explicit theme in server HTML; refresh/navigation persistence; synchronized desktop/mobile controls; System preference changes between light/dark; no horizontal overflow; accessible labels; zero axe violations in this matrix. E2E additionally checks focus restoration and keyboard drawer/Escape behavior. Server-rendered explicit preference and CSS System media tokens avoid the tested incorrect-theme flash; this is not a claim about every browser/device or WCAG certification.

Hosted market matrix: **4/4 PASS** (SA→EG and EG→SA in AR/EN). Each POST `/api/public/market` returned 200, with browser Origin equal to the canonical expected origin, no returned error category, and Set-Cookie present with Secure, HttpOnly, SameSite Strict and Path `/`. No cookie value was exported. Riyadh/Cairo coverage and selected Market changed correctly and survived refresh, direct navigation and locale change. Public authoritative catalogue readback confirms SA/SAR and EG/EGP. Authenticated navigation/Market persistence is covered by the session matrix below. The original owner-reported intermittent market failure remains **root cause undetermined** because it was not reproduced; no market endpoint/origin/cookie-security code was changed.

Hosted Auth session matrix: **6/6 PASS**, using approved run-owned synthetic fixtures on Staging only:

| Persona     | Arabic | English | Destination                |
| ----------- | ------ | ------- | -------------------------- |
| CUSTOMER    | PASS   | PASS    | Localized Customer account |
| SUPER_ADMIN | PASS   | PASS    | Localized staff portal     |
| DRIVER      | PASS   | PASS    | Localized Driver area      |

Every row verifies normal password login, session after refresh, public/home/services navigation, AR↔EN, SA↔EG, direct localized `/login` recognition without credential re-entry, cross-role denial, explicit logout, Back denial, refresh after logout and fresh protected-route denial. Auth cookie checks inspect attributes only: HTTPS Secure, SameSite Lax, root Path and canonical host scope. No owner password/account was inspected, reset or changed. Callback configuration and existing Auth/session/role-routing implementation were unchanged.

### Evidence, cleanup and security

- [Public theme/market index](evidence/ui-v2-market-theme-final/index.json): application/deployment identity, all 150 combinations, market response metadata, 12 screenshot names and SHA-256 hashes. Screenshots contain public content only.
- [Auth session index](evidence/ui-v2-market-theme-final/auth-sessions.json): six successful role/locale rows.
- [Independent cleanup readback](evidence/ui-v2-market-theme-final/cleanup.json): exact ledger-owned identities/tenant records removed for all three current Auth attempts. Five disposable identities total; no business journeys, payments, proof files or Storage objects were created. Existing owner records/catalogues/configuration were outside fixture scope.
- [Historical interruption summary](evidence/ui-v2-market-theme-final/historical-attempts.json): retains DNS/restricted-runner, header assertions, hydration timing and logout runner failures as failures/interruption evidence, not PASS.
- Preview protection readback: `all_except_custom_domains`; an unauthenticated canonical request returned the Vercel protection redirect (302). Authenticated automation used an origin-scoped short-lived same-project development OIDC credential. No long-lived bypass credential or temporary role grant was created. Temporary OIDC file material is removed after verification; normal owner-authorized CLI login is retained. Do not describe an expiring OIDC token as a separately revoked bypass secret.
- All **47 migrations** are byte-identical to the accepted Wave 2 baseline. Supabase Auth, RLS/RBAC, generated types, application/domain/infrastructure authority, payment and Order lifecycle sources are unchanged.
- Production dependency audit: **0 findings**. Full audit: **5 high** findings in the development-only `braces` → micromatch/fast-glob/Next ESLint tooling chain. This is the previously documented scoped owner risk acceptance in `docs/production-launch-review.md`, not a clean full audit or acceptance of new runtime vulnerabilities. No force downgrade or audit suppression was applied.
- Tracked/history scans pass; their heuristic coverage is not proof against every possible secret format. No passwords, auth cookies, JWTs, guest capabilities or private proof URLs are included in committed evidence.

### Outstanding issues and limits

| Item                                                         | Severity / reproduction                                                               | Impact / required resolution                                                                                          | Acceptance blocker                       |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Development-only braces advisory                             | npm audit reports five high package-chain findings                                    | Retain scoped existing owner acceptance; reassess when a compatible upstream fix exists and before Production release | No, within the existing documented scope |
| Original intermittent Market failure                         | Historical owner report; not reproduced in four canonical hosted cases or current E2E | Cause remains undetermined; investigate safe response evidence if reproduced                                          | No current failing case                  |
| Earlier DNS/build/port/hydration/logout-runner interruptions | Historical checkpoints and interruption index below                                   | Resolved verification path; never relabeled PASS                                                                      | No, replacement applicable gates pass    |

Final delivery changes only test/evidence/documentation after the tested application SHA. Both required exact-head jobs must pass on that delivery commit before the owner handoff declares completion. The final delivery SHA, run ID and clean-tree/remote confirmation are supplied together in the final release handoff because a report cannot embed its own Git commit hash.

## Historical checkpoints — retained verbatim below

This gate is on `feature/lovable-ui-experience-v2`, based on Wave 2 delivery `bd2495c010fe6f50c09532b2f7efb07643033b82`. It is a presentation and public market-context change. No production deployment, DNS change, Hostinger deployment, Commerce schema, or migration was introduced.

## Market switching

The safe diagnostic on the canonical protected Preview (`https://naql365-staging-ui-v2-naql365.vercel.app`) exercised the existing same-origin endpoint with the browser origin and the current canonical `APP_URL` origin. The endpoint remains `POST /api/public/market`, protected by `checkOrigin`, and the market cookie remains Secure on HTTPS, SameSite Strict, Path `/`, and HTTP-only. No cookie value was recorded.

The current canonical Preview successfully completed both directions after the normal refresh wait:

| Locale        | Direction            | Result | Authoritative content                    |
| ------------- | -------------------- | ------ | ---------------------------------------- |
| Arabic / RTL  | Saudi Arabia → Egypt | PASS   | Egypt market heading and Cairo coverage  |
| Arabic / RTL  | Egypt → Saudi Arabia | PASS   | Saudi market heading and Riyadh coverage |
| English / LTR | Saudi Arabia → Egypt | PASS   | Egypt market heading and Cairo coverage  |
| English / LTR | Egypt → Saudi Arabia | PASS   | Saudi market heading and Riyadh coverage |

Refresh and locale navigation retained the selected market during the browser verification. The earlier owner report is retained as historical Preview evidence; it was not reproduced on the current canonical deployment. The original cause remains undetermined: successful canonical-origin tests alone cannot establish whether the earlier failure was stale deployment configuration, transient infrastructure, or another condition. No market endpoint or origin configuration change has been made.

## Theme foundation

The implementation adds semantic tokens for background, surfaces, text, borders, brand, accent, status, focus and shadow. `Light`, `Dark`, and `System` are first-class modes, with `System` as the default. The server reads the `naql365_theme` preference before rendering the root element, so an explicit selection is present on the initial response. The client control updates the root `data-theme` attribute and persists only the non-sensitive theme preference in a SameSite cookie. System mode follows `prefers-color-scheme` through CSS media tokens.

The compact accessible theme control is present in the public desktop navigation and in the mobile menu, with localized labels `فاتح / داكن / حسب النظام` and `Light / Dark / System`. Wave 1 public surfaces and Wave 2 authentication/onboarding surfaces consume the semantic tokens. The mobile market control and error text use compact spacing and bounded width so a market error cannot expand the whole header.

Lovable project knowledge was updated in the restricted **Naql365 Design Lab** to require the three theme modes, semantic tokens for all future components, first-class SA/EG market context, and the fact that Store/Commerce is planned but not implemented. Lovable remains design-only; no database, Auth, Supabase integration, GitHub sync, or credentials were added.

## Files changed

- `src/styles/tokens.css` — semantic Light/Dark/System theme tokens.
- `src/styles/design-system-v2.css` — token-based Wave 1/Wave 2 surfaces, controls, states and compact mobile header treatment.
- `src/styles/auth-v2.css` — theme-aware primary action foreground.
- `src/components/shell/theme-control.tsx` — localized accessible theme selector and persistence.
- `src/components/shell/public-shell.tsx` — theme control in public desktop and mobile navigation.
- `src/app/[locale]/layout.tsx` — server-side theme preference read and initial `data-theme`.
- `tests/unit/theme.test.ts` — semantic-token and persistence contract checks.
- `tests/e2e/market-theme.spec.ts` — browser persistence, server-rendered theme, System preference, theme/viewport/axe and same-origin market tests (pending execution on a network-capable runner).

No market endpoint, Auth flow, RLS/RBAC, business command, or database migration was changed. Migrations remain **47**, byte-identical to the accepted baseline.

## Verification

- TypeScript strict check: PASS.
- ESLint: PASS.
- Prettier check: PASS.
- Latest local tracked-secret scan: PASS (2292 tracked files); history scan PASS (1738 text blobs, heuristic coverage).
- Theme contract tests: 2 PASS.
- Initial exact-head CI `38705876300`: 308 unit/integration PASS; database/RLS/generated types/concurrency PASS; production build PASS; E2E 26 PASS / 18 FAIL. The failures exposed light-theme accent contrast, inherited white hero text, and the floating contact link foreground. These are retained as failed application presentation evidence and corrected in the next commit; they are not attributed to the local runner limitations.
- Market integration/database coverage remains the accepted baseline.
- The full Vitest run was attempted; Windows worker/SSR sandbox file linkage failed for the existing database and visual-evidence suites before execution. The failures are environmental (`ENOENT`/`EPERM`) and did not identify an application assertion failure.
- Production build was attempted with Webpack after the local Turbopack junction restriction. The sandbox could not resolve `fonts.googleapis.com`, and Next also reported the existing Windows junction permission limitation. No source conclusion is drawn from that environment failure.

## Delivery checkpoint — verification incomplete

The deployed application/evidence commit is `11d9f3ae4868d36a4b61d3368e2b58b2aa873f56`, deployment `dpl_DqY1DKpqmKEVR1uxB13Zqnx8KvMC`, READY / Preview. Its required CI `38705876300` is **FAIL**, as documented above. The official protected Preview remains `https://naql365-staging-ui-v2-naql365.vercel.app`.

The contrast/cascade correction and expanded tests were committed locally at `1ba7e49f5dbb2ca65847d539f9bb980bd2c2a5cb`; subsequent local review also corrects inherited final-section text and the route-story surface. These corrections have not been deployed. Git push failed because the runner could not resolve `github.com` (`Resolve-DnsName`: access denied). The GitHub connector write was also refused: `MCP tool call requires approval, but approval policy is never`. No remote write succeeded for the correction.

Latest local correction checks: lint PASS; strict TypeScript PASS; focused theme tests 2/2 PASS; tracked/history scans PASS; diff whitespace check PASS. The final local checkpoint commit is identified by Git history; it contains application CSS and documentation and is not a deployed application identity.

Outstanding gates: corrected application deployment and exact-head CI; full Light/Dark/System AR/EN responsive/axe matrix; safe hosted market response/status/Set-Cookie-attribute diagnostics and currency check; authenticated CUSTOMER/SUPER_ADMIN/DRIVER regression on the corrected application. Existing successful market browser checks and theme refresh persistence are retained, but do not replace these missing gates. No fresh role fixtures or temporary automation credentials were created during this task.

Application Auth/RBAC/RLS, Supabase project, payment and lifecycle behavior remain unchanged. The work is **not yet ready for owner acceptance**. Wave 3 has not started.
