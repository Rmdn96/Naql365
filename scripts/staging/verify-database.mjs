import {
  readFileSync,
  writeFileSync,
  mkdtempSync,
  unlinkSync,
  rmdirSync,
  readdirSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { stagingProject, supabase, query } from './supabase.mjs';

try {
  const ref = stagingProject();
  const migrations = readdirSync('supabase/migrations')
    .filter((name) => name.endsWith('.sql'))
    .sort();
  const history = query(
    ref,
    'select version from supabase_migrations.schema_migrations order by version',
  );
  if (
    JSON.stringify(history.map((row) => row.version)) !==
    JSON.stringify(migrations.map((name) => name.split('_')[0]))
  ) {
    throw new Error('Staging migration history differs from the repository');
  }
  const temp = mkdtempSync(join(tmpdir(), 'naql365-rls-'));
  const file = join(temp, 'assertions.sql');
  try {
    writeFileSync(
      file,
      readFileSync('supabase/tests/foundation.test.sql', 'utf8').split('-- Supabase TAP report')[0],
    );
    supabase(['db', 'query', '--linked', '--project-ref', ref, '--file', file]);
  } finally {
    unlinkSync(file);
    rmdirSync(temp);
  }
  const types = supabase(['gen', 'types', 'typescript', '--project-id', ref, '--schema', 'public']);
  if (!types.includes('export type Database')) throw new Error('Invalid generated types');
  writeFileSync('src/infrastructure/supabase/database.types.ts', types);
  const schema = query(
    ref,
    "select count(*)::integer as tables, count(*) filter (where c.relrowsecurity)::integer as rls_tables from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r'",
  );
  console.log(
    JSON.stringify(
      {
        project: ref,
        migrations: migrations.map((name) => ({
          name,
          sha256: createHash('sha256')
            .update(readFileSync(`supabase/migrations/${name}`))
            .digest('hex'),
        })),
        schema,
        assertions: 'PASS',
        generated_types: 'written; run typecheck',
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
