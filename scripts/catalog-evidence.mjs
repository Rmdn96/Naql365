// Only validated structured records enter CI artifacts, never raw server output.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { diagnosticRecord } from '../src/infrastructure/store/catalog-diagnostic-schema.ts';

export function createCatalogEvidence(output) {
  const file = resolve(output, 'ssr-server.ndjson');
  const artifact = resolve(output, 'ssr-boundary.json');
  writeFileSync(file, '', { mode: 0o600, flag: 'wx' });
  const stdout = [];
  function snapshot() {
    const records = [];
    let rejected = 0;
    // Preserve an incomplete trailing line for the next read, without treating it as data.
    const lines = readFileSync(file, 'utf8').slice(0, 65536).split('\n').slice(0, -1);
    for (const line of lines.slice(0, 256)) {
      try {
        const event = diagnosticRecord.safeParse(JSON.parse(line));
        if (event.success) records.push(event.data);
        else rejected++;
      } catch {
        rejected++;
      }
    }
    const evidence = { version: 1, fileRecords: records, stdoutRecords: stdout, rejected };
    writeFileSync(artifact, JSON.stringify(evidence, null, 2), { mode: 0o600 });
    return evidence;
  }
  snapshot(); // Exists even if build/start/fixture setup fails before any server event.
  return {
    file,
    snapshot,
    receive(event) {
      const safe = diagnosticRecord.safeParse(event);
      if (safe.success && stdout.length < 256) stdout.push(safe.data);
      snapshot();
    },
  };
}
