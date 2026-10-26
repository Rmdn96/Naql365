import { afterEach, expect, it, vi } from 'vitest';
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
} from 'node:fs';
import { relative, resolve, join, parse } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { createCatalogEvidence } from '../../scripts/catalog-evidence.mjs';
const directories: string[] = [];
const temporaryDirectories = new Set<string>();
const temporaryRoot = realpathSync(tmpdir());
function temporaryDirectory() {
  if (process.platform === 'win32') {
    const drive = parse(temporaryRoot).root;
    if (!/^[A-Za-z]:\\$/.test(drive)) throw Error('TEST_TEMP_VOLUME_INVALID');
    const volume = JSON.parse(
      execFileSync(
        'powershell.exe',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          `Get-Volume -DriveLetter '${drive[0]}' | Select-Object FileSystem,DriveType | ConvertTo-Json -Compress`,
        ],
        { encoding: 'utf8' },
      ),
    );
    if (volume.FileSystem !== 'NTFS' || volume.DriveType !== 'Fixed')
      throw Error('TEST_TEMP_VOLUME_INVALID');
  }
  const output = mkdtempSync(join(temporaryRoot, 'naql365-catalog-'));
  temporaryDirectories.add(output);
  directories.push(output);
  return output;
}
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
    const temporary = temporaryDirectories.has(output);
    const root = temporary ? temporaryRoot : resolve('test-results');
    const pattern = temporary ? /^naql365-catalog-[A-Za-z0-9]{6}$/ : /^store-local-[0-9]+$/;
    if (!pattern.test(relative(root, resolve(output))) || realpathSync(output) !== resolve(output))
      throw Error('TEST_CLEANUP_PATH_INVALID');
    rmSync(output, { recursive: true });
    temporaryDirectories.delete(output);
    expect(existsSync(output)).toBe(false);
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
  const channel = createCatalogEvidence(temporaryDirectory());
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
it('retains a real homepage-stage failure in the machine-readable collector', async () => {
  vi.resetModules();
  const output = directory();
  const channel = createCatalogEvidence(output);
  vi.stubEnv('APP_ENV', 'local');
  vi.stubEnv('NAQL365_CATALOG_DIAGNOSTICS', '1');
  vi.stubEnv('NAQL365_CATALOG_PHASE', 'runtime');
  vi.stubEnv('NAQL365_CATALOG_EVIDENCE_FILE', channel.file);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  const { homeStep } = await import('@/infrastructure/markets/home-trace');
  const error = new TypeError('synthetic-private-do-not-record');
  await expect(
    homeStep('home-catalogue', () => {
      throw error;
    }),
  ).rejects.toBe(error);
  const evidence = channel.snapshot();
  expect(evidence.rejected).toBe(0);
  expect(evidence.fileRecords).toHaveLength(2);
  expect(evidence.fileRecords[1]).toMatchObject({
    stage: 'home-catalogue',
    outcome: 'threw',
    exception: 'TypeError',
  });
  expect(readFileSync(output + '/ssr-boundary.json', 'utf8')).not.toContain(error.message);
});
