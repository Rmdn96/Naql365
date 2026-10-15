# Naql365 Lovable UI V2 — Market Fix + Theme Foundation

Current decision: **Verification in progress — required CI and hosted coverage pending**

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
