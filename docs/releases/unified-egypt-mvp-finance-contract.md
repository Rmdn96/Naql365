# Unified Egypt MVP — Finance foundation contract

## Scope and activation boundary

Migration 49 is a local, additive Finance foundation following the reviewed
catalog migration 48. Neither migration is authorized for cloud application by
this change. There are no destination records, Store orders, Store payments,
Store activation, new permission definitions or role grants in this slice.
Migrations 1–48 remain unchanged.

Transport retains `CASH` and `BANK_TRANSFER`. A configured, authorized Egypt/EGP
destination identifies `BANK`, `VODAFONE_CASH` or `INSTAPAY`; the last two are
distinct customer choices, not additional payment lifecycle states or gateways.
Only existing active destinations are displayed. An empty configuration does
not become a usable payment method merely because a channel label exists.

## Market-scoped Finance review

`finance_market_queue(p_org, p_market, p_status, p_before_created, p_before_id,
p_limit)` requires an authenticated identity with exactly one active membership,
that membership being staff in the requested organization, plus `portal.access`
and `finance.read`. The Market must belong to that organization and be active.
No permission is inferred from an email address or visual role label.

Tenant, Market and status filters precede the bounded keyset window. Page size
is 1–30, ordered by `(created_at DESC, id DESC)` with a paired timestamp/UUID
cursor. Results contain the existing safe Finance row fields and a next cursor;
there is no invented organization-wide total or public payment-destination data.
The UI identifies counts as displayed items. Status survives navigation. Cursors
are tagged with their selected Market; changing Market starts its first page
while retaining the status filter. Cursor metadata never grants authority.

The old organization-wide `finance_queue` SQL contract is not broadened or used
by the new worklist. The application compatibility adapter uses the new scoped
projection and accepts only its first page, not legacy offset pagination.
Existing Finance detail and bank administration remain server-Market-scoped.

## Customer evidence versus verified collection

An optional customer transaction reference is trimmed, 1–120 characters, with
control characters rejected. It is saved only when a reserved proof is submitted
and is part of the durable command intent. Replaying the same intent is safe;
reusing the mutation ID with a different reference is rejected. Existing proof
upload validation, private Storage, Guest authorization and finalization remain.

Customer text and proof bytes are **not funds**. They neither claim a receipt nor
clear execution. Finance independently checks actual full receipt of the accepted
amount/currency and supplies its own provider receipt identity to
`confirm_transfer`. Cash confirmation remains the existing separate collection
command; selecting CASH is not PAID.

New transfer confirmations require a 6–120-character ASCII provider reference
containing letters/digits and supported separators, with at least six
alphanumeric characters. The comparison identity is uppercase alphanumeric text
with separators removed. Unknown formats fail closed for review; they must not
be replaced with an invented receipt number. Finance notes remain private.

## Typed durable receipt claims

`private.manual_collection_receipts` is RLS-enabled, has no client table grants
or policies, and is not included in public/customer projections. The current
domain is constrained to `TRANSPORT`. Its organization/Market/payment and
organization/payment/attempt composite foreign keys establish actual typed
ownership; there is no free-form domain UUID attachment. Actor deletion is
restricted. Update/delete are rejected by an immutable-row trigger.

In one database transaction, the existing authorized command checks its durable
replay identity and revision, validates the current submitted attempt and amount,
claims the external identity, records Finance evidence, marks PAID, issues the
existing operational receipt and appends existing financial/audit events.
A conflicting unique claim aborts the entire transaction. Existing organization
locks and the registry unique constraint protect concurrent confirmations.
Retries by the original actor/intent return the original result without a second
claim or receipt.

Uniqueness is deliberately conservative: `(channel, normalized identity)` across
all tenants and receiving destinations, plus one claim per Transport payment and
attempt. This avoids bypass by duplicate destination rows, mutable account names
or a second tenant configuration. It can reject legitimate provider collisions;
there is no override, deletion/reuse or automatic split allocation. Before live
activation, the owner/Finance must establish supported provider-reference formats
and uniqueness guarantees. If provider identities are only receiver-local, a
separately reviewed stable receiver namespace is needed; mutable display names
must not become financial identity.

Historical PAID records are not rewritten or backfilled. Comparable confirmed
historical `bank_reference` values also block duplicate new claims. A historical
record without a usable provider identity cannot be deduplicated retroactively;
that limitation requires manual reconciliation and must not be represented as
complete historical receipt coverage.

## Migration 50 integration interface — proposal only

The following is a contract for future review, not a new callable API:

