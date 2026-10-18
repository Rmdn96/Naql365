# Stage 3 detailed staff visual acceptance

Application: `1b1e02fc6c316950d53d70e671faeeca82be004e`. Canonical protected origin: `https://naql365-staging-ux-stage3-naql365.vercel.app`.

Status: HISTORICAL INCOMPLETE. This application produced 222 detailed PASS captures before a genuine operational layout defect stopped acceptance. The original 60 accepted empty-dashboard screenshots remain in `../stage3-staff-shell/index.json`, unchanged and hash-verified. The expanded definition has 670 applicable combinations (67 families × AR/EN × 360/390/768/1280/1440); 448 were not captured on this application. This index does not certify the repaired application.

The `operations-planned-ar-768` failure was reproduced twice on the hosted application and once locally. Nested stop action bars inherited the global Request wizard's sticky positioning, producing two overlapping button pairs. `failed-operations-planned-ar-768.png` is explicitly FAIL evidence. The scoped CSS repair is application `8062e3ec5884827b507e8e18dab7747c369e9927`; its new detailed evidence belongs in `../stage3-staff-visual-repaired/`. Original PNGs are preserved rather than overwritten or relabeled. Read-only baseline checks and cleanup completed for both defect reproductions.

The runner loads and validates every prior accepted image SHA-256, skips valid PASS IDs, and atomically updates its index after every new capture. Failed attempts stay in `failures`; a failure never creates a PASS entry. Test-only source and evidence do not change the frozen application SHA.

## Sources and controls

- REAL_HOSTED: normal password sessions and existing permission-scoped pages reading records in one run-owned organization. Submitted customer facts are synthetic preparation; manual Quotes, customer decisions, payment transitions, planning, assignment, execution and POD use accepted database commands. No automated evaluations are fabricated.
- CONTROLLED_PRESENTATION: the owned browser intercepts a command response with a bounded 503 or holds it to inspect busy/disabled UI. No mutation is forwarded in those cases. Loading capture uses the application's actual authenticated streamed loading prefix, with completion held in the test browser. No test bypass or fake application UI is deployed.
- Navigation derives from the current effective grants in the same active organization as the loaders. Role names identify test personas, not application authorization rules. CUSTOMER and DRIVER are not staff-shell personas.
- Bank/proof fixtures contain TEST-only destinations and generated image bytes. Signed/private URLs and document contents are never opened for screenshots. No owner record is a visual fixture.

## Implemented-state boundaries

- Dashboard and queue pages have no commercial save form, so form-validation and save-success screens are not invented there. Detail routes with no accessible record use the existing not-found/authorization behavior rather than a fake empty commercial record.
- Sales success is the persisted returned draft/version presentation after the real command, not a fabricated toast. Retry is the existing preserved manual form followed by an authorized retry. Quote version history is captured separately.
- Support is read-only. It has no save/busy-mutation/success-toast state or pricing, Dispatch, Finance, or guest-link controls. Pagination and safe malformed-cursor error/recovery are covered. An empty selected Market is distinct from an entirely empty support queue.
- Finance proof submission remains distinct from confirmation. Bank settings are tested only for grants containing `finance.accounts.manage`; ordinary FINANCE must not receive that link.
- Resource availability, global KPI totals, ETA, global exceptions, search and notification totals are not added as visual states.

## Fixture and cleanup boundary

Every Auth identity, organization, customer/catalogue, Request, Quote, Order, Job, Trip, resource, issue and Storage object is recorded in the operator's ignored scoped ledger. Customer contact/address data and bank destinations are synthetic. Ordinary fixture deletion uses the established cleanup gate. The new isolated tenant's immutable synthetic tax version requires a trusted operator cleanup transaction: after commercial dependents have been removed, an exclusive table lock covers a temporary pause of only `tax_version_immutable`; only the exact run-owned STAGING_TEST tax row is deleted, and the trigger is restored before commit. Failure rolls back both the trigger operation and deletion. No RLS, role grant, function definition or accepted tax record is changed. Guard readback and baseline fingerprints are checked.

Early preparation failures (membership ordering, invalid synthetic reference, Windows command-length limit and outdated test RPC arguments) are historical harness failures. Their run-owned cloud rows and credentials were recovered; they are not application failures and are not relabeled PASS. Complete preparation was subsequently verified against local Supabase and cleaned before restarting hosted capture.

Automated layout, keyboard/focus, labels and axe smoke are checks with bounded coverage, not WCAG or assistive-technology certification. Representative PNGs must also be visually inspected before final PASS.
