import { randomUUID } from 'node:crypto';
import { mkdirSync, writeFileSync, appendFileSync, unlinkSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export function acquireHostedRun() {
  const directory = new URL('../../supabase/.temp/', import.meta.url);
  mkdirSync(directory, { recursive: true });
  const file = fileURLToPath(new URL('hosted-verification.lock', directory));
  try {
    writeFileSync(file, JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }), {
      flag: 'wx',
    });
  } catch {
    throw new Error(
      'Another hosted verification owns this checkout. Do not overlap database, service or browser suites; inspect the lock PID before removing a stale lock.',
    );
  }
  const ledger = fileURLToPath(new URL('acceptance-' + randomUUID() + '.jsonl', directory));
  writeFileSync(ledger, JSON.stringify({ event: 'started', pid: process.pid }) + '\n', {
    flag: 'wx',
  });
  const release = () => {
    appendFileSync(
      ledger,
      JSON.stringify({ event: 'finished', successful: !process.exitCode }) + '\n',
    );
    if (!process.exitCode) unlinkSync(ledger);
    unlinkSync(file);
  };
  release.track = (kind, id) => {
    if (!['auth', 'organization', 'request'].includes(kind) || !/^[a-f0-9-]{36}$/i.test(id))
      throw Error('Invalid fixture ledger identifier');
    appendFileSync(ledger, JSON.stringify({ kind, id }) + '\n');
  };
  return release;
}
