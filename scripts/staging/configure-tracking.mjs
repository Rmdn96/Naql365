// Explicit non-production maintenance configuration; never infer a Production policy.
import { stagingProject, query } from './supabase.mjs';
if (process.argv.length !== 3 || process.argv[2] !== '--apply')
  throw Error('Pass --apply for Staging-only retention configuration');
const ref = stagingProject();
query(
  ref,
  `begin;create extension if not exists pg_cron with schema pg_catalog;
update private.tracking_configuration set staging_retention_hours=24 where singleton;
select cron.schedule('naql365-staging-tracking-retention','*/10 * * * *','select private.prune_tracking_history()');
commit;`,
);
const result = query(
  ref,
  `select c.staging_retention_hours,j.active,j.schedule,j.command from private.tracking_configuration c join cron.job j on j.jobname='naql365-staging-tracking-retention' where c.singleton`,
);
if (
  result.length !== 1 ||
  result[0].staging_retention_hours !== 24 ||
  !result[0].active ||
  result[0].command !== 'select private.prune_tracking_history()'
)
  throw Error('Staging retention verification failed');
console.log(
  JSON.stringify({
    environment: 'Staging',
    retentionHours: 24,
    pruneIntervalMinutes: 10,
    batchLimit: 10000,
    productionPolicyConfigured: false,
  }),
);