```ts
type Channel = 'VODAFONE_CASH' | 'INSTAPAY' | 'BANK';
type PaymentTarget =
  | {
      domain: 'TRANSPORT';
      transportPaymentId: string;
      currency: 'EGP' | 'SAR';
      channel: Channel;
    }
  | {
      domain: 'STORE';
      storePaymentId: string;
      currency: 'EGP';
      channel: 'VODAFONE_CASH' | 'INSTAPAY';
    };
type VerifiedReceiptClaim = PaymentTarget & {
  organizationId: string;
  marketId: string;
  verifiedExternalIdentity: string;
  amountMinor: bigint;
  mutationId: string;
  expectedRevision: number;
};

type StoreCollectionContract =
  | { method: 'CASH'; collector: 'SUPPLIER'; externalTransferClaim?: never }
  | {
      method: 'VODAFONE_CASH' | 'INSTAPAY';
      collector: 'NAQL365';
      financeReceiptVerificationRequired: true;
    };

// Private server-derived commercial facts, never a Customer API projection.
type StoreEntitlementSnapshot = {
  storePaymentId: string;
  supplierAgreementVersionId: string;
  supplierEntitlementMinor: bigint;
  naql365MarginMinor: bigint;
  currency: 'EGP';
};

type StoreFinanceIntent = {
  mutationId: string;
  expectedRevision: number;
} & (
  | {
      action: 'VERIFY_SUPPLIER_CASH_COLLECTION';
      storePaymentId: string;
      collectionEvidenceId: string;
      amountMinor: bigint;
      currency: 'EGP';
    }
  | { action: 'VERIFY_NAQL_TRANSFER'; claim: Extract<VerifiedReceiptClaim, { domain: 'STORE' }> }
  | {
      action: 'RECORD_MANUAL_SETTLEMENT';
      obligationId: string;
      amountMinor: bigint;
      currency: 'EGP';
      reconciliationReference: string;
    }
  | {
      action: 'RECORD_VERIFIED_REFUND';
      originalCollectionId: string;
      amountMinor: bigint;
      currency: 'EGP';
      reconciliationReference: string;
    }
  | { action: 'REVERSE_ENTRY'; originalEntryId: string; reason: string }
);
```

The database must derive the actor, amount, currency, target scope and destination
channel from authorized records rather than trusting this transport shape.
Migration 50 would add a typed Store payment FK and an exactly-one-target/domain
constraint to this same private registry, preserving the existing uniqueness
index. It must not introduce an independently claimable Store receipt registry.
Store proof submission must remain separate from verified receipt confirmation.
Store must enforce EG/EGP in its future database constraints as well as these
types; the retained SAR branch is for existing Transport only. Collector,
entitlement, margin, settlement direction and actor authority are derived by the
server from the target and approved agreement. No customer-supplied amount or
commercial snapshot is authoritative. These proposed intent names do not execute
fund transfers or approve any financial destination. Customer refund requests
remain distinct from authorized Finance recording of an actually verified refund.

Store CASH collection is by the supplier on delivery. Verified supplier cash
collection creates the agreed Naql365 receivable/margin obligation, not a claim
that Naql365 received that cash. Vodafone Cash/InstaPay collection is intended
for approved Naql365 destinations; independent Finance verification creates
the approved supplier entitlement payable. No supplier funds are paid out by
this foundation. No Transport Trip is implicitly a Store fulfillment.

Future manual reconciliation must use immutable commercial line snapshots and
separate collection, entitlement, receivable, payable and settlement facts per
supplier/fulfillment. Money uses checked integer minor units, never binary-float
or automatic FX pricing. Delivery allocation, discounts, cancellations, partial
returns/refunds and entitlement reductions require approved terms, not an
assumed formula or tax rate. Gross margin is not asserted to equal accounting
revenue, profit or taxable income.

Refund/reversal commands must have their own durable mutation identity,
permissions, bounded amount/currency and links to original confirmed collection.
They append compensating events; they never erase or release the receipt claim
for reuse. Concurrent requests must not exceed the refundable/settleable balance.
Partial collections, splitting one receipt across payments and automated supplier
settlement are outside the present full-payment contract and require review.

## Remaining owner gates

- Separate authorization to apply reviewed migrations 48/49 to Staging.
- Authorization to push this local branch for exact-head GitHub CI and review.
- Approved real recipient/channel eligibility and stable provider identity rules.
- Store supplier entitlement, margin, collection evidence and settlement terms.
- Store delivery/return/refund responsibilities, fees and cancellation policy.
- Legal seller, invoice issuer, tax and retention decisions; no defaults invented.
- Separate Migration 50 schema/command review and Store activation authorization.

No Production, Supabase cloud SQL, DNS, Hostinger or main/develop changes are
part of this implementation.
