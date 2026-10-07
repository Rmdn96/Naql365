import { beforeAll, afterAll, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { foundationDatabase } from '../helpers/database.mjs';
import { blankDraft } from '@/domain/requests/intake';
let db: Awaited<ReturnType<typeof foundationDatabase>>;
const org = '21000000-0000-4000-8000-000000000001',
  customer = '11000000-0000-4000-8000-000000000002',
  service = '41000000-0000-4000-8000-000000000001';
let markets: { id: string; country_code: string }[],
  cities: { id: string; market_id: string; code: string }[];
beforeAll(async () => {
  db = await foundationDatabase();
  await db.exec(
    readFileSync('supabase/tests/phase2.test.sql', 'utf8').split(
      'set local role authenticated;',
    )[0]! + 'commit;',
  );
  await db.query('select private.provision_initial_market_catalogue($1)', [org]);
  await db.query(`update public.markets set active=true where organization_id=$1`, [org]);
  await db.query(`insert into private.customer_enrollment(organization_id) values($1);`, [org]);
  await db.query(
    `insert into private.guest_policy(organization_id,enabled,creations_per_hour) values($1,true,100)`,
    [org],
  );
  await db.query(
    `insert into public.market_cities(organization_id,market_id,region_id,code,name_ar,name_en) select $1,m.id,(select id from public.market_regions where market_id=m.id limit 1),'test-destination','TEST','TEST destination' from public.markets m where m.organization_id=$1`,
    [org],
  );
  await db.query(
    `insert into public.market_services(organization_id,market_id,service_id,active) select $1,id,$2,true from public.markets where organization_id=$1 on conflict do nothing`,
    [org, service],
  );
  await db.query(
    `insert into public.service_areas(organization_id,market_id,service_id,city_id,active,pickup_eligible,delivery_eligible) select $1,market_id,$2,id,true,lower(code) in ('riyadh','cairo'),true from public.market_cities where organization_id=$1 on conflict(organization_id,market_id,service_id,city_id) do update set active=true,pickup_eligible=excluded.pickup_eligible,delivery_eligible=true`,
    [org, service],
  );
  markets = (
    await db.query<{ id: string; country_code: string }>(
      'select id,country_code from public.markets where organization_id=$1',
      [org],
    )
  ).rows;
  cities = (
    await db.query<{ id: string; market_id: string; code: string }>(
      'select id,market_id,lower(code) code from public.market_cities where organization_id=$1',
      [org],
    )
  ).rows;
}, 30000);
afterAll(async () => {
  await db.close();
});
for (const identity of ['customer', 'guest'])
  for (const country of ['SA', 'EG'])
    for (const scenario of [
      'hub',
      'destination',
      'third',
      'reverse',
      'cross-market',
      'forged',
      'inactive-city',
      'inactive-service',
      'addon',
    ])
      test(`${identity} ${country} directional ${scenario}`, async () => {
        await db.exec('reset role');
        await db.exec('begin');
        try {
          const market = markets.find((m) => m.country_code === country)!;
          const hub = cities.find(
            (c) => c.market_id === market.id && c.code === (country === 'SA' ? 'riyadh' : 'cairo'),
          )!;
          const other = cities.find(
            (c) =>
              c.market_id === market.id && c.code === (country === 'SA' ? 'jeddah' : 'alexandria'),
          )!;
          let token = '';
          let id: string;
          if (identity === 'guest') {
            await db.exec("select set_config('request.jwt.claim.sub','',true);set local role anon");
            const r = (
              await db.query<{ r: { token: string; request: { id: string } } }>(
                'select public.start_guest_request($1) r',
                [country],
              )
            ).rows[0]!.r;
            id = r.request.id;
            token = r.token;
            await db.query("select set_config('request.headers',$1,true)", [
              JSON.stringify({ 'x-naql365-guest': token }),
            ]);
          } else {
            await db.query("select set_config('request.jwt.claim.sub',$1,true)", [customer]);
            await db.exec('set local role authenticated');
            const r = (
              await db.query<{ r: { id: string } }>(
                "select public.request_command('create',null,null,$1,$2::jsonb) r",
                [randomUUID(), JSON.stringify({ market_id: market.id })],
              )
            ).rows[0]!.r;
            id = r.id;
          }
          const from = scenario === 'reverse' ? other : hub;
          const to =
            scenario === 'hub'
              ? hub
              : scenario === 'third'
                ? cities.find((c) => c.market_id === market.id && c.code === 'test-destination')!
                : scenario === 'cross-market'
                  ? cities.find((c) => c.market_id !== market.id)!
                  : other;
          const p = {
            ...blankDraft(),
            service_id: service,
            description: 'TEST route',
            contact_name: 'TEST customer',
            contact_phone: country === 'SA' ? '+966500000001' : '+201000000001',
            preferred_date: new Date(Date.now() + 86400000).toISOString().slice(0, 10),
            time_window: 'flexible',
            items: [{ description: 'TEST box', quantity: 1, notes: '' }],
          };
          p.pickup = {
            ...p.pickup,
            city_id: from.id,
            city: 'forged display text',
            address: 'TEST pickup',
            floor: 0,
            elevator: true,
          };
          p.delivery = {
            ...p.delivery,
            city_id: scenario === 'forged' ? randomUUID() : to.id,
            city: 'forged display text',
            address: 'TEST delivery',
            floor: 0,
            elevator: true,
          };
          if (scenario === 'addon')
            p.additional_service_ids = ['42000000-0000-4000-8000-000000000001'];
          const save = db.query("select public.request_command('save',$1,0,$2,$3::jsonb)", [
            id,
            randomUUID(),
            JSON.stringify(p),
          ]);
          if (['cross-market', 'forged'].includes(scenario)) {
            await expect(save).rejects.toThrow('City outside request market');
            return;
          }
          await save;
          await db.exec('reset role');
          if (scenario === 'inactive-city')
            await db.query('update public.service_areas set active=false where city_id=$1', [
              to.id,
            ]);
          if (scenario === 'inactive-service')
            await db.query('update public.market_services set active=false where market_id=$1', [
              market.id,
            ]);
          if (scenario === 'addon')
            await db.query(
              'update public.service_addon_applicability set active=false where organization_id=$1',
              [org],
            );
          await db.exec(
            identity === 'guest' ? 'set local role anon' : 'set local role authenticated',
          );
          const submit = db.query("select public.request_command('submit',$1,1,$2,'{}')", [
            id,
            randomUUID(),
          ]);
          if (['hub', 'destination', 'third'].includes(scenario))
            await expect(submit).resolves.toBeDefined();
          else await expect(submit).rejects.toThrow('route or add-on unavailable');
        } finally {
          await db.exec('rollback');
        }
      });
