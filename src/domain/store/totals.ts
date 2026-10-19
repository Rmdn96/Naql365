// Presentation estimate only. Checkout rederives every amount from approved SQL records.
export function storeTotals(
  items: { quantity: number; amountMinor: number }[],
  contract: {
    deliveryMinor: number;
    taxBps: number;
    taxMode: 'ADDITIVE' | 'INCLUDED';
    taxDelivery: boolean;
  },
) {
  if (
    !items.every(
      (i) =>
        Number.isSafeInteger(i.quantity) &&
        i.quantity > 0 &&
        i.quantity <= 999 &&
        Number.isSafeInteger(i.amountMinor) &&
        i.amountMinor > 0,
    ) ||
    !Number.isSafeInteger(contract.deliveryMinor) ||
    contract.deliveryMinor < 0 ||
    !Number.isInteger(contract.taxBps) ||
    contract.taxBps < 0 ||
    contract.taxBps > 10000
  )
    return null;
  const subtotal = items.reduce((sum, i) => sum + BigInt(i.quantity) * BigInt(i.amountMinor), 0n);
  const delivery = BigInt(contract.deliveryMinor),
    base = subtotal + (contract.taxDelivery ? delivery : 0n);
  const denominator = BigInt(contract.taxMode === 'ADDITIVE' ? 10000 : 10000 + contract.taxBps);
  const tax = (base * BigInt(contract.taxBps) + denominator / 2n) / denominator;
  const total = subtotal + delivery + (contract.taxMode === 'ADDITIVE' ? tax : 0n);
  if (total <= 0n || [subtotal, tax, total].some((n) => n > BigInt(Number.MAX_SAFE_INTEGER)))
    return null;
  return {
    subtotal: Number(subtotal),
    delivery: Number(delivery),
    tax: Number(tax),
    total: Number(total),
  };
}
