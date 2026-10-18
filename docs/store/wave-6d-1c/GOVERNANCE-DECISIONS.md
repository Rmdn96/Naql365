# Governance decision register — pending explicit owner acceptance

The local recovery strategy remains approved. Prior conditional encrypted Staging
export approval is historical; the latest instruction requires new explicit
approval before any live customer-data export. None of these instructions approves
the decisions below, role grants, Store activation or Migration 48 application.
No binding legal retention period is invented.

| ID  | Decision proposed for owner acceptance                                                                                       | Current enforcement / evidence                                                                                       | Required decision                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G01 | Retain approval records; restrict deletion of referenced approval actors; use a reviewed retention/anonymization process     | Migration 48 approver profile FKs use RESTRICT; immutable approved versions remain attributable                      | Approve retention responsibilities and interaction with existing account deletion; obtain legal review for erasure/retention conflicts                      |
| G02 | Keep supplier agreement evidence private, immutable by approved version and accessible only to authorized sourcing reviewers | Versioned private agreement references; no new bucket, public evidence URL or live agreement data                    | Name evidence custodian, approved repository, access/revocation process, retention policy and legal-hold procedure                                          |
| G03 | Require owner-approved typed identity/retail/delivery/returns policies; decide maker/checker separation explicitly           | Authenticated approver and version/evidence references are recorded; strict two-person separation is NOT implemented | Approve accountable approvers and whether two-person separation is mandatory; if mandatory, review a separate narrow change before use                      |
| G04 | Keep zero Staff Store grants until separately approved                                                                       | Seven definitions only; no existing global role, including SUPER_ADMIN, automatically receives Store permissions     | Approve exact permission combinations and global-role impact; do not combine grants across organizations; preserve canonical single-organization resolution |
| G05 | Leave Store scope unprovisioned; a separately approved EG/EGP scope must initially be PAUSED                                 | No scope seed; scope pause defaults true; ordinary Store RPCs cannot provision scope                                 | Approve exact organization/Market identity, provisioning actor and independent activation gate; legal/payment/publication decisions remain separate         |
| G06 | Restrict backup access and approve data/key retention and independent recovery custody                                       | Synthetic AES-GCM + CurrentUser DPAPI succeeded; local-only key custody has a same-profile/device limitation         | Approve retention/deletion, encrypted second-copy destination if desired, custodians and protected recovery-key escrow; no automatic upload or key export   |

## Exact Store permission definitions — no grants authorized

- `store.catalog.read`
- `store.catalog.manage`
- `store.catalog.publish`
- `store.sourcing.manage`
- `store.supplier_cost.read`
- `store.catalog.policy.manage`
- `store.catalog.policy.approve`

No email-based authority, inferred Finance access, implicit SUPER_ADMIN grant or
cross-organization permission union is approved. Supplier costs and agreement
evidence remain private. Schema shape validation is not legal approval of policy
content, supplier contracts, tax, invoice issuer or payment collection eligibility.

## Apply decision checklist

Before a later apply request, require the exact source/checksum, verified live
backup access and local recovery result, scoped drift/ledger check, acknowledged
Auth/Storage exclusions, recovery ownership and the necessary governance decisions.
Any requirement for changed schema, approvals or access must be reviewed separately.
The approved economical strategy removes the need to buy PITR or a second cloud
project; it does not remove the requirement to demonstrate the chosen backup works.

**Current decision: NO-GO for Migration 48.** Recovery is only proven for synthetic
application data, live TLS access is blocked, and governance decisions remain open.
