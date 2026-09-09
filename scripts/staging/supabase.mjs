import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const cli = fileURLToPath(new URL('../../node_modules/supabase/dist/supabase.js', import.meta.url));

export function supabase(args) {
  try {
    return execFileSync(process.execPath, [cli, ...args, '--agent', 'no'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 16 * 1024 * 1024,
    });
  } catch {
    throw new Error(
      `Supabase command failed: ${args[0]} ${args[1] ?? ''}; sensitive output suppressed`,
    );
  }
}

export function stagingProject() {
  const ref = process.env.STAGING_SUPABASE_PROJECT_REF;
  const org = process.env.STAGING_SUPABASE_ORG_ID;
  if (!ref || !/^[a-z]{20}$/.test(ref) || !org)
    throw new Error('Explicit staging project and organization are required');
  const projects = JSON.parse(supabase(['projects', 'list', '--output', 'json']));
  const project = projects.find((item) => item.id === ref && item.organization_id === org);
  if (project?.name !== 'naql365-staging' || project.status !== 'ACTIVE_HEALTHY') {
    throw new Error('Refusing a project outside the healthy naql365-staging allowlist');
  }
  return ref;
}

export function query(ref, sql) {
  return JSON.parse(
    supabase(['db', 'query', '--linked', '--project-ref', ref, '--output', 'json', sql]),
  );
}
