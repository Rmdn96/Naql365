# Staging deployment

The Vercel project is **naql365-staging**, project ID prj_QYnu3qbPjQWyAcgNDYoDmpH6sN8z, in team naql365. Framework: Next.js. Runtime: Node 24. Install: `npm ci`. Build: `npm run build`. No dependency versions were upgraded for Phase 0.5.

APP_ENV, STAGING_AUTH_SMOKE_ENABLED and both public Supabase variables are configured for **Preview only**. No service-role, database password or Supabase management token is configured in Vercel. `.vercel` and all local environment files are ignored. Deployment protection remains enabled; do not disable it to run tests.

## First-deployment blocker

Closeout audit (2026-09-09) confirmed the exact client behavior in the installed Vercel CLI 59.13.1. In `postDeployment`, `deploymentOptions.target === "preview"` causes `deploymentOptions.target = undefined` before the JSON creation request. Thus the CLI flag is not an explicit Preview constraint in the API request. Vercel then applies its documented first-deployment Production behavior to this new project. The project currently has no Git link, no targets and zero deployments; `autoAssignCustomDomains` is true. These are observed settings, not evidence that changing the Git link or domain assignment would prevent the provider's first-deployment classification.

The API documentation describes omitted target as Preview but the domain documentation explicitly describes first deployment as Production. No supported setting or first-deployment procedure was found that guarantees Preview for this project. The API's `target: null` response denotes a genuine Preview; a renamed environment, an unaliased Production deployment or a manually changed label does not qualify. No new creation attempt was made during closeout because the same known fallback could recreate Production. No project setting was changed speculatively.

Read-back through the individual environment-variable API verified the Preview Supabase URL and an exact match between its publishable key and the independent Staging project's key, without logging values. The list endpoint returns encrypted payloads even when passed a decrypt query; comparing those ciphertexts to plaintext is not a valid isolation test. Development and Production contain zero Naql365 variables. APP_ENV and STAGING_AUTH_SMOKE_ENABLED remain server-only, Preview-scoped sensitive records; their stored values cannot be read back, so runtime validation remains pending.

For reproducibility, the inspected CLI package contains `dist/chunks/chunk-N6HP5BLI.js`, function `postDeployment`, around line 11434; `parseTarget` first accepts the supplied flag, and the client subsequently removes Preview before serialization. References: [creation API target semantics](https://vercel.com/docs/rest-api/deployments/create-a-new-deployment), [individual variable read-back](https://vercel.com/docs/rest-api/projects/retrieve-the-decrypted-value-of-an-environment-variable-of-a-project-by-id), and the first-deployment documentation below.

On 2026-09-09, Vercel CLI 59.13.1 received `deploy --target preview --yes --scope naql365` but returned `target: production` for the new project's first deployment. The build succeeded. Deployment dpl_2LdRGd4cmXDbVqd9HmJwoV9r2GTS was immediately removed; the project subsequently had zero deployments. It had no Supabase credentials or business data. This attempt is not accepted as Staging evidence, and the report does not claim that no Production-classified deployment occurred.

Vercel's [domain documentation](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting) states that a new project's first deployment is Production. This conflicts with this phase's explicit Preview-only restriction. Do not repeatedly retry, retain a placeholder Production deployment, promote a branch or change APP_ENV to work around the restriction. The application now rejects this target/configuration mismatch before compilation.

The owner must obtain a Vercel-supported Preview-only provisioning path for this team/project (or explicitly revise the environment restriction in a separate instruction). No such revision is assumed. No support message was sent on the user's behalf. The project is provisioned but the deployment gate is BLOCKED.

## After the provisioning blocker is resolved

1. Verify the exact team/project and independent Supabase reference. Preserve Preview-only environment scopes and protection.
2. Deploy the reviewed feature commit through the supported Preview path. Check the API's actual target, READY status and git SHA; a successful build alone is insufficient.
3. Use the deployment's generated URL as APP_URL, or allow the server to derive it from VERCEL_URL. Configure exact Supabase Site URL and callback allowlist before Auth testing. If using a stable preview alias, explicitly configure APP_URL to that alias and test that origin.
4. Run `npm run test:staging:browser` with the verified STAGING_BASE_URL and a controlled test identity in secure process variables. Keep protection enabled; use a project-scoped VERCEL_AUTOMATION_BYPASS_SECRET only for automation. The browser fixture sends it only to the exact app origin, never to Supabase or another redirect target.
5. Record deployment ID, source SHA, target, checks and timestamps without credentials. Never print raw project environment payloads or debug CLI output.

## Git and CI

Baseline: 184ac2374a7e9611b4b265efc7dac21b57b7a2b1. Workflow: feature/* → develop → main. Phase 0.5 was branched from develop at that baseline. main and develop were created at the existing baseline because they did not previously exist; no merge was performed.

Both branches require a PR, an approving review, resolved conversations and current successful checks named `Lint, types, tests and production build` and `Supabase migrations and RLS`. Rules apply to admins; force pushes and branch deletion are disabled. A separate reviewer is needed; the author cannot approve their own PR. GitHub repository default branch was left unchanged.

CI installs the lockfile, checks formatting/secrets/lint/types, runs unit and embedded integration tests, builds, runs desktop/mobile E2E, reconstructs a separate local Supabase database on the Linux runner, runs SQL security tests, regenerates types and typechecks. Cloud staging commands are operator-controlled and never silently run against a shared database on ordinary PRs.
