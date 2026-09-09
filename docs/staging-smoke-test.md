# Staging smoke test protocol

Result vocabulary: PASS requires captured execution evidence; PARTIAL covers executed subsets; BLOCKED means the required environment/setup is unavailable. Any unexpected Auth/RLS/Storage result stops the gate. Never treat missing configuration as a passing skipped test.

## Executable checks

| Command                       | Coverage                                                                                                               | Preconditions                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| npm run test:staging:db       | Hosted migration history, transactional RLS/relational assertions, generated types                                     | Correct authenticated CLI, explicit staging ref/org, empty fixture tables |
| npm run test:staging:services | Real Auth API, refresh/revocation, customer/tenant permissions, private storage, 60-second URL expiry, live suspension | Same guard variables; creates and cleans synthetic fixtures               |
| npm run test:staging:browser  | Actual HTTPS app on desktop/mobile, AR/EN, SEO/headers/axe, customer login, account, staff denial, logout              | Verified Preview origin and controlled customer membership                |

Hosted browser variables: STAGING_BASE_URL, STAGING_TEST_USER_EMAIL, STAGING_TEST_USER_PASSWORD and, when protection requires it, VERCEL_AUTOMATION_BYPASS_SECRET. Never put values in Git, command arguments, reports or CI artifacts. Missing credentials fail the relevant tests. No browser server is started by the staging config. Traces, screenshots and videos are off; the reporter omits error objects, attachments and filled-input diagnostics.

For synthetic identities use reserved `example.test` emails with admin confirmation, so no email is sent. Passwords are generated in memory. A real PKCE email journey requires a controlled test mailbox owned by the operator; do not use another person's email or a public inbox.

## Remaining browser acceptance checks

After all executable tests pass, record these on the same reviewed deployment:

1. Arabic and English homepages: language switching, RTL/LTR, keyboard navigation, visible focus, semantic landmarks, mobile overflow, contrast and axe results.
2. Login and authorized account: input labels/autocomplete, keyboard submit, visible errors and focus, mobile layout and axe. Check Arabic login as well as English.
3. Authenticate through the actual PKCE callback with the browser's matching verifier cookie and exact redirect allowlist. Verify fresh server session and refresh cookies; invalid/foreign callbacks must fail closed. Password sign-in is separate evidence.
4. Sign in as the controlled customer; suspend its membership through trusted database administration; reload account and call `/api/staging/session` with the existing session. Both must deny protected access. Confirm data and file policies deny access; restore/remove the fixture using its exact UUID.
5. Exercise `/api/staging/files/<fixture-id>` as owner, peer customer, another tenant and suspended member. Never print the returned Location header because it contains the signed capability. Confirm existing links expire, and newly requested links are immediately denied after suspension.
6. Inspect application request/response headers, Supabase cookie Secure/SameSite flags, no-store behavior and sanitized runtime logs. Check client bundles for secret/service-role formats without outputting matches. Record only presence/absence.
7. Verify titles/canonicals/hreflang against the tested HTTPS origin. Staging must return X-Robots-Tag noindex/nofollow/noarchive, robots Disallow `/`, an empty sitemap and noindex on internal pages.
8. Sign out, revisit protected routes and verify access is denied. Remove synthetic identities, organizations and objects. Record cleanup counts, not credentials.

The SQL and services suites cover database and storage security directly. They do not substitute for the outstanding hosted browser, PKCE, cookie and application-route checks.

## Signed URL semantics

RLS is checked when issuing a signed URL. A previously issued URL is a bearer capability until its short expiry; membership suspension blocks new signing and authenticated reads immediately, but cannot retrospectively revoke that existing URL. The gate uses a 60-second TTL matching the foundation service and verifies expiry. Do not cache or log signed URLs.
