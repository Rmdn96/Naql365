import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../node_modules/supabase/dist/supabase.js', import.meta.url));
const env = { ...process.env };
delete env.SUPABASE_DB_PASSWORD;
delete env.SUPABASE_ACCESS_TOKEN;
const generated = execFileSync(
  process.execPath,
  [
    cli,
    'gen',
    'types',
    'typescript',
    '--local',
    '--schema',
    'public',
    ...(process.env.NAQL365_LOCAL_SUPABASE_WORKDIR
      ? ['--workdir', process.env.NAQL365_LOCAL_SUPABASE_WORKDIR]
      : []),
  ],
  { encoding: 'utf8', stdio: ['ignore', 'pipe', 'inherit'], env },
);
// Preserve the CLI schema verbatim; normalize only its trailing blank lines.
writeFileSync('src/infrastructure/supabase/database.types.ts', generated.trimEnd() + '\n');
