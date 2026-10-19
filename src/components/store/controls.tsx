'use client';
import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input, Select, Alert } from '@/components/ui/primitives';
import {
  storeCart,
  type StoreCart,
  type StoreCommand,
  type StoreOrder,
  type StoreProduct,
} from '@/domain/store/model';
import { storeLabel, storeMoney, storeText } from '@/i18n/store';
import { storeTotals } from '@/domain/store/totals';
type Locale = 'ar' | 'en';
function useStoreCommand(locale: Locale) {
  const router = useRouter(),
    identities = useRef(new Map<string, string>());
  const [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState<'error' | 'success' | null>(null);
  const t = storeText[locale];
  async function run(command: Omit<StoreCommand, 'mutationId'>) {
    if (busy) return;
    const key = JSON.stringify(command);
    if (!identities.current.has(key)) identities.current.set(key, crypto.randomUUID());
    setBusy(true);
    setFeedback(null);
    try {
      const response = await fetch('/api/store', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...command, mutationId: identities.current.get(key) }),
      });
      if (!response.ok) throw Error('Store command unconfirmed');
      const result: { id?: string; revision?: number } = await response.json();
      setFeedback('success');
      router.refresh();
      return result;
    } catch {
      setFeedback('error');
    } finally {
      setBusy(false);
    }
  }
  return {
    run,
    busy,
    status: (
      <div aria-live="polite">
        {busy ? (
          <p role="status">{t.busy}</p>
        ) : feedback ? (
          <Alert tone={feedback}>{t[feedback]}</Alert>
        ) : null}
      </div>
    ),
  };
}
export function AddToCart({ product, locale }: { product: StoreProduct; locale: Locale }) {
  const t = storeText[locale],
    command = useStoreCommand(locale),
    router = useRouter();
  const [error, setError] = useState(false);
  return (
    <div>
      {command.status}
      {error && <Alert tone="error">{t.error}</Alert>}
      <Button
        disabled={command.busy}
        onClick={async () => {
          setError(false);
          try {
            const response = await fetch('/api/store?kind=cart', { cache: 'no-store' });
            if (response.status === 401) {
              router.push('/' + locale + '/login');
              return;
            }
            if (!response.ok) throw Error('Cart unavailable');
            const cart = storeCart.parse(await response.json());
            const items = cart.items.map((i) => ({
              listingId: i.listingId,
              revision: i.savedRevision,
              quantity: i.quantity,
            }));
            const existing = items.find((i) => i.listingId === product.listingId);
            if (existing) {
              existing.quantity = Math.min(999, existing.quantity + 1);
              existing.revision = product.revision;
            } else
              items.push({ listingId: product.listingId, revision: product.revision, quantity: 1 });
            await command.run({ action: 'cart', revision: cart.revision, payload: { items } });
          } catch {
            setError(true);
          }
        }}
      >
        {t.add}
      </Button>
    </div>
  );
}
export function CartForm({ cart, locale }: { cart: StoreCart; locale: Locale }) {
  const t = storeText[locale],
    command = useStoreCommand(locale);
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        await command.run({
          action: 'cart',
          revision: cart.revision,
          payload: {
            items: cart.items
              .map((i) => ({
                listingId: i.listingId,
                revision: i.revision,
                quantity: Number(data.get(i.listingId)),
              }))
              .filter((i) => i.quantity > 0),
          },
        });
      }}
    >
      {command.status}
      {cart.items.map((i) => (
        <div className="store-line" key={i.listingId}>
          <div>
            <strong>{locale === 'ar' ? i.content.title_ar : i.content.title_en}</strong>
            <p>{storeMoney(i.amountMinor, locale)}</p>
            {(!i.available || i.revision !== i.savedRevision) && <p role="status">{t.changed}</p>}
          </div>
          <Input
            id={i.listingId}
            name={i.listingId}
            label={t.quantity}
            type="number"
            min={0}
            max={999}
            defaultValue={i.quantity}
            required
          />
        </div>
      ))}
      <Button disabled={command.busy}>{t.save}</Button>
    </form>
  );
}
export function CheckoutForm({ cart, locale }: { cart: StoreCart; locale: Locale }) {
  const t = storeText[locale],
    command = useStoreCommand(locale),
    router = useRouter();
  const [contractId, setContractId] = useState(cart.contracts[0]?.id ?? ''),
    [method, setMethod] = useState('CASH');
  const contract = cart.contracts.find((c) => c.id === contractId);
  const totals = contract ? storeTotals(cart.items, contract) : null;
  const subtotal = totals?.subtotal ?? 0;
  const available =
    !!contract &&
    !!totals &&
    cart.items.length > 0 &&
    !cart.checkedOutOrderId &&
    cart.items.every((i) => i.available && i.revision === i.savedRevision);
  const tax = totals?.tax ?? 0;
  const destinations = cart.destinations.filter(
      (d) => d.channel === method && contract?.destinationIds.includes(d.id),
    ),
    methodAvailable = method === 'CASH' ? contract?.codRelease : destinations.length > 0;
  return (
    <form
      className="store-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!available || !methodAvailable) return;
        const data = new FormData(e.currentTarget);
        const result = await command.run({
          action: 'checkout',
          revision: cart.revision,
          payload: {
            contractId: contract.id,
            contractRevision: contract.revision,
            address: {
              name: String(data.get('name')),
              phone: String(data.get('phone')),
              region: String(data.get('region')),
              line: String(data.get('line')),
            },
            method,
            ...(method !== 'CASH' ? { destinationId: String(data.get('destinationId')) } : {}),
          },
        });
        if (result?.id) router.push('/' + locale + '/store/orders/' + result.id);
      }}
    >
      {command.status}
      <p>{t.review}</p>
      {!available && <Alert>{t.blocked}</Alert>}
      <Select
        id="contract"
        label={t.contracts}
        value={contractId}
        onChange={(e) => setContractId(e.target.value)}
        required
      >
        <option value="">{t.selection}</option>
        {cart.contracts.map((c) => (
          <option key={c.id} value={c.id}>
            {locale === 'ar' ? c.termsAr : c.termsEn}
          </option>
        ))}
      </Select>
      <Input
        id="store-name"
        name="name"
        label={t.name}
        autoComplete="name"
        maxLength={120}
        required
      />
      <Input
        id="store-phone"
        name="phone"
        label={t.phone}
        type="tel"
        autoComplete="tel"
        maxLength={40}
        required
      />
      <Select id="store-region" name="region" label={t.region} required>
        <option value="">{t.selection}</option>
        {contract?.regions.map((region) => (
          <option key={region}>{region}</option>
        ))}
      </Select>
      <Input
        id="store-address"
        name="line"
        label={t.address}
        autoComplete="street-address"
        maxLength={500}
        required
      />
      <Select
        id="store-method"
        label={t.method}
        value={method}
        onChange={(e) => setMethod(e.target.value)}
      >
        <option value="CASH" disabled={!contract?.codRelease}>
          {t.cash}
        </option>
        <option value="VODAFONE_CASH">{storeLabel('VODAFONE_CASH', locale)}</option>
        <option value="INSTAPAY">{storeLabel('INSTAPAY', locale)}</option>
      </Select>
      {method !== 'CASH' && (
        <>
          <Alert>{t.proofNote}</Alert>
          <Select id="destination" name="destinationId" label={t.method} required>
            <option value="">{t.selection}</option>
            {destinations.map((d) => (
              <option key={d.id} value={d.id}>
                {locale === 'ar' ? d.labelAr : d.labelEn}
              </option>
            ))}
          </Select>
          {!destinations.length && <p>{t.noTransfer}</p>}
        </>
      )}
      <dl className="store-totals">
        <dt>{t.price}</dt>
        <dd>{storeMoney(subtotal, locale)}</dd>
        <dt>{t.delivery}</dt>
        <dd>{contract ? storeMoney(contract.deliveryMinor, locale) : '—'}</dd>
        <dt>{t.tax}</dt>
        <dd>{contract ? storeMoney(tax, locale) : '—'}</dd>
        <dt>{t.total}</dt>
        <dd>{totals ? storeMoney(totals.total, locale) : '—'}</dd>
      </dl>
      <p>{contract && (locale === 'ar' ? contract.termsAr : contract.termsEn)}</p>
      <label className="store-check">
        <input type="checkbox" required /> {t.terms}
      </label>
      <Button disabled={command.busy || !available || !methodAvailable}>{t.place}</Button>
    </form>
  );
}
export function ProofForm({ order, locale }: { order: StoreOrder; locale: Locale }) {
  const t = storeText[locale],
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState<'success' | 'error' | null>(null),
    router = useRouter();
  const ids = useRef<{
    fileId: string;
    reserveId: string;
    submitId: string;
    revision: number;
  } | null>(null);
  return (
    <form
      className="store-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (busy) return;
        const form = new FormData(e.currentTarget);
        ids.current ??= {
          fileId: crypto.randomUUID(),
          reserveId: crypto.randomUUID(),
          submitId: crypto.randomUUID(),
          revision: order.revision,
        };
        for (const [key, value] of Object.entries(ids.current)) form.set(key, String(value));
        form.set('orderId', order.id);
        form.set('revision', String(ids.current.revision));
        setBusy(true);
        setMessage(null);
        try {
          const r = await fetch('/api/store/proof', { method: 'POST', body: form });
          if (!r.ok) throw Error('Unconfirmed proof');
          setMessage('success');
          router.refresh();
        } catch {
          setMessage('error');
        } finally {
          setBusy(false);
        }
      }}
    >
      <h2>{t.proof}</h2>
      <p>{t.proofNote}</p>
      {message && <Alert tone={message}>{t[message]}</Alert>}
      <Input
        id="store-proof"
        name="file"
        label={t.proof}
        type="file"
        accept="image/jpeg,image/png,application/pdf"
        required
      />
      <Input
        id="store-customer-reference"
        name="customerReference"
        label={t.reference}
        maxLength={120}
      />
      <Button disabled={busy}>{busy ? t.busy : t.upload}</Button>
    </form>
  );
}
export function DiscardProof({
  order,
  proofId,
  locale,
}: {
  order: StoreOrder;
  proofId: string;
  locale: Locale;
}) {
  const command = useStoreCommand(locale);
  return (
    <div>
      {command.status}
      <Button
        variant="secondary"
        disabled={command.busy}
        onClick={() =>
          command.run({
            action: 'discard_proof',
            target: order.id,
            revision: order.revision,
            payload: { proofId },
          })
        }
      >
        {locale === 'ar'
          ? 'إلغاء الرفع غير المكتمل والبدء مجددًا'
          : 'Abandon incomplete upload and start again'}
      </Button>
    </div>
  );
}
export function OrderActions({
  order,
  locale,
  staff,
}: {
  order: StoreOrder;
  locale: Locale;
  staff: boolean;
}) {
  const t = storeText[locale],
    command = useStoreCommand(locale),
    [action, setAction] = useState('');
  const allowed: StoreCommand['action'][] = [];
  if (!staff) {
    if (
      ['AWAITING_RELEASE', 'EXCEPTION'].includes(order.fulfillmentState) &&
      !['CANCELLED', 'RETURNED'].includes(order.orderState)
    )
      allowed.push('request_cancel');
    if (order.fulfillmentState === 'DELIVERED') allowed.push('request_return');
  } else {
    if (order.permissions.orders) {
      if (order.orderState === 'PLACED') allowed.push('accept');
      if (['AWAITING_RELEASE', 'EXCEPTION'].includes(order.fulfillmentState))
        allowed.push('cancel');
      if (order.fulfillmentState === 'DELIVERED') allowed.push('return');
    }
    if (order.permissions.fulfillment && order.orderState === 'ACCEPTED') {
      const next = {
        AWAITING_RELEASE: 'send',
        SENT_TO_SUPPLIER: 'prepare',
        PREPARING: 'dispatch',
        OUT_FOR_DELIVERY: 'deliver',
        EXCEPTION: 'recover',
      } as const;
      const candidate = next[order.fulfillmentState as keyof typeof next];
      if (
        candidate &&
        (candidate !== 'send' ||
          order.payment.method === 'CASH' ||
          order.payment.status === 'VERIFIED')
      )
        allowed.push(candidate);
      if (
        ['AWAITING_RELEASE', 'SENT_TO_SUPPLIER', 'PREPARING', 'OUT_FOR_DELIVERY'].includes(
          order.fulfillmentState,
        )
      )
        allowed.push('exception');
      if (
        order.payment.method === 'CASH' &&
        order.fulfillmentState === 'DELIVERED' &&
        order.payment.status === 'CASH_DUE'
      )
        allowed.push('report_cash');
    }
    if (order.permissions.verify) {
      if (order.payment.status === 'UNDER_REVIEW') allowed.push('confirm_transfer', 'reject_proof');
      if (order.payment.status === 'CASH_DUE' && order.fulfillmentState === 'DELIVERED')
        allowed.push('confirm_cash');
    }
    if (order.permissions.settle && ['VERIFIED', 'REFUNDED'].includes(order.payment.status))
      allowed.push('money_request', 'money_unknown', 'money_verify', 'money_failed');
  }
  if (!allowed.length) return null;
  const selected = allowed.includes(action as StoreCommand['action']) ? action : '',
    money = selected.startsWith('money_');
  return (
    <form
      className="store-form"
      onSubmit={async (e) => {
        e.preventDefault();
        if (!selected) return;
        const d = new FormData(e.currentTarget);
        const payload: StoreCommand['payload'] = {};
        for (const name of [
          'reason',
          'evidenceReference',
          'reference',
          'operationId',
          'kind',
          'reversesId',
        ])
          if (d.get(name)) payload[name] = String(d.get(name));
        if (d.get('amountMinor')) payload.amountMinor = Number(d.get('amountMinor'));
        await command.run({
          action: selected as StoreCommand['action'],
          target: order.id,
          revision: order.revision,
          payload,
        });
      }}
    >
      {command.status}
      <Select
        id="store-action"
        label={t.action}
        value={selected}
        onChange={(e) => setAction(e.target.value)}
        required
      >
        <option value="">{t.selection}</option>
        {allowed.map((a) => (
          <option key={a} value={a}>
            {storeLabel(a, locale)}
          </option>
        ))}
      </Select>
      {[
        'request_cancel',
        'request_return',
        'cancel',
        'return',
        'exception',
        'recover',
        'report_cash',
      ].includes(selected) && (
        <Input id="store-reason" name="reason" label={t.reason} maxLength={500} required />
      )}
      {(selected.includes('confirm') ||
        selected === 'reject_proof' ||
        selected === 'report_cash' ||
        (money && selected !== 'money_request')) && (
        <Input
          id="store-evidence"
          name="evidenceReference"
          label={t.evidence}
          maxLength={200}
          required
        />
      )}
      {selected === 'confirm_transfer' && (
        <Input
          id="store-verified-reference"
          name="reference"
          label={t.reference}
          minLength={6}
          maxLength={120}
          required
        />
      )}
      {selected === 'report_cash' && (
        <Input
          id="store-cash-amount"
          name="amountMinor"
          label={t.amount}
          type="number"
          min={1}
          max={order.totalMinor}
          defaultValue={order.totalMinor}
          required
        />
      )}
      {selected === 'money_request' && (
        <>
          <Select id="store-money-kind" name="kind" label={t.action}>
            <option value="SETTLEMENT">{storeLabel('SETTLEMENT', locale)}</option>
            <option value="REFUND">{storeLabel('REFUND', locale)}</option>
            <option value="REVERSAL">{storeLabel('REVERSAL', locale)}</option>
          </Select>
          <Input
            id="store-money-amount"
            name="amountMinor"
            label={t.amount}
            type="number"
            min={1}
            max={order.totalMinor}
            required
          />
          <Input
            id="store-money-reference"
            name="reference"
            label={t.reference}
            maxLength={120}
            required
          />
          <Select id="store-reversal" name="reversesId" label={storeLabel('REVERSAL', locale)}>
            <option value="">—</option>
            {order.entries
              .filter((x) => ['SETTLEMENT', 'REFUND'].includes(x.kind))
              .map((x) => (
                <option key={x.id} value={x.id}>
                  {storeLabel(x.kind, locale)} · {storeMoney(x.amountMinor, locale)}
                </option>
              ))}
          </Select>
        </>
      )}
      {money && selected !== 'money_request' && (
        <Select id="store-operation" name="operationId" label={t.operations} required>
          <option value="">{t.selection}</option>
          {order.moneyOperations
            .filter((o) => ['PENDING', 'UNKNOWN'].includes(o.state))
            .map((o) => (
              <option key={o.id} value={o.id}>
                {o.reference} · {storeLabel(o.state, locale)} · {storeMoney(o.amountMinor, locale)}
              </option>
            ))}
        </Select>
      )}
      {(selected.includes('confirm') || selected === 'money_verify') && (
        <label className="store-check">
          <input type="checkbox" required /> {t.verified} · {storeMoney(order.totalMinor, locale)}
        </label>
      )}
      <Button disabled={command.busy || !selected}>{t.submit}</Button>
    </form>
  );
}
