# Staging smoke test protocol

PASS requires real execution evidence. PARTIAL and BLOCKED must never be relabeled as PASS. Localhost is regression evidence only. Use the genuine Preview recorded in the report for the phase being verified; Phase 0.5 evidence remains historical.

## Executable checks

| Command                         | Coverage                                                                              | Preconditions                                                                                 |
| ------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| npm run test:staging:db         | Hosted history, transactional RLS/integrity assertions, generated types               | Correct CLI login, explicit staging ref/org, no persistent fixtures                           |
| npm run test:staging:services   | Real Auth/refresh/revocation, tenant/customer permissions, private storage and expiry | Same guard variables; creates and cleans its own fixtures                                     |
| npm run test:staging:acceptance | Full hosted desktop/mobile browser suite with ephemeral customer/file fixtures        | Verified Preview origin, project-scoped automation credential, correct CLI and staging guards |
| npm run test:staging:browser    | Low-level browser runner                                                              | Fixtures already provisioned by the acceptance harness                                        |
| npm run test:staging:intake     | Phase 1 persisted customer request journey and negative API tests                     | Guarded intake configuration plus verified protected Preview and CLI access                   |

Run the database suite before provisioning browser fixtures. Hosted tests do not start a local server. The acceptance harness creates random-password synthetic identities with reserved example.test addresses, two organizations and harmless PDF objects. It confirms project name/organization/health, keeps admin credentials only in the Node test process, sends only customer credentials/JWTs to the application, and cleans exact generated UUIDs in finally. No email is sent by synthetic tests.

Run hosted database, service and browser suites sequentially, including across operator terminals. A checkout-local exclusive lock prevents overlap and is released after cleanup. If a process is interrupted, inspect the recorded PID in `supabase/.temp/hosted-verification.lock`; remove that one stale file only after confirming the process has stopped. Never change provider rate limits or accept a login redirect as proof of the expected suspended-member state. The test explicitly requires a still-valid Auth identity, denied database permission and the server's forbidden state.

Operator inputs: STAGING_BASE_URL, STAGING_SUPABASE_PROJECT_REF, STAGING_SUPABASE_ORG_ID, VERCEL_AUTOMATION_BYPASS_SECRET and the correct Supabase CLI login. The harness generates STAGING_TEST_USER_EMAIL, STAGING_TEST_USER_PASSWORD, STAGING_TEST_PROFILE_ID, STAGING_TEST_ORG_ID, STAGING_TEST_FILE_ID, STAGING_TEST_PEER_FILE_ID, STAGING_TEST_ADMIN_KEY and STAGING_TEST_PUBLIC_KEY in memory for its child test process. Never store their values in Git or reports. Clear unrelated inherited CLI credentials before selecting the correct account.

Traces/screenshots/videos are off. The reporter emits test names/status and a sanitized diagnostic category/line only, never raw errors, filled inputs, attachments or signed URLs. All actual test failures remain failures.

## Hosted coverage

The automated suite covers AR/EN homepages, login/root routing, robots/sitemap, titles/canonicals/hreflang/JSON-LD/noindex, headers/CSP, responsive overflow, keyboard focus, axe on public/login/protected pages, real password login, refresh, customer/staff separation, logout and protected denial.

It also uses the real browser customer's JWT to verify organization/customer isolation, denied membership promotion and audit tampering. The hosted file route must allow its owner, deny another customer's file and anonymous access, produce a valid signed URL, reject it after 60 seconds, and deny newly requested links when membership is suspended. Existing-session account and session endpoint must deny suspension immediately. Tests restore/remove only their own fixture rows.

Browser asset inspection discovers scripts from the actual DOM, downloads every discovered script and compares against privileged fixture values only inside Node. Provider-injected Vercel tooling is fetched without the app's protection credential. This avoids mistaking CSP's correct refusal of a third-party browser fetch for a bundle leak. CSP is unchanged; no script or security assertion is skipped.

## Real email / PKCE protocol

1. Obtain a mailbox explicitly controlled by the operator. Create only a temporary Staging customer identity and scoped membership. Do not place the address, password, link, code or cookie in the report or repository.
2. Open the protected Preview through authorized Vercel access. Verify the account route first redirects to localized login.
3. Submit the technical email-link form. Confirm the SSR verifier exists through the genuine flow, without printing it. No user creation is allowed by this form.
4. Open only the test email. Validate the verification host is the independent Staging Supabase project and the callback is the exact allowed Preview URL. Follow the link in the same browser profile. Never copy it to chat or logs.
5. Observe the real `/auth/callback` exchange reaching the localized account. A trusted scoped SQL aggregate may confirm S256 flow consumption/session creation; never select auth_code, verifier, token or cookie values.
6. Reload, verify the account remains authorized, sign out, then revisit account and verify localized login. Repeat for the other locale.
7. Delete the temporary identity/membership/organization; preserve required role/permission catalogues. Keep only sanitized outcomes and timestamps as evidence.

This protocol was executed in Chrome in Arabic and English on the accepted Preview during closeout. Email delivery is operator-assisted and deliberately not a fake generated link or mocked PKCE test.

## Signed URL semantics

RLS is checked when a signed URL is issued. A prior URL remains a bearer capability until its short expiry. Suspension blocks new signing and authenticated reads immediately; it does not retrospectively revoke an already issued URL. The service uses a 60-second TTL and tests rejection after 65 seconds. Do not cache or log signed URLs.
