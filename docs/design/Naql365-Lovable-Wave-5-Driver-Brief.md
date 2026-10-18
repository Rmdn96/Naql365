# Naql365 Design Lab — Wave 5 Driver brief

Owner-authorized presentation-only work. Send this brief in the existing **Naql365 Design Lab** project, not a new project: https://lovable.dev/projects/45d7c85b-e937-48ee-8d57-251cc16a57b8.

## Design request

Create the Wave 5 Driver Experience visual concept using the existing Design System V2. Preserve all prior public, authentication, Customer and Staff lab work. Lovable is a restricted design lab, not the canonical application or official acceptance deployment. Do not publish or synchronize the lab into the canonical repository.

Canonical authority is the existing Next.js application in Rmdn96/Naql365; Codex reviews the complete generated diff and ports compatible presentation only. No database, Auth, Supabase project, integrations, credentials, dependencies, replacement router/runtime or independent theme storage. All 47 migrations and existing business/security authority remain unchanged.

Design Arabic first with full RTL, complete English/LTR, Saudi/Egypt contexts, Light/Dark/System and 360/390/768/1280/1440 responsive layouts. Use semantic theme tokens, Alexandria/Inter, navy/slate surfaces, clear blue actions and restrained cyan route nodes. Controls should be comfortably touchable, approximately 48px for primary execution actions; compact but readable desktop/tablet layout. Do not encourage interaction while driving: place concise localized safety guidance to interact only when safely stopped.

## Existing product contract

- Assigned Trips only; Today / Upcoming / Completed, with existing bounded pagination. Do not invent global totals, unassigned work, availability or earnings.
- Trip cards can display the real business reference, authoritative status, Market, scheduled local time, vehicle identifier, completed/total Stops and next unfinished Stop. A schedule is not an ETA.
- Trip detail prioritizes the actual next pickup/delivery Stop, address/instructions/contact where authorized, and one existing authoritative next action. Preserve the existing action-selection predicate and Finance/execution clearance. No optimistic completion or mock success.
- Existing commands: dispatch, arrive, start_service, complete_stop, depart and complete_trip. Do not add or rename lifecycle states or commands.
- Existing issue form: selected unfinished Stop, existing category, required reason and optional PNG/JPEG evidence. Preserve retry/idempotency semantics and existing validation.
- Existing POD: recipient, optional notes, drawn signature or image upload, optional event location, reservation/finalization, pending/error/retry/final states. A pending upload is not completed POD. Completed Trip history remains read-only and redacts contact/address according to the existing projection.
- The product already has policy/assignment-authorized **foreground** location publication while its page is active, plus optional event-only location for arrival/POD. Preserve this implementation and its actual waiting/denied/offline/stopped/other-tab/error states. Do not invent GPS values, ETA, background tracking, an offline queue or synchronization. Do not replace this existing behavior with an invented tracking engine, and do not remove accepted behavior as part of visual work.
- Execution currently requires connectivity. Error copy must communicate an unconfirmed operation and the existing safe retry/refresh path, never promise a queued action was completed.
- Existing public chrome already supplies the accepted theme and Market controls on Driver routes. Avoid adding independent or duplicated controls. Any compact Driver-specific chrome must reuse the existing components and cookie preference; a displayed Market cannot grant assignment authority.

## Visual deliverables

Design the assigned-trip dashboard, Trip/Stop detail, execution controls, issue reporting, signature/POD section, completed/read-only history, loading/empty/error/success/disabled states. Use clear grouped sections and status text/icons, not color alone. Show route/Stop hierarchy without fabricated map data. Preserve form labels, keyboard focus, file-input alternative to drawing and accessible feedback. Keep signature canvas ink legible in Dark mode: its white drawing substrate may remain intentional.

Use nonfunctional labeled visual slots where authorized product facts are unavailable. Do not generate demo trips/business amounts, mock permission predicates, command simulations, alternate Auth, new routes/runtime, fake offline state engines or client-only authority. Describe needed visual states rather than claiming a successful command. Codex will use ledger-owned synthetic records only during canonical protected acceptance.

Return the changed file list, commit SHA, visual decisions and any assumptions. Do not publish, enable a backend, connect privileged services or change prior waves. Stop after the Driver concept so Codex can inspect the diff.

## Integration and acceptance

Diff review precedes canonical source edits. Reject unsupported generated fields, dependencies, business data, access checks, command handlers and router/runtime changes. Adapt only compatible UI to the existing Next.js components/authorized projections. Vercel canonical Preview remains https://naql365-staging-ui-v2-naql365.vercel.app; Lovable preview is internal design iteration only.

Canonical acceptance requires full unit/integration and local E2E, SQL/RLS/generated types, independent concurrency, Driver isolation/reassignment/role-loss, real Driver execution/POD journeys, Customer/Staff affected regressions, AR/EN/RTL/LTR/SA/EG/three-theme/five-width risk-based visual matrix, keyboard/focus/axe smoke, owned fixture ledgers and independent cleanup/credential disposal, secret/history scans and exact-head delivery CI. No WCAG certification claim.
