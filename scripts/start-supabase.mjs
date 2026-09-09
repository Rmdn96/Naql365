import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// The CLI startup summary contains local API credentials. Never print it into CI logs.
const cli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
try {
  execFileSync(process.execPath, [cli, 'start'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    timeout: 600_000,
    maxBuffer: 32 * 1024 * 1024,
  });
  process.stdout.write('Local Supabase started. Credential output was withheld.\n');
} catch {
  process.stderr.write(
    'Local Supabase startup failed. Verify Docker availability and local service health.\n',
  );
  process.exit(1);
}
