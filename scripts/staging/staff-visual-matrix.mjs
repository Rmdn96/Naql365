import { readFileSync, existsSync, writeFileSync, renameSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { basename, join } from 'node:path';
export const applicationSha = '8062e3ec5884827b507e8e18dab7747c369e9927';
export const widths = [360, 390, 768, 1280, 1440],
  locales = ['ar', 'en'];
export const families = [
  ...[
    ['sales', 'SALES', '/portal/quotes'],
    ['operations', 'OPERATIONS', '/portal/operations'],
    ['finance', 'FINANCE', '/portal/finance'],
    ['banks', 'SUPER_ADMIN', '/portal/finance/banks'],
    ['support', 'CUSTOMER_SERVICE', '/portal/support'],
  ].map(([name, role, route]) => ({
    id: 'empty-' + name,
    role,
    route,
    state: 'empty',
    batch: 'empty',
  })),
  ...[
    ['dashboard', 'SUPER_ADMIN', '/portal'],
    ['sales-queue', 'SALES', '/portal/quotes'],
    ['sales-detail', 'SALES', '/portal/quotes/[id]'],
    ['operations-queue', 'OPERATIONS', '/portal/operations'],
    ['job', 'OPERATIONS', '/portal/operations/jobs/[id]'],
    ['trip', 'OPERATIONS', '/portal/operations/trips/[id]'],
    ['finance-queue', 'FINANCE', '/portal/finance'],
    ['finance-detail', 'FINANCE', '/portal/finance/[id]'],
    ['banks', 'SUPER_ADMIN', '/portal/finance/banks'],
    ['support', 'CUSTOMER_SERVICE', '/portal/support'],
  ].map(([name, role, route]) => ({
    id: 'loading-' + name,
    role,
    route,
    state: 'loading',
    batch: 'loading',
  })),
  ...['SUPER_ADMIN', 'SALES', 'OPERATIONS', 'DISPATCHER', 'FINANCE', 'CUSTOMER_SERVICE'].map(
    (role) => ({
      id: 'shell-' + role.toLowerCase(),
      role,
      route: '/portal',
      state: 'populated',
      batch: 'sales-support',
    }),
  ),
  ...[
    'queue',
    'request-review',
    'draft',
    'sent',
    'accepted',
    'rejected',
    'history',
    'validation',
    'error-retry',
    'busy',
    'success',
  ].map((state) => ({
    id: 'sales-' + state,
    role: 'SALES',
    route: state === 'queue' ? '/portal/quotes' : '/portal/quotes/[id]',
    state,
    batch: 'sales-support',
  })),
  ...['populated', 'pagination', 'empty', 'error-retry', 'recovered'].map((state) => ({
    id: 'support-' + state,
    role: 'CUSTOMER_SERVICE',
    route: '/portal/support',
    state,
    batch: 'sales-support',
  })),
  ...[
    'queue',
    'job',
    'planned',
    'assignment-validation',
    'assignment-busy',
    'assignment-error-retry',
    'assignment-success',
    'active',
    'issue',
    'reassignment-dialog',
    'completed',
  ].map((state) => ({
    id: 'operations-' + state,
    role: 'OPERATIONS',
    route:
      state === 'queue'
        ? '/portal/operations'
        : state === 'job'
          ? '/portal/operations/jobs/[id]'
          : '/portal/operations/trips/[id]',
    state,
    batch: 'operations',
  })),
  {
    id: 'dispatcher-planned',
    role: 'DISPATCHER',
    route: '/portal/operations/trips/[id]',
    state: 'planned',
    batch: 'operations',
  },
  ...[
    'queue',
    'filtered-empty',
    'paginated-empty',
    'cash-due',
    'awaiting-proof',
    'review',
    'rejected',
    'resubmitted',
    'confirmed',
    'disabled-reject',
    'error-retry',
    'busy',
    'success',
  ].map((state) => ({
    id: 'finance-' + state,
    role: 'FINANCE',
    route: ['queue', 'filtered-empty', 'paginated-empty'].includes(state)
      ? '/portal/finance'
      : '/portal/finance/[id]',
    state,
    batch: 'finance',
  })),
  ...['populated', 'validation', 'error-retry', 'busy', 'success'].map((state) => ({
    id: 'banks-' + state,
    role: 'SUPER_ADMIN',
    route: '/portal/finance/banks',
    state,
    batch: 'finance',
  })),
];
export function matrixStore(directory = 'docs/reports/evidence/stage3-staff-visual-repaired') {
  mkdirSync(directory, { recursive: true });
  const path = join(directory, 'index.json');
  const index = existsSync(path)
    ? JSON.parse(readFileSync(path, 'utf8'))
    : { applicationSha, rows: [], failures: [], exclusions: [] };
  if (index.applicationSha !== applicationSha) throw Error('MATRIX_APPLICATION_IDENTITY_MISMATCH');
  const required = families.flatMap((f) =>
    locales.flatMap((locale) =>
      widths.map((width) => ({
        id: `${f.id}-${locale}-${width}`,
        family: f.id,
        role: f.role,
        route: f.route,
        state: f.state,
        locale,
        width,
      })),
    ),
  );
  const save = () => {
    const present = new Set(index.rows.filter((r) => r.result === 'PASS').map((r) => r.id));
    index.total = required.length;
    index.pass = present.size;
    index.missing = required.filter((r) => !present.has(r.id)).map((r) => r.id);
    index.required = required;
    writeFileSync(path + '.tmp', JSON.stringify(index, null, 2) + '\n');
    renameSync(path + '.tmp', path);
  };
  for (const row of index.rows) {
    if (
      row.applicationSha !== applicationSha ||
      row.result !== 'PASS' ||
      !existsSync(join(directory, basename(row.filename))) ||
      createHash('sha256')
        .update(readFileSync(join(directory, basename(row.filename))))
        .digest('hex') !== row.sha256
    )
      throw Error('EXISTING_MATRIX_EVIDENCE_INVALID');
  }
  save();
  return {
    directory,
    index,
    required,
    save,
    has: (id) => index.rows.some((r) => r.id === id && r.result === 'PASS'),
    add(row) {
      if (this.has(row.id)) throw Error('ACCEPTED_EVIDENCE_OVERWRITE_DENIED');
      index.rows.push(row);
      save();
    },
    complete(batch) {
      const missing = index.missing.filter(
        (id) =>
          required.find((r) => r.id === id)?.family &&
          families.find((f) => f.id === required.find((r) => r.id === id).family)?.batch === batch,
      );
      if (missing.length) throw Error('BATCH_MATRIX_INCOMPLETE');
      return true;
    },
  };
}
