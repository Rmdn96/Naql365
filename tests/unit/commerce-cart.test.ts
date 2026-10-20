import { afterEach, expect, it, vi } from 'vitest';
import {
  CartAccessError,
  createCartWriter,
  readCart,
  cartChanged,
} from '@/components/store/cart-client';
const listingId = '98000000-0000-4000-8000-000000000003';
const empty = { revision: 0, checkedOutOrderId: null, items: [], contracts: [], destinations: [] };
const item = {
  listingId,
  savedRevision: 1,
  revision: 1,
  quantity: 1,
  amountMinor: 1000,
  content: { title_ar: 'اختبار', title_en: 'Synthetic' },
  available: true,
  slug: 'synthetic',
};
const reply = (data: unknown, status = 200) => Response.json(data, { status });
afterEach(() => vi.unstubAllGlobals());
it.each([401, 403, 409])(
  'denies unavailable/unauthorized cart reads (%s) without a mutation',
  async (status) => {
    const fetcher = vi.fn().mockResolvedValue(reply({ error: 'denied' }, status));
    vi.stubGlobal('fetch', fetcher);
    await expect(createCartWriter()(() => ({ items: [] }))).rejects.toMatchObject({ status });
    expect(fetcher).toHaveBeenCalledTimes(1);
  },
);
it('does not accept an invalid server cart or expose a client price as checkout authority', async () => {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue(reply({ revision: 0, items: [{ supplierCost: 40 }] })),
  );
  await expect(readCart()).rejects.toThrow();
});
it('retains the exact mutation after an unknown response and replays it once', async () => {
  const events = new EventTarget(),
    notified = vi.fn();
  events.addEventListener(cartChanged, notified);
  vi.stubGlobal('window', events);
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(reply(empty))
    .mockRejectedValueOnce(Error('lost response'))
    .mockResolvedValueOnce(reply({ revision: 1 }))
    .mockResolvedValueOnce(reply({ ...empty, revision: 1, items: [item] }));
  vi.stubGlobal('fetch', fetcher);
  const writer = createCartWriter(),
    change = vi.fn(() => ({ items: [{ listingId, revision: 1, quantity: 1 }] }));
  await expect(writer(change)).rejects.toThrow('lost response');
  expect(notified).not.toHaveBeenCalled();
  const result = await writer(change);
  expect(result.items[0]?.quantity).toBe(1);
  expect(change).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[1]?.[1]?.body).toBe(fetcher.mock.calls[2]?.[1]?.body);
  expect(notified).toHaveBeenCalledTimes(1);
  const intent = JSON.parse(fetcher.mock.calls[2]?.[1]?.body);
  expect(intent.payload).toEqual({ items: [{ listingId, revision: 1, quantity: 1 }] });
  expect(intent).not.toHaveProperty('customerId');
  expect(intent).not.toHaveProperty('amountMinor');
});
it('replays the command if the confirming cart GET fails after a successful POST', async () => {
  vi.stubGlobal('window', new EventTarget());
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(reply(empty))
    .mockResolvedValueOnce(reply({ revision: 1 }))
    .mockRejectedValueOnce(Error('read unavailable'))
    .mockResolvedValueOnce(reply({ revision: 1 }))
    .mockResolvedValueOnce(reply({ ...empty, revision: 1, items: [item] }));
  vi.stubGlobal('fetch', fetcher);
  const writer = createCartWriter(),
    change = vi.fn(() => ({ items: [] }));
  await expect(writer(change)).rejects.toThrow('read unavailable');
  await writer(change);
  expect(fetcher.mock.calls[1]?.[1]?.body).toBe(fetcher.mock.calls[3]?.[1]?.body);
  expect(change).toHaveBeenCalledTimes(1);
});
it('serializes independent product controls against the latest server revision', async () => {
  vi.stubGlobal('window', new EventTarget());
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(reply(empty))
    .mockResolvedValueOnce(reply({ revision: 1 }))
    .mockResolvedValueOnce(reply({ ...empty, revision: 1, items: [item] }))
    .mockResolvedValueOnce(reply({ ...empty, revision: 1, items: [item] }))
    .mockResolvedValueOnce(reply({ revision: 2 }))
    .mockResolvedValueOnce(reply({ ...empty, revision: 2, items: [{ ...item, quantity: 2 }] }));
  vi.stubGlobal('fetch', fetcher);
  const change = (cart: Awaited<ReturnType<typeof readCart>>) => ({
    items: [{ listingId, revision: 1, quantity: (cart.items[0]?.quantity ?? 0) + 1 }],
  });
  await Promise.all([createCartWriter()(change), createCartWriter()(change)]);
  const posts = fetcher.mock.calls
    .filter(([, init]) => init?.method === 'POST')
    .map(([, init]) => JSON.parse(init.body));
  expect(posts.map((x) => x.revision)).toEqual([0, 1]);
  expect(posts.map((x) => x.payload.items[0].quantity)).toEqual([1, 2]);
});
it('reports stale server conflicts without automatic retry or optimistic success', async () => {
  const target = new EventTarget(),
    notify = vi.fn();
  target.addEventListener(cartChanged, notify);
  vi.stubGlobal('window', target);
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(reply(empty))
    .mockResolvedValueOnce(reply({ error: 'conflict' }, 409));
  vi.stubGlobal('fetch', fetcher);
  await expect(createCartWriter()(() => ({ items: [] }))).rejects.toBeInstanceOf(CartAccessError);
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(notify).not.toHaveBeenCalled();
});
