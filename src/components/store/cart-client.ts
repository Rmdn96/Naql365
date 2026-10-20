'use client';
import { storeCart, type StoreCart, type StoreCommand } from '@/domain/store/model';

export const activeCartItems = (cart: StoreCart) => (cart.checkedOutOrderId ? [] : cart.items);

export const cartChanged = 'naql365:cart-changed';
export class CartAccessError extends Error {
  constructor(public status: number) {
    super('Cart operation unconfirmed');
  }
}
export async function readCart(signal?: AbortSignal): Promise<StoreCart> {
  const response = await fetch('/api/store?kind=cart', {
    cache: 'no-store',
    ...(signal ? { signal } : {}),
  });
  if (!response.ok) throw new CartAccessError(response.status);
  return storeCart.parse(await response.json());
}
// Serialize this tab's edits. The database still arbitrates other tabs/devices.
let tail: Promise<unknown> = Promise.resolve();
export function createCartWriter() {
  let pending: StoreCommand | undefined;
  return (change: (cart: StoreCart) => StoreCommand['payload']) => {
    const next = tail
      .catch(() => undefined)
      .then(async () => {
        if (!pending) {
          const cart = await readCart();
          pending = {
            action: 'cart',
            mutationId: crypto.randomUUID(),
            revision: cart.revision,
            payload: change(cart),
          };
        }
        // Retain the exact intent/identity on network or unknown outcomes. A retry
        // must replay the first command, never increment again after a lost reply.
        const response = await fetch('/api/store', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pending),
        });
        if (!response.ok) {
          if (response.status >= 400 && response.status < 500) pending = undefined;
          throw new CartAccessError(response.status);
        }
        const cart = await readCart();
        pending = undefined;
        window.dispatchEvent(new Event(cartChanged));
        return cart;
      });
    tail = next;
    return next;
  };
}
