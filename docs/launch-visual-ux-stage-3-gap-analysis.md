# Launch Visual & UX Stage 3 gap analysis

## Scope and baseline

Stage 3 starts from `develop` at `3f5a80e2a4373f20c0cd57fdae73977ae2c0c52f`. The repository contains 46 migrations. This review covers the existing staff-facing experience for SUPER_ADMIN, SALES, OPERATIONS/DISPATCH, and FINANCE/ACCOUNTANT. It is a presentation and workflow-clarity review; it does not change authorization, lifecycle rules, pricing authority, payment clearance, or database schema.

## Reviewed surfaces

- `/[locale]/portal` and the protected portal shell
- `/[locale]/portal/quotes` and quote detail/pricing review
- `/[locale]/portal/operations`, job detail, and trip detail
- `/[locale]/portal/finance`, payment detail, and bank configuration
- Shared shell, mobile menu, market selector, locale links, page headers, badges, cards, tables, empty/loading/error primitives
- Operations workspace, dispatch filters, resource assignment, reassignment, POD and issue controls
- Sales pricing and quote actions
- Finance checkout/proof review surfaces

## Findings

| Area                 | Classification              | Finding                                                                                                                                         | Stage 3 treatment                                                                                                        |
| -------------------- | --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Portal home          | Information hierarchy       | Authorized links are presented as a stack of equal primary buttons and the next action is not obvious.                                          | Group links by commercial, operations, and finance workspaces with one clear page heading and concise descriptions.      |
| Shared shell         | Navigation                  | Staff pages rely on the public shell and do not consistently expose current workspace, Market, or role context.                                 | Establish one staff workspace header/navigation pattern using existing access results.                                   |
| Quotes queue         | Usability                   | Request rows are dense and mix reference, customer, route, quote status, and action without a predictable scan order.                           | Use a responsive queue pattern with primary reference, route, Market, status, submitted time, and one primary action.    |
| Quote review         | Information hierarchy       | Customer facts, verified distance, Sales-entered commercial facts, and quote lifecycle are visually interleaved.                                | Separate factual request summary, internal verification, manual pricing, and quote status sections.                      |
| Quote review         | State clarity               | Quote status labels exist but the next action is not prominent for draft, sent, accepted, rejected, or expired states.                          | Add semantic status treatment and a next-action region without changing quote authority.                                 |
| Operations workspace | Usability                   | Orders, Jobs, Dispatch, and Resources are long sections with repeated list markup and limited section-level feedback.                           | Use consistent section headers, compact toolbars, queue cards, and responsive list/table behavior.                       |
| Operations workspace | Responsiveness              | Dense lists and resource forms can become difficult to scan on narrow screens.                                                                  | Add mobile card fallback and constrain horizontal scrolling to data regions only.                                        |
| Operations workspace | Missing feedback            | Create, assignment, and resource actions share feedback patterns but do not have a consistent visual placement.                                 | Standardize action feedback, busy, success, conflict, and retry presentation using existing command results.             |
| Finance queue        | Information hierarchy       | Payment method, payment state, proof history, customer context, and amount are shown in a plain request list.                                   | Provide a finance review row pattern that distinguishes cash due, transfer proof, rejected proof, and confirmed payment. |
| Finance queue        | Excessive technical wording | Raw payment states can require interpretation even where localized business labels exist.                                                       | Use existing localized payment state dictionaries while preserving exact authority distinctions.                         |
| Finance detail       | State clarity               | The checkout component contains the authoritative actions, but review context and dangerous actions need clearer grouping.                      | Add review context and explicit confirmation treatment without changing Finance actions or permissions.                  |
| Shared statuses      | Inconsistent design         | Quote, operational, and payment statuses use different visual treatments.                                                                       | Normalize semantic status tones with text and icon/symbol; never rely on color alone.                                    |
| Forms and dialogs    | Accessibility               | Existing primitives provide labels and some error association, but staff forms need consistent field groups, focus, disabled, and retry states. | Reuse and refine presentation primitives; do not change validation or server actions.                                    |
| Mobile navigation    | Navigation / responsiveness | Mobile menu exists, but the staff workspace context is not consistently surfaced across pages.                                                  | Keep keyboard/touch-safe menu behavior and add contextual workspace links where already authorized.                      |
| Locale and Market    | Accessibility / navigation  | Arabic RTL and English LTR are supported, but staff context and directional spacing require a consistent visual check.                          | Verify both directions at 360, 390, 768, 1280, and 1440 widths.                                                          |
| Logout               | Missing feedback            | Logout is available through the trusted session primitive, but the staff workspace should keep the action explicit and visually discoverable.   | Surface the existing logout action in the staff shell; do not add smoke flags or new auth logic.                         |

## What is not a visual defect

Missing route optimization, new operational KPIs, live driver location, ETA calculation, new projections, new Finance authority, new roles, and new lifecycle states are future capability decisions. They are not Stage 3 visual defects and are deferred rather than simulated.

## Proposed Stage 3 pattern

The representative staff workspace will use a page header with workspace context, a compact toolbar for filters and Market, bounded queue/list regions, semantic status badges, a single primary action per row, and explicit loading, empty, error/retry, validation, and success states. Dense data may scroll inside a labeled region; the page itself must not overflow horizontally. The pattern will be shared by Sales, Operations, and Finance while preserving each domain's existing labels and authority boundaries.

## Acceptance matrix

The visual matrix will cover Sales queue, request review, quote editing, sent/accepted/rejected quote states; Operations planning, assignment, active, completed, issue, and reassignment states; Finance cash due, transfer awaiting proof/review, rejected, resubmitted, and confirmed states; plus shared empty, loading, validation error, server error/retry, and success states. Each representative state will be checked in Arabic/RTL and English/LTR at 360, 390, 768, 1280, and 1440 pixels using synthetic run-owned data only.

## Authority and data boundary

No new query, RPC, write path, role, permission, migration, commercial field, or payment rule is required by this analysis. Existing server-authoritative projections and access checks will be reused. Any dashboard summary that would require a new projection is deferred and will be called out in the final report.

## Initial decision

`READY TO IMPLEMENT` as a presentation-only Stage 3. The implementation must stop and request separate review if a requested visual treatment requires a backend authority or schema change.
