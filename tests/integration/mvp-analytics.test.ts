import { expect, test } from 'vitest';
import { randomUUID } from 'node:crypto';
import { foundationDatabase } from '../helpers/database.mjs';
test('anonymous metrics are finite, private, rate bounded and contain no journey identifiers', async () => {
  const db = await foundationDatabase();
  try {
    const org = randomUUID();
    await db.query('insert into public.organizations(id,name) values($1,$2)', [
      org,
      'TEST analytics',
    ]);
    await db.query(
      "insert into public.markets(organization_id,country_code,name_ar,name_en,currency,timezone,phone_country_code,active) values($1,'SA','اختبار','TEST','SAR','Asia/Riyadh','+966',true)",
      [org],
    );
    await db.query('insert into private.customer_enrollment(organization_id) values($1)', [org]);
    await db.exec('set role anon');
    await db.query("select public.record_mvp_event('homepage_viewed','SA','home')");
    await expect(
      db.query("select public.record_mvp_event('secret-token','SA','home')"),
    ).rejects.toThrow('Unsupported metric');
    await expect(db.query('select * from private.mvp_funnel_counts')).rejects.toThrow();
    await db.exec('reset role');
    const row = (
      await db.query<{ count: number | string }>('select * from private.mvp_funnel_counts')
    ).rows[0]!;
    expect(Object.keys(row).sort()).toEqual(
      ['organization_id', 'day', 'country', 'event', 'context', 'count'].sort(),
    );
    expect(Number(row.count)).toBe(1);
    await db.query(
      "update private.guest_rate_budgets set used=600 where organization_id=$1 and scope='analytics'",
      [org],
    );
    await db.exec('set role anon');
    await expect(
      db.query("select public.record_mvp_event('homepage_viewed','SA','home')"),
    ).rejects.toThrow('retry');
  } finally {
    await db.close();
  }
}, 30000);
