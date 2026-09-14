import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';

it('runs shared SQL acceptance beside pre-existing market configuration without altering it', async () => {
  const db = await foundationDatabase();
  try {
    await db.exec(`insert into public.organizations(id,name) values('99000000-0000-4000-8000-000000000001','Existing configuration');
      select private.provision_initial_market_catalogue('99000000-0000-4000-8000-000000000001');
      insert into public.services(organization_id,code,name_ar,name_en) values('99000000-0000-4000-8000-000000000001','existing','موجود','Existing');
      insert into public.market_services(organization_id,market_id,service_id)
      select m.organization_id,m.id,s.id from public.markets m join public.services s on s.organization_id=m.organization_id;
      insert into private.customer_enrollment values(true,'99000000-0000-4000-8000-000000000001');`);
    const snapshot = async () =>
      (
        await db.query(`select (select jsonb_agg(to_jsonb(m) order by id) from public.markets m) markets,
      (select jsonb_agg(to_jsonb(c) order by id) from public.market_cities c) cities,
      (select jsonb_agg(to_jsonb(e)) from private.customer_enrollment e) enrollment`)
      ).rows;
    const before = await snapshot();
    for (const suite of ['foundation', 'customer_request', 'phase2', 'phase3', 'market']) {
      await db.exec(
        readFileSync(`supabase/tests/${suite}.test.sql`, 'utf8').split(
          '-- Supabase TAP report',
        )[0]!,
      );
      expect(await snapshot()).toEqual(before);
    }
  } finally {
    await db.close();
  }
});
