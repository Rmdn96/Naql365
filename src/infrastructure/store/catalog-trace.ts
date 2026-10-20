// Local opt-in evidence only; never changes catalog results or authority.
import 'server-only';
import { cache } from 'react';
import { appendFileSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { relative, resolve } from 'node:path';
import type { z } from 'zod';
import { diagnostic, diagnosticRecord } from './catalog-diagnostic-schema';
export { catalogIssueFields } from './catalog-diagnostic-schema';
let emitted = 0;
let requests = 0;
const requestIdentity = cache(() => ++requests);
export function catalogTrace(event: z.infer<typeof diagnostic>) {
  if (
    process.env.APP_ENV !== 'local' ||
    process.env.NAQL365_CATALOG_DIAGNOSTICS !== '1' ||
    emitted >= 128
  )
    return;
  try {
    const safe = diagnostic.safeParse(event);
    if (!safe.success) return;
    let build = null;
    try {
      build = createHash('sha256')
        .update(readFileSync('.next/BUILD_ID'))
        .digest('hex')
        .slice(0, 12);
    } catch {
      /* Build may not yet exist. */
    }
    const phase = process.env.NAQL365_CATALOG_PHASE;
    const record = diagnosticRecord.parse({
      ...safe.data,
      version: 1,
      phase: phase === 'build' || phase === 'runtime' ? phase : 'unknown',
      processId: process.pid,
      requestId: event.stage === 'startup' ? 0 : requestIdentity(),
      sequence: ++emitted,
      build,
    });
    const line = JSON.stringify(record);
    // File transport is independent of Next.js stdout formatting.
    const destination = process.env.NAQL365_CATALOG_EVIDENCE_FILE;
    if (destination) {
      const path = resolve(destination);
      const local = relative(process.cwd(), path).replaceAll('\\', '/');
      if (/^test-results\/store-local-[0-9]+\/ssr-server\.ndjson$/.test(local)) {
        try {
          if (statSync(path).size < 65536)
            appendFileSync(path, line + '\n', { encoding: 'utf8', mode: 0o600 });
        } catch {
          /* Continue to the independent structured stdout channel. */
        }
      }
    }
    console.info('CATALOG_SSR ' + line);
  } catch {
    /* Evidence failure must not affect application behavior. */
  }
}
