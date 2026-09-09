import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
const generated = execFileSync(
  process.execPath,
  [cli, 'gen', 'types', 'typescript', '--local', '--schema', 'public'],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'] },
);
writeFileSync('src/infrastructure/supabase/database.types.ts', generated);
