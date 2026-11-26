'use client';
import { useSyncExternalStore } from 'react';
import { z } from 'zod';
import type { CatalogProduct } from '@/components/lovable/adapter';

const key = 'naql365:eg:basket:v1';
const event = 'naql365:basket-updated';
const basketLine = z.object({
  id: z.uuid(),
  slug: z.string().min(1).max(100),
  name: z.object({ ar: z.string(), en: z.string() }),
  unitMinor: z.number().int().nonnegative().nullable(),
  sku: z.string().optional(),
  revision: z.number().int().positive().optional(),
  quantity: z.number().int().min(1).max(99),
});
const basket = z.object({
  lines: basketLine.array().max(30),
  requestId: z.uuid().nullable(),
  pending: z.boolean(),
});
const empty: z.infer<typeof basket> = { lines: [], requestId: null, pending: false };
function readRaw() {
  try {
    return localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}
function parse(raw: string) {
  try {
    return basket.parse(JSON.parse(raw));
  } catch {
    return empty;
  }
}
function write(value: z.infer<typeof basket>) {
  localStorage.setItem(key, JSON.stringify(basket.parse(value)));
  window.dispatchEvent(new Event(event));
}
function subscribe(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(event, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(event, cb);
  };
}
export function useGuestBasket() {
  return parse(useSyncExternalStore(subscribe, readRaw, () => ''));
}
export function addToBasket(product: CatalogProduct, quantity = 1) {
  const current = parse(readRaw());
  if (current.pending) throw new Error('pending order');
  const old = current.lines.find((line) => line.id === product.id);
  const next = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    unitMinor: product.retail,
    ...(product.sku ? { sku: product.sku, revision: product.revision } : {}),
    quantity: Math.min(99, (old?.quantity ?? 0) + quantity),
  };
  write({
    requestId: crypto.randomUUID(),
    pending: false,
    lines: old
      ? current.lines.map((line) => (line.id === next.id ? next : line))
      : [...current.lines, next],
  });
}
export function setBasketQuantity(id: string, quantity: number) {
  const current = parse(readRaw());
  if (current.pending) throw new Error('pending order');
  write({
    requestId: crypto.randomUUID(),
    pending: false,
    lines: current.lines
      .map((line) => (line.id === id ? { ...line, quantity } : line))
      .filter((line) => line.quantity > 0),
  });
}
// Persist the id before sending: a timeout or refresh can retry the same order.
export function beginGuestOrder() {
  const current = parse(readRaw());
  if (!current.lines.length) throw new Error('empty basket');
  const requestId = current.requestId ?? crypto.randomUUID();
  write({ ...current, requestId, pending: true });
  return { requestId, lines: current.lines };
}
export function finishGuestOrder(requestId: string) {
  if (parse(readRaw()).requestId === requestId) write(empty);
}

export function releaseGuestOrder(requestId: string) {
  const current = parse(readRaw());
  if (current.requestId === requestId) write({ ...current, pending: false });
}
