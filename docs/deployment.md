# Staging deployment

Project: **naql365-staging** (`prj_QYnu3qbPjQWyAcgNDYoDmpH6sN8z`), team naql365. Next.js, Node 24, `npm ci`, `npm run build`. Dependencies remain pinned.

## Verified first-deployment behavior and one-time bootstrap

Vercel CLI 59.13.1 accepts Preview but removes that target before serializing the creation request (`postDeployment`). Vercel classifies the first deployment of a new project as Production. The original Preview-only attempt was removed; repeating it did not provide a supported solution.

The owner subsequently explicitly authorized one infrastructure-only bootstrap. The supported command was `vercel deploy --prebuilt --prod --skip-domain --yes --scope naql365`, run from an isolated Build Output API directory outside the application repository. It contained a 372-byte static 404/noindex payload, no functions, environment variables, application or database connection. It was not a Naql365 production release.

Bootstrap ID: dpl_A9tbFm4qjbwJbRR8CmzK6oXcvWqY. Classification: Production, READY. `--skip-domain` prevented normal production domain promotion but Vercel still assigned the derived alias naql365-staging-naql365.vercel.app. Deployment Protection remained enabled. Record actual aliases; do not claim this flag guarantees zero aliases. The canonical report records final cleanup.

The following application deployment was independently verified READY with `target: null` (Preview). The bootstrap is never acceptance evidence. See [official staged deployments](https://vercel.com/docs/cli/deploying-from-cli), [Build Output API](https://vercel.com/docs/build-output-api/configuration), and [API target semantics](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment).

## Accepted Preview procedure

1. Fetch GitHub and verify a clean reviewed feature/develop commit. Never deploy the application with `--prod` for Staging.
2. Use the linked staging project and `vercel deploy --target preview --yes --scope naql365`. Independently read the deployment API: READY, target null, expected project, branch and commit. CLI deployment from the GitHub branch is the current operator-controlled workflow; automatic Git deployment is not connected.
3. Keep all four application variables in Preview only: APP_ENV, STAGING_AUTH_SMOKE_ENABLED, NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY. Development and Production have no Naql365 variables. No service-role/management/database credential is installed in Vercel.
4. Derive APP_URL from VERCEL_URL in Staging. Rotate the exact Site URL and Arabic/English callback entries in `config/staging/supabase/config.toml` to the verified deployment origin, then diff/push only that config. Retire the previous origin; never allow arbitrary preview hosts.
5. Run the guarded hosted acceptance harness with secure process configuration and Deployment Protection enabled. The automation bypass is scoped to the exact application origin, never forwarded to Supabase or third-party scripts.
6. Record the deployment source SHA separately from later documentation/test-only commits. No promotion or merge is implied by successful acceptance.

The Phase 0.5 accepted origin is recorded in its canonical report. The Phase 1 candidate is https://naql365-staging-iiyfses3k-naql365.vercel.app, deployment dpl_6eRYjg9oJE82xqjTmzcQ6TvDEuAg, application source ebd2a63a156a022953c6625701889630c59c2016. Its final acceptance is recorded separately in the Phase 1 report. Phase 1 Auth rotation includes four exact callback entries: AR/EN account and AR/EN password recovery. Confirmation remains required when customer registration is enabled.

## Provider tooling and security

Deployment Protection remains `all_except_custom_domains`; no custom public production domain is configured for this application. Preview feedback was disabled at the project level using the supported `enablePreviewFeedback: false` setting. An already-created deployment can still inject Vercel's toolbar script. Existing CSP correctly denies its cross-origin fetches. Asset inspection downloads every DOM-observed script in the Node test process and never relaxes CSP or omits scripts. Provider script requests receive no protection credential.

[Toolbar settings](https://vercel.com/docs/vercel-toolbar/managing-toolbar) and [project API](https://vercel.com/docs/rest-api/projects/update-an-existing-project) document the supported controls. Do not add third-party CSP permissions merely for toolbar convenience.

## Git and CI

Workflow: feature/* → develop → main. Both protected branches require a PR, an approving review, resolved conversations and strict current checks named `Lint, types, tests and production build` and `Supabase migrations and RLS`. Rules apply to admins; force pushes/deletion are disabled. PR #1 was integrated into develop only after the required independent approval and passing checks; Phase 1 starts from that remote develop. No Phase 1 merge or main merge is authorized. The existing repository default branch remains unchanged.

CI installs the lockfile, checks formatting/secrets/lint/types, runs unit/integration, production build, desktop/mobile E2E, reconstructs a fresh local Supabase instance on Linux, runs SQL security tests, regenerates types and typechecks. Hosted database commands are operator-controlled and never run against a shared project from untrusted PRs.

## Phase 2 closeout

Phase 1 PR #2 was subsequently merged with the required independent review; Phase 2 starts from accepted develop 4d3b25730e3b604882a860ade414f98fd888766b. Phase 2 remains on its feature branch and must not be merged or promoted by this closeout. The canonical Phase 2 report records the current Preview and separate documentation commits. No Production environment variables or application deployment are introduced.

Phase 2 application source: `00e5b33bb91a139afa64130c519417c970a2f4ee`; Preview deployment `dpl_49bf9y8Z1rDeYrDQ3zztCBLCB9Xm` at https://naql365-staging-hxbh6u7bq-naql365.vercel.app. Later closeout commits contain tests/documentation and the exact Auth origin configuration. This deployment is Preview, not a Production release.

## Phase 3 accepted Preview

Phase 2 was merged through protected PR #3 into accepted develop `86ba612a5f6f7f4afd7a5c0650d5b4d3848f2b6f`. Phase 3 continues exclusively on `feature/phase-3-operations-dispatch-pod`; no merge is authorized. Application source `3bff649ed8132accfce84f53a6df1517ff079268` passed both jobs in CI 34695503511 before deployment.

The current protected Preview is https://naql365-staging-nuy9j66y2-naql365.vercel.app, deployment `dpl_267qYKS5siSkbk5kXHYBMKmDA4W1`, independently READY with Preview target. It replaces the first Phase 3 candidate after correction of nested main landmarks. The exact Supabase Auth allowlist was rotated to this origin with no wildcards. All 21 hosted acceptance and Phase 0–2 regression tests passed on this exact Preview; fixtures and temporary protection bypass credentials were removed. Consult the canonical Phase 3 report for the final decision; a READY deployment alone is not acceptance.
