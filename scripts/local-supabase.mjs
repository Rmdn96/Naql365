// Test infrastructure only. Never reads a linked/cloud project or accepts a URL.
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
export function localSupabase() {
  const workdir = process.env.NAQL365_LOCAL_SUPABASE_WORKDIR;
  const root = workdir ? resolve(workdir) : process.cwd();
  const config = readFileSync(resolve(root, 'supabase/config.toml'), 'utf8');
  if (!/^project_id\s*=\s*"naql365"\s*$/m.test(config)) throw Error('LOCAL_PROJECT_REQUIRED');
  const apiBlock = config.match(/^\[api\]\s*\r?\n([\s\S]*?)(?=^\[)/m)?.[1];
  const apiPort = apiBlock?.match(/^port\s*=\s*(\d+)\s*$/m)?.[1];
  if (!['54321', '55321'].includes(apiPort)) throw Error('LOCAL_PORT_REQUIRED');
  const env = { ...process.env };
  // An inherited operator/cloud DB password must never affect local tooling.
  delete env.SUPABASE_DB_PASSWORD;
  delete env.SUPABASE_ACCESS_TOKEN;
  const local = JSON.parse(
    execFileSync(
      process.execPath,
      [
        'node_modules/supabase/dist/supabase.js',
        'status',
        '--output',
        'json',
        ...(workdir ? ['--workdir', root] : []),
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], env, timeout: 30000 },
    ),
  );
  const endpoint = new URL(local.API_URL);
  if (
    endpoint.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(endpoint.hostname) ||
    endpoint.port !== apiPort ||
    endpoint.username ||
    endpoint.password ||
    endpoint.pathname !== '/' ||
    endpoint.search ||
    endpoint.hash
  )
    throw Error('LOCAL_ONLY');
  return { ...local, apiPort };
}
