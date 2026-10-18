import { expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
// Test-only evidence code, no application dependency.
import {
  families,
  requiredMatrix,
  matrixStore,
} from '../../scripts/staging/wave4-staff-matrix.mjs';

it('covers every accepted state in both directions and all responsive/theme modes for representative roles', () => {
  const rows = requiredMatrix();
  expect(rows).toHaveLength(590);
  expect(new Set(rows.map((r: { id: string }) => r.id)).size).toBe(rows.length);
  for (const family of families)
    for (const locale of ['ar', 'en'])
      for (const width of [360, 1440])
        expect(
          rows.some(
            (r: { family: string; locale: string; width: number; theme: string }) =>
              r.family === family.id &&
              r.locale === locale &&
              r.width === width &&
              r.theme === 'light',
          ),
        ).toBe(true);
  for (const role of [
    'SUPER_ADMIN',
    'SALES',
    'OPERATIONS',
    'DISPATCHER',
    'FINANCE',
    'CUSTOMER_SERVICE',
  ]) {
    const shell = rows.filter(
      (r: { family: string }) => r.family === 'shell-' + role.toLowerCase(),
    );
    expect(new Set(shell.map((r: { width: number }) => r.width))).toEqual(
      new Set([360, 390, 768, 1280, 1440]),
    );
    expect(new Set(shell.map((r: { theme: string }) => r.theme))).toEqual(
      new Set(['light', 'dark', 'system']),
    );
    expect(
      new Set(
        shell
          .filter((r: { theme: string }) => r.theme === 'system')
          .map((r: { system: string }) => r.system),
      ),
    ).toEqual(new Set(['light', 'dark']));
  }
});
it('rejects missing, corrupt, duplicate or wrong-identity evidence and resumes verified captures', () => {
  const dir = mkdtempSync(join(tmpdir(), 'naql-wave4-'));
  const sha = 'a'.repeat(40);
  try {
    const store = matrixStore(sha, dir),
      expected = store.required[0]!;
    expect(() => store.complete('empty')).toThrow('BATCH_MATRIX_INCOMPLETE');
    const file = 'capture.png',
      bytes = Buffer.from('synthetic test capture');
    writeFileSync(join(dir, file), bytes);
    const row = {
      ...expected,
      applicationSha: sha,
      result: 'PASS',
      filename: file,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    store.add(row);
    expect(() => store.add(row)).toThrow('ACCEPTED_EVIDENCE_OVERWRITE_DENIED');
    expect(matrixStore(sha, dir).has(expected.id)).toBe(true);
    const saved = readFileSync(join(dir, 'index.json'), 'utf8');
    const tampered = JSON.parse(saved);
    tampered.rows[0].role = 'FORGED';
    writeFileSync(join(dir, 'index.json'), JSON.stringify(tampered));
    expect(() => matrixStore(sha, dir)).toThrow('EXISTING_MATRIX_EVIDENCE_INVALID');
    writeFileSync(join(dir, 'index.json'), saved);
    expect(() => matrixStore('b'.repeat(40), dir)).toThrow('MATRIX_APPLICATION_IDENTITY_MISMATCH');
    writeFileSync(join(dir, file), 'corrupt');
    expect(() => matrixStore(sha, dir)).toThrow('EXISTING_MATRIX_EVIDENCE_INVALID');
  } finally {
    rmSync(dir, { recursive: true });
  }
});
