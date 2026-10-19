import { expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
vi.mock('@/infrastructure/identity/staff-market', () => ({ staffMarket: vi.fn() }));
vi.mock('@/infrastructure/supabase/server', () => ({ createSupabaseServerClient: vi.fn() }));
import { normalizeProductImage, productImageForm } from '@/infrastructure/store/media';
it('normalizes raster uploads, strips metadata, bounds dimensions and rejects MIME spoofing', async () => {
  const png = await sharp({ create: { width: 1700, height: 100, channels: 3, background: '#ddd' } })
    .png()
    .toBuffer();
  const normalized = await normalizeProductImage(png, 'image/png'),
    m = await sharp(normalized).metadata();
  expect(m.format).toBe('webp');
  expect(m.width).toBe(1600);
  expect(m.exif).toBeUndefined();
  await expect(normalizeProductImage(png, 'image/webp')).rejects.toThrow();
  await expect(
    normalizeProductImage(
      new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      'image/svg+xml',
    ),
  ).rejects.toThrow();
  await expect(normalizeProductImage(new Uint8Array(4194305), 'image/png')).rejects.toThrow();
});
it('keeps all 30 supplier-reference drafts private with no entitlement or retail defaults', () => {
  const intake = JSON.parse(
    readFileSync('docs/store/catalog-intake/initial-products.eg.json', 'utf8'),
  );
  expect(intake.products).toHaveLength(30);
  expect(intake.categories).toHaveLength(5);
  expect(new Set(intake.products.map((p: { proposedSku: string }) => p.proposedSku)).size).toBe(30);
  for (const p of intake.products) {
    expect(p.agreedSupplierEntitlementMinor).toBeNull();
    expect(p.customerRetailMinor).toBeNull();
  }
  expect(intake.products[0].supplierReferenceSellingMinor).toBe(5000);
  expect(intake.products[25].supplierReferenceSellingMinor).toBeNull();
});
it('records only transferred photographs with verifiable original bytes and no used-box mismatch', () => {
  const manifest = JSON.parse(
    readFileSync('docs/store/catalog-intake/image-import-manifest.json', 'utf8'),
  );
  expect(manifest.transferredCount).toBe(5);
  for (const image of manifest.photos) {
    expect(
      createHash('sha256')
        .update(readFileSync('docs/store/catalog-intake/' + image.localReviewFile))
        .digest('hex'),
    ).toBe(image.sha256);
  }
  const used = manifest.photos.find((x: { sourceName: string }) => x.sourceName === '3-161711.jpg');
  expect(used).toBeDefined();
  expect(used.candidates).not.toContain(3);
});

it('bounds multipart bodies even without a declared length and preserves valid image forms', async () => {
  const form = new FormData();
  form.set('file', new File([new Uint8Array([1, 2, 3])], 'test.png', { type: 'image/png' }));
  const parsed = await productImageForm(
    new Request('http://localhost/api/store/media', { method: 'POST', body: form }),
  );
  expect(parsed.get('file')).toBeInstanceOf(File);
  await expect(
    productImageForm(
      new Request('http://localhost/api/store/media', {
        method: 'POST',
        headers: { 'Content-Type': 'multipart/form-data; boundary=x' },
        body: new Uint8Array(4194304 + 65537),
      }),
    ),
  ).rejects.toThrow('too large');
  await expect(
    productImageForm(
      new Request('http://localhost/api/store/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      }),
    ),
  ).rejects.toThrow();
});
