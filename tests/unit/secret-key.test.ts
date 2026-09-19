import { expect, test } from 'vitest';
import { hasSupabaseSecretMaterial } from '../helpers/secret-key';

test('SDK bare key discriminator is not credential material', () => {
  expect(hasSupabaseSecretMaterial('key.startsWith("sb_secret_")')).toBe(false);
});

test('secret payloads remain detected, even alongside the SDK discriminator', () => {
  const synthetic = ['sb', 'secret', 'synthetic-not-a-real-key'].join('_');
  expect(hasSupabaseSecretMaterial(`key.startsWith("sb_secret_");value="${synthetic}"`)).toBe(true);
});

test('even a short secret payload is rejected without a minimum-length loophole', () => {
  expect(hasSupabaseSecretMaterial(['sb', 'secret', 'x'].join('_'))).toBe(true);
});
