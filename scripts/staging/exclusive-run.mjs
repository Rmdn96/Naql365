import { mkdirSync, writeFileSync, unlinkSync } from 'node:fs';
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
  return () => unlinkSync(file);
}
