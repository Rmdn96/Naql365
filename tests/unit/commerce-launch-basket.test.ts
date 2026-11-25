import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  addToBasket,
  beginGuestOrder,
  finishGuestOrder,
  setBasketQuantity,
} from '@/components/store/guest-basket';
import type { CatalogProduct } from '@/components/lovable/adapter';
const product: CatalogProduct = {
  id: '91000000-0000-4000-8000-000000000001',
  revision: 1,
  category: 'paper',
  slug: 'box',
  name: { ar: 'صندوق', en: 'Box' },
  spec: { ar: '', en: '' },
  image: '',
  media: [],
  specifications: [],
  retail: 1150,
};
describe('device basket', () => {
  beforeEach(() => {
    const data = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v),
    });
    vi.stubGlobal('window', new EventTarget());
  });
  afterEach(() => vi.unstubAllGlobals());
  it('uses integer minor units and persists a single submission identity through a lost response', () => {
    addToBasket(product, 2);
    setBasketQuantity(product.id, 3);
    const first = beginGuestOrder();
    expect(first.lines[0]).toMatchObject({ id: product.id, quantity: 3, unitMinor: 1150 });
    expect(beginGuestOrder()).toEqual(first);
    finishGuestOrder('a different request');
    expect(beginGuestOrder()).toEqual(first);
    finishGuestOrder(first.requestId);
    expect(() => beginGuestOrder()).toThrow();
  });
  it('retains cart contents after rejecting a malformed quantity', () => {
    addToBasket(product);
    expect(() => setBasketQuantity(product.id, 1.5)).toThrow();
    expect(beginGuestOrder().lines[0]?.quantity).toBe(1);
  });
});
