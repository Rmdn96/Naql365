import { families, locales } from './staff-visual-matrix.mjs';
import { readFileSync, existsSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join } from 'node:path';

// Reuse accepted state definitions, never their screenshots or deployed identity.
// Every implemented state is checked in both locales at narrow/mobile and desktop.
// Representative route/role surfaces additionally cover every intermediate width
// and Dark/System, including both OS preferences for System.
export { families, locales };
export const core = new Set([
  ...families.filter((f) => f.id.startsWith('shell-')).map((f) => f.id),
  'sales-queue',
  'sales-draft',
  'sales-history',
  'sales-validation',
  'operations-queue',
  'operations-job',
  'operations-planned',
  'operations-reassignment-dialog',
  'operations-completed',
  'finance-queue',
  'finance-review',
  'finance-rejected',
  'finance-confirmed',
  'banks-populated',
  'support-populated',
  'loading-dashboard',
  'empty-sales',
]);
export function presentations(family) {
  return [
    ...[360, 1440].map((width) => ({ width, theme: 'light', system: 'light' })),
    ...(core.has(family.id)
      ? [
          ...[390, 768, 1280].map((width) => ({ width, theme: 'light', system: 'light' })),
          ...['dark', 'system'].flatMap((theme) =>
            [360, 1440].map((width) => ({
              width,
              theme,
              system: width === 360 ? 'dark' : 'light',
            })),
          ),
        ]
      : []),
  ];
}
export const matrixId = (family, locale, view) =>
  `${family.id}-${locale}-${view.width}-${view.theme}-${view.system}`;
export const requiredMatrix = () =>
  families.flatMap((family) =>
    locales.flatMap((locale) =>
      presentations(family).map((view) => ({
        id: matrixId(family, locale, view),
        family: family.id,
        role: family.role,
        route: family.route,
        state: family.state,
        locale,
        ...view,
      })),
    ),
  );

export function matrixStore(
  applicationSha,
  directory = 'docs/reports/evidence/lovable-wave4-staff-final',
) {
  if (!/^[a-f0-9]{40}$/.test(applicationSha)) throw Error('EXACT_APPLICATION_SHA_REQUIRED');
  mkdirSync(directory, { recursive: true });
  const path = join(directory, 'index.json'),
    required = requiredMatrix();
  const index = existsSync(path)
    ? JSON.parse(readFileSync(path, 'utf8'))
    : {
        applicationSha,
        rows: [],
        failures: [],
        strategy:
          'All 67 accepted states at 360/1440 in both locales; representative routes/roles at all five widths and Dark/System, with both OS preferences.',
      };
  if (index.applicationSha !== applicationSha) throw Error('MATRIX_APPLICATION_IDENTITY_MISMATCH');
  const allowed = new Map(required.map((r) => [r.id, r]));
  for (const row of index.rows) {
    if (
      !allowed.has(row.id) ||
      Object.entries(allowed.get(row.id) ?? {}).some(([key, value]) => row[key] !== value) ||
      row.applicationSha !== applicationSha ||
      row.result !== 'PASS' ||
      !existsSync(join(directory, basename(row.filename))) ||
      createHash('sha256')
        .update(readFileSync(join(directory, basename(row.filename))))
        .digest('hex') !== row.sha256
    )
      throw Error('EXISTING_MATRIX_EVIDENCE_INVALID');
  }
  if (new Set(index.rows.map((r) => r.id)).size !== index.rows.length)
    throw Error('DUPLICATE_MATRIX_ID');
  const save = () => {
    const present = new Set(index.rows.filter((r) => r.result === 'PASS').map((r) => r.id));
    index.required = required;
    index.total = required.length;
    index.pass = present.size;
    index.missing = required.filter((r) => !present.has(r.id)).map((r) => r.id);
    writeFileSync(path + '.tmp', JSON.stringify(index, null, 2) + '\n');
    renameSync(path + '.tmp', path);
  };
  save();
  return {
    directory,
    index,
    required,
    save,
    has: (id) => index.rows.some((r) => r.id === id && r.result === 'PASS'),
    add(row) {
      if (this.has(row.id)) throw Error('ACCEPTED_EVIDENCE_OVERWRITE_DENIED');
      const expected = allowed.get(row.id);
      if (
        !expected ||
        Object.entries(expected).some(([key, value]) => row[key] !== value) ||
        row.applicationSha !== applicationSha ||
        row.result !== 'PASS' ||
        createHash('sha256')
          .update(readFileSync(join(directory, basename(row.filename))))
          .digest('hex') !== row.sha256
      )
        throw Error('NEW_MATRIX_EVIDENCE_INVALID');
      index.rows.push(row);
      save();
    },
    complete(batch) {
      if (
        index.missing.some(
          (id) => families.find((f) => f.id === allowed.get(id)?.family)?.batch === batch,
        )
      )
        throw Error('BATCH_MATRIX_INCOMPLETE');
      return true;
    },
  };
}
