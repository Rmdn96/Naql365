# Temporary Production release

The repository deliberately keeps `production: null`. The origin allowlist does
not authorize a deployment. No database setup or deployment runs during build.

1. Review and merge the release changes under separate authorization. Select the
   actual final release commit, not the original development baseline or a future
   guessed SHA. Use a clean checkout with Git metadata available during build.
2. In that isolated release checkout, issue the non-secret `production` manifest
   object before compilation: `origin` (exactly `https://naql365-launch.vercel.app` for
   the temporary release), `sourceCommit` (the actual `git rev-parse HEAD`),
   `projectRef` (`suozeqelwmhjlptzaqsk`), `publicKeyDigest` (SHA-256 of the verified
   Production publishable key), and fresh release `identity` and `revision` UUIDs.
   Keep the reviewed `productionOrigins` list. Archive the issued manifest and
   its hash as release evidence outside Git; do not commit a self-referencing SHA.
3. Set matching build/runtime APP_ENV, APP_URL and public Supabase configuration.
   `npm run build` checks actual Git HEAD and rejects tracked source changes other
   than the issued manifest. Controlled packaging must exclude untracked source
   and retain `.naql365-build-identity.json` and the exact issued manifest.
   An exporter lacking Git metadata cannot establish source identity for build.
4. After a successful final build, read `private.deployment_identity` through
   authorized read-only administration. Under a separate explicit authorization
   only, initialize the singleton with protocol 1, environment `production`, and
   the exact issued identity/revision. Do not copy Staging UUIDs or overwrite a
   conflicting tuple. No attestation row is created by this change.
5. Vercel runs Next.js Node functions, not `npm run start`. The existing async
   `src/instrumentation.ts` register hook validates runtime environment, reads the
   build identity, verifies it against the manifest, and awaits backend attestation
   before readiness. `next.config.ts` traces both identity and manifest into server
   output. Missing artifacts or mismatched/unavailable attestation fail closed.
   Keep APP_ENV=production, the selected APP_URL and the same verified public backend
   configuration in both build and runtime scopes. Do not deploy this release as Preview.
6. Require `npm run build` on Vercel, with the approved manifest issued before the
   guarded build and actual Git HEAD available. No automatic manifest issuance is
   provided here. Inspect packaged function artifacts before deployment authorization;
   hosted cold-start acceptance is still required after a separately authorized deploy.
   Static assets do not perform runtime attestation. Node-rendered application routes
   must pass the hook. A Node host may additionally use the guarded `npm run start`.
   Changing to `https://naql365.com` requires a separately approved manifest and
   rebuild with matching APP_URL; changing APP_URL alone is rejected. Update Auth
   callbacks separately. Preserve prior release artifacts and exact attestation
   tuple for an authorized rollback; do not weaken guards or use Staging as fallback.

This preparation grants no application roles, modifies no RLS/CSRF/business logic,
and does not authorize a deploy, Auth change, database write or commercial activation.
