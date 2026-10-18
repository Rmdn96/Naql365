import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import {
  matrixStore,
  applicationSha,
  families,
  locales,
  widths,
} from '../../scripts/staging/staff-visual-matrix.mjs';
const directories: string[] = [];
afterEach(() => {
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});
const directory = () => {
  const d = mkdtempSync(join(tmpdir(), 'naql365-evidence-'));
  directories.push(d);
  return d;
};
describe('staff visual evidence integrity', () => {
  it('defines unique exact locale/viewport combinations and rejects incomplete batches', () => {
    const store = matrixStore(directory());
    expect(store.required).toHaveLength(families.length * locales.length * widths.length);
    expect(new Set(store.required.map((r: { id: string }) => r.id)).size).toBe(
      store.required.length,
    );
    expect(() => store.complete('sales-support')).toThrow('BATCH_MATRIX_INCOMPLETE');
  });
  it('resumes accepted hashes and rejects overwrite and corrupted files', () => {
    const dir = directory(),
      store = matrixStore(dir),
      filename = 'ar-360.png',
      bytes = Buffer.from('synthetic evidence');
    writeFileSync(join(dir, filename), bytes);
    const row = {
      id: store.required[0]!.id,
      result: 'PASS',
      applicationSha,
      filename,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    };
    store.add(row);
    expect(matrixStore(dir).has(row.id)).toBe(true);
    expect(() => store.add(row)).toThrow('ACCEPTED_EVIDENCE_OVERWRITE_DENIED');
    expect(JSON.parse(readFileSync(join(dir, 'index.json'), 'utf8')).missing).not.toContain(row.id);
    writeFileSync(join(dir, filename), 'corrupt');
    expect(() => matrixStore(dir)).toThrow('EXISTING_MATRIX_EVIDENCE_INVALID');
  });
});
