import { afterEach, expect, it, vi } from 'vitest';
import { appendFileSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { relative, resolve } from 'node:path';
import { createCatalogEvidence } from '../../scripts/catalog-evidence.mjs';
const directories: string[] = [];
function directory() {
  const output = resolve('test-results', 'store-local-' + Date.now());
  mkdirSync(output, { recursive: true });
  directories.push(output);
  return output;
}
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  for (const output of directories.splice(0)) {
    if (!/^store-local-[0-9]+$/.test(relative(resolve('test-results'), resolve(output))))
      throw Error('TEST_CLEANUP_PATH_INVALID');
    rmSync(output, { recursive: true });
  }
});
const record = {
  version: 1,
  phase: 'runtime',
  stage: 'startup',
  outcome: 'ready',
  processId: 123,
  requestId: 0,
  sequence: 1,
  build: '123456abcdef',
};
it.each(['staging', 'production'])(
  'never writes diagnostics in %s even with opt-in set',
  async (environment) => {
    const channel = createCatalogEvidence(directory());
    vi.stubEnv('APP_ENV', environment);
    vi.stubEnv('NAQL365_CATALOG_DIAGNOSTICS', '1');
    vi.stubEnv('NAQL365_CATALOG_EVIDENCE_FILE', channel.file);
    const log = vi.spyOn(console, 'info').mockImplementation(() => {});
    const { catalogTrace } = await import('@/infrastructure/store/catalog-trace');
    catalogTrace({ stage: 'startup', outcome: 'ready' });
    expect(channel.snapshot().fileRecords).toEqual([]);
    expect(log).not.toHaveBeenCalled();
  },
);
it('creates a machine-readable artifact before the server starts and retains it on early failure', () => {
  const output = directory();
  const channel = createCatalogEvidence(output);
  expect(JSON.parse(readFileSync(output + '/ssr-boundary.json', 'utf8')).fileRecords).toEqual([]);
  expect(() => {
    try {
      appendFileSync(channel.file, JSON.stringify(record) + '\n');
      throw Error('SIMULATED_DIAGNOSTIC_FAILURE');
    } finally {
      channel.snapshot();
    }
  }).toThrow('SIMULATED_DIAGNOSTIC_FAILURE');
  expect(JSON.parse(readFileSync(output + '/ssr-boundary.json', 'utf8')).fileRecords).toEqual([
    record,
  ]);
});
it('rejects private payloads, incomplete lines, arbitrary identifiers and oversized output', () => {
  const channel = createCatalogEvidence(directory());
  appendFileSync(channel.file, JSON.stringify({ ...record, token: 'synthetic-private' }) + '\n');
  appendFileSync(channel.file, JSON.stringify({ ...record, outcome: 'unbounded-private' }) + '\n');
  appendFileSync(channel.file, JSON.stringify(record)); // not yet a complete record
  channel.receive({ ...record, cookies: 'synthetic-private' });
  expect(channel.snapshot()).toMatchObject({ fileRecords: [], stdoutRecords: [], rejected: 2 });
  appendFileSync(channel.file, '\n');
  for (let i = 0; i < 300; i++) channel.receive(record);
  expect(channel.snapshot().fileRecords).toEqual([record]);
  expect(channel.snapshot().stdoutRecords).toHaveLength(256);
});
it('writes actual server diagnostics independently of console output and never throws on sink failure', async () => {
  vi.resetModules();
  const channel = createCatalogEvidence(directory());
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NAQL365_CATALOG_DIAGNOSTICS', '1');
  vi.stubEnv('NAQL365_CATALOG_PHASE', 'runtime');
  vi.stubEnv('NAQL365_CATALOG_EVIDENCE_FILE', channel.file);
  vi.spyOn(console, 'info').mockImplementation(() => {
    throw Error('SIMULATED_STDOUT_FAILURE');
  });
  const { catalogTrace } = await import('@/infrastructure/store/catalog-trace');
  expect(() => catalogTrace({ stage: 'startup', outcome: 'ready' })).not.toThrow();
  expect(channel.snapshot().fileRecords[0]).toMatchObject({
    stage: 'startup',
    phase: 'runtime',
    outcome: 'ready',
    requestId: 0,
    processId: process.pid,
  });
  vi.stubEnv('NAQL365_CATALOG_EVIDENCE_FILE', resolve('outside-evidence.ndjson'));
  expect(() => catalogTrace({ stage: 'client', outcome: 'threw' })).not.toThrow();
  expect(channel.snapshot().fileRecords).toHaveLength(1);
});
