import { expect, it } from 'vitest';
import { foundationDatabase } from '../helpers/database.mjs';
import { authFixtureCleanupSql } from '../../scripts/staging/auth-fixture-cleanup.mjs';

it('fixture cleanup handles onboarding in an existing tenant and preserves unrelated identities and tenant data', async () => {
  const db = await foundationDatabase();
  const org = '80000000-0000-4000-8000-000000000001',
    ownerOrg = '80000000-0000-4000-8000-000000000002',
    user = '90000000-0000-4000-8000-000000000001',
    owner = '90000000-0000-4000-8000-000000000002';
  try {
    await db.exec(
      `insert into public.organizations(id,name) values('${org}','Run-owned'),('${ownerOrg}','Retained'); insert into auth.users(id) values('${user}'),('${owner}'); insert into public.organization_memberships(organization_id,profile_id,member_type) values('${ownerOrg}','${user}','customer'),('${ownerOrg}','${owner}','customer'); insert into public.customers(organization_id,profile_id) values('${ownerOrg}','${user}'),('${ownerOrg}','${owner}'); insert into public.audit_logs(organization_id,actor_id,action,entity_type) values('${ownerOrg}','${user}','fixture','customers'),('${ownerOrg}','${owner}','retained','customers');`,
    );
    const retainedAudit = (
      await db.query(`select * from public.audit_logs where actor_id='${owner}' order by id`)
    ).rows;
    await db.exec(authFixtureCleanupSql(org, [user]));
    expect((await db.query('select name from public.organizations order by name')).rows).toEqual([
      { name: 'Retained' },
    ]);
    expect((await db.query('select profile_id from public.customers')).rows).toEqual([
      { profile_id: owner },
    ]);
    expect((await db.query('select profile_id from public.organization_memberships')).rows).toEqual(
      [{ profile_id: owner }],
    );
    expect(
      (await db.query(`select * from public.audit_logs where actor_id='${owner}' order by id`))
        .rows,
    ).toEqual(retainedAudit);
    expect(
      (
        await db.query(
          `select count(*)::int as count from public.audit_logs where actor_id='${user}' or (entity_type in ('organization_memberships','user_roles') and entity_id='${user}')`,
        )
      ).rows[0],
    ).toEqual({ count: 0 });
    expect((await db.query('select count(*)::int as count from auth.users')).rows[0]).toEqual({
      count: 2,
    });
  } finally {
    await db.close();
  }
});
it('fixture cleanup refuses empty, malformed and unbounded ledgers', () => {
  for (const users of [[], ['invalid'], Array(9).fill('90000000-0000-4000-8000-000000000001')])
    expect(() => authFixtureCleanupSql('80000000-0000-4000-8000-000000000001', users)).toThrow(
      'FIXTURE_LEDGER_DENIED',
    );
  expect(() =>
    authFixtureCleanupSql("';delete from auth.users;--", ['90000000-0000-4000-8000-000000000001']),
  ).toThrow('FIXTURE_LEDGER_DENIED');
});
