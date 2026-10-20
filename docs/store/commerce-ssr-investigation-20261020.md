# Commerce SSR visibility investigation — 2026-10-20

## Baseline and conclusion

Branch: `feature/unified-egypt-mvp`. Starting local and authoritative remote
HEAD: `72232c5fc674dfdf7e19277fae57c40bd8b771f5`; starting worktree clean.

The hosted root cause is **not yet proven**. Do not describe this delivery as a
verified repair of the GitHub-only failure. The authorized fallback is bounded,
sanitized diagnostics, with no speculative change to catalog eligibility,
credentials, caching, authorization, prices or financial behavior.

Foundation [39412520381](https://github.com/Rmdn96/Naql365/actions/runs/39412520381)
recorded an eligible fixture and one anonymous RPC item, followed by zero homepage
cards. Database Types
[39412523525](https://github.com/Rmdn96/Naql365/actions/runs/39412523525) passed.
The failed run did not capture the Next.js RPC response or projection result.
It therefore establishes a failure between direct RPC and homepage rendering,
but cannot identify a narrower failing boundary.

## Actual request path

1. `src/proxy.ts` preserves request cookies and sets per-request security headers.
2. `src/app/[locale]/layout.tsx` reads request headers/cookies. The homepage is
   dynamically rendered; the verified local build marks `/[locale]` as dynamic.
3. `src/app/[locale]/page.tsx` resolves the selected Market and Transport catalog,
   then passes `StoreIntroduction` through `Landing.storeSection` without a
   Store-availability filter.
4. `src/infrastructure/store/service.ts:storeShop` validates configuration and
   query input, creates the request-cookie Supabase SSR client, resolves the
   selected country, and invokes `store_shop_v1` with that country and only
   explicitly supplied filters. The anonymous fixture call uses the same
   `{p_country:'EG'}` arguments as the guest homepage.
5. The existing domain schema validates the RPC response. Errors remain errors.
6. `StoreIntroduction` retains its fail-closed catch: an RPC or validation failure
   becomes a non-purchasable unavailable state. Successful projections pass
   directly to the card map, limited to four featured products.
7. The harness now separately counts real `<article class="... store-product">`
   elements in the HTTP response body and product cards in the browser DOM.

No explicit catalog-result cache, static export, client-only product filter or
second catalog backend was introduced. Source inspection alone does not exclude
an environment-specific runtime or framework problem.

## Local changes

- Add opt-in `CATALOG_SSR` boundary events: configuration validity and loopback
  port, selected country, RPC HTTP status/error code, validated projection count,
  and component input count. Events require both `APP_ENV=local` and
  `NAQL365_CATALOG_DIAGNOSTICS=1` and are capped at 128 per logger instance.
- Runtime validation rejects unknown diagnostic fields and arbitrary messages.
  No URL, API key, cookie, identity, product content, supplier amount, raw RPC
  payload or exception message is recorded. No diagnostic HTTP endpoint exists.
  Validation failures report only whitelisted schema field names, never their
  values or arbitrary path identifiers.
- Preserve schema rejection using `safeParse` followed by throwing the original
  validation error. Successful data uses the same validated public projection.
- Let the owned test server forward only structured boundary lines to the
  Commerce harness. Other stdout/stderr is consumed without being forwarded.
- Persist `ssr-boundary.json` alongside existing local test evidence, and assert
  agreement between the direct fixture RPC, successful server projection, SSR
  HTML and browser card count. Existing card/security assertions remain.
- Correct a separately verified presentation gap: an available catalog with no
  approved items now has an Arabic/English empty message and no purchase cards.
  This is **not** claimed as the hosted missing-product root cause.
- Add regressions for exact request Market/RPC arguments, invalid projections,
  denial, missing configuration, localized empty state and diagnostic privacy,
  output bounds and owned-process log transport.

## Verification evidence

The initial instrumented Windows Commerce run passed all eight grouped checks,
five representative captures, fixture cleanup and deleted-credential reuse
denial. For its same synthetic product:

| Boundary             | Observed result                  |
| -------------------- | -------------------------------- |
| SQL eligibility      | 1                                |
| Direct anonymous RPC | AVAILABLE, 1 item, no error      |
| Request-time SSR RPC | EG, HTTP 200, no error           |
| Validated projection | AVAILABLE, 1 item                |
| Component input      | AVAILABLE, 1 item                |
| Browser homepage     | HTTP 200, EG, 1 card             |
| Paused Store         | NOT_AVAILABLE, 0 projected items |

Full unit/integration suite: 424 passed across 86 files, before the final
diagnostic field-name whitelist extension. Its affected focused tests are rerun
after that extension. Full 72 bilingual mobile/desktop E2E tests passed.
TypeScript, ESLint, production build, changed-file formatting, tracked secret
scan and history heuristic secret scan passed. Secret scans are heuristic,
not proof that every possible secret format is absent.

### Linux experiment

An isolated disposable Alpine Linux container ran Node 24.20.0 and the same
Next.js 16.3.8 build/start path, with matching Linux native optional dependencies
prepared outside Git. It queried the same local synthetic fixture through a
loopback-only proxy to the existing local Supabase stack. The unchanged browser
workflow and assertions ran from the host against that Linux server.

The build and all eight Commerce checks passed: direct RPC 1, SSR projection 1,
server HTML 1 card, browser DOM 1 card. Paused Store projected zero items.
Fixture cleanup and deleted-credential reuse denial passed. The disposable
container was removed. No cloud backend was used.

Evidence: `test-results/store-local-1792500013428/` and sanitized Linux server
boundary events retained outside Git in the temporary
`naql365-ssr-linux-20261020/ssr-log.json` experiment directory. Early setup attempts
failed on dependency mounting, a bounded build-readiness budget and an incorrect
experimental native libvips version; these were corrected only in disposable
tooling. They are not evidence about the hosted catalog failure.

This is not an exact Ubuntu GitHub runner reproduction: Linux server/browser
placement, networking, filesystem and the preceding full CI job differ. Its pass
does not establish that the hosted defect is fixed or that Linux caused it.

### Final sequential browser and database checks

The local Windows Staff → Store → Commerce sequence passed without intervening
database reset or manual fixture changes:

| Harness  | Result                                                                       | Evidence directory                        |
| -------- | ---------------------------------------------------------------------------- | ----------------------------------------- |
| Staff    | Six roles, AR/EN, 60 captures; owned fixture cleanup passed                  | `test-results/staff-local-1792500080217/` |
| Store    | 13 grouped checks, 8 captures; cleanup and credential reuse denial passed    | `test-results/store-local-1792500258012/` |
| Commerce | All 8 grouped checks, 5 captures; cleanup and credential reuse denial passed | `test-results/store-local-1792500356979/` |

The final Commerce homepage evidence reads HTTP 200, EG, `ssrProductCards: 1`
and `productCards: 1`. Server boundary evidence agrees with the one-item direct
RPC and shows the expected zero-item non-purchasable projection after pausing.
The eight checks retain guest login handling, authoritative quantity badge,
refresh/navigation persistence, customer isolation, cart removal, unchanged
order snapshots, checkout/cart reset, AR/EN themes and Transport navigation.

Final affected unit tests: **29 passed**, including the last diagnostic-field
whitelist and implicit HTTP-port cases. Final TypeScript and ESLint passed.
All **209 SQL/RLS tests across 12 files passed** against the isolated local
database after browser cleanup. The final Commerce build also passed.

Commands included:

```text
npx vitest run --maxWorkers=1
npx vitest run tests/unit/store-ssr.test.ts tests/unit/catalog-trace.test.ts tests/unit/commerce-presentation.test.ts tests/unit/commerce-cart.test.ts tests/unit/browser-server.test.ts --maxWorkers=1
node scripts/test-staff-workspace.mjs
node scripts/test-store-workspace.mjs
node scripts/test-commerce-workspace.mjs
node node_modules/supabase/dist/supabase.js test db supabase/tests --local --workdir <existing-isolated-local-workdir>
npm run typecheck
npm run lint
npm run format:check
node scripts/verify-store-catalog-migration.mjs
npm run check:secrets
node scripts/check-secret-history.mjs
```

The full 72-test Playwright suite ran against a fresh guarded production build
with backend configuration unavailable, as in the Foundation quality job. The
fixture browser harnesses separately built with the local synthetic backend.

This reproduces the relevant browser sequence, not every command of the Ubuntu
Foundation job. Its separate concurrency scripts and clean reconstruction have
unchanged accepted hosted evidence; no new-head hosted run is claimed.

## Changed files

```text
src/infrastructure/store/catalog-trace.ts
src/infrastructure/store/service.ts
src/components/store/introduction.tsx
scripts/browser-server.mjs
scripts/browser-server.d.mts
scripts/test-commerce-workspace.mjs
tests/unit/catalog-trace.test.ts
tests/unit/store-ssr.test.ts
tests/unit/commerce-presentation.test.ts
tests/unit/browser-server.test.ts
docs/store/commerce-ssr-investigation-20261020.md
```

Key inspection points: `storeShop` configuration/RPC/projection in
`src/infrastructure/store/service.ts`; unchanged fail-closed catch at
`src/components/store/introduction.tsx:15`; SSR HTML and DOM assertions in
`scripts/test-commerce-workspace.mjs:230` onward. An unavailable fallback alone
does not reveal which preceding operation failed.

## Migration and security integrity

All 51 migration Git blobs remain unchanged from the accepted source. Migration
tree: `5cf821eb22758d6b78fdbbc6271742eb2873c241`.

Migration 51:
`20261019000200_store_catalog_management.sql`

SHA-256:
`7acd143c5e5a3d35ef9f6633bd26e7c346d5c42d93fdbfe6a398546c0ab99d22`.

The migration verifier also confirms the original 50 accepted migration blobs.
Existing Windows checkout line endings are not rewritten. No migrations,
database types, RLS policies, permissions, payment rules, supplier costs or
commercial activation are changed. Dependency manifests and lockfile are
unchanged; this delivery does not remediate the existing development-tool
ESLint/braces advisory.

## Next decision

**NO-GO for claiming the hosted SSR defect resolved or handing off a Preview.**
If local reproduction remains unsuccessful, the smallest next step is owner
authorization to push the exact delivered SHA and run Foundation plus Database
Types with these diagnostics. Inspect `ssr-boundary.json`,
`catalog-boundary.json` and `homepage-boundary.json` together. Diagnose the first
divergent stage before changing application behavior. A new-head hosted pass or
captured failing SSR boundary is required; the earlier direct RPC success is
insufficient.

No push, cloud database access/write, deployment, alias operation, Production
access, financial activation or operational grant is part of this delivery.
