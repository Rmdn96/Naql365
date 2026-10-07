import { beforeAll, afterAll, expect, test } from 'vitest';
import { readFileSync } from 'node:fs';
import { foundationDatabase } from '../helpers/database.mjs';
let db: Awaited<ReturnType<typeof foundationDatabase>>;
const request = '51000000-0000-4000-8000-000000000001';
const mutation = '69000000-0000-4000-8000-000000000099';
const command = (amount = 12345, revision = 2, id = mutation) =>
  `select public.create_manual_quote_draft('${request}',${revision},${amount},12.5,'Verified road',172800,'${id}') result`;
beforeAll(async () => {
  db = await foundationDatabase(45);
  const fixture = readFileSync('supabase/tests/phase2.test.sql', 'utf8').split(
    'set local role authenticated;',
  )[0]!;
  await db.exec(fixture + 'commit;');
  const before = (await db.query('select to_jsonb(s) value from public.pricing_settings s')).rows;
  await db.exec(
    readFileSync(
      'supabase/migrations/20261007000100_manual_pricing_directional_coverage.sql',
      'utf8',
    ),
  );
  expect(
    (await db.query<{ pricing_mode: string }>('select pricing_mode from public.pricing_settings'))
      .rows[0]?.pricing_mode,
  ).toBe('AUTOMATED');
  expect(before).toHaveLength(1);
  await db.exec(
    "update public.pricing_settings set pricing_mode='MANUAL';set role authenticated;select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',false)",
  );
}, 30000);
afterAll(async () => {
  await db?.close();
});
test('manual quote derives SAR tax, has no dummy evaluation, and replays exactly', async () => {
  const first = (await db.query<{ result: { total_minor: number } }>(command())).rows;
  expect(first[0]?.result.total_minor).toBe(14197);
  expect((await db.query(command())).rows).toEqual(first);
  await db.exec('reset role');
  expect((await db.query('select id from public.pricing_evaluations')).rows).toHaveLength(0);
  const d = (
    await db.query<{ pricing_mode: string; evaluation_id: null; created_by: string }>(
      'select * from public.quote_pricing_details',
    )
  ).rows[0]!;
  expect(d.pricing_mode).toBe('MANUAL');
  expect(d.evaluation_id).toBeNull();
  expect(d.created_by).toBe('11000000-0000-4000-8000-000000000001');
  await db.exec('set role authenticated');
});
test('rejects conflicting retry, stale revision, negative and oversized amounts', async () => {
  await expect(db.query(command(12346))).rejects.toThrow('Conflicting retry');
  await expect(db.query(command(1, 999, '69000000-0000-4000-8000-000000000098'))).rejects.toThrow(
    'Request revision changed',
  );
  await expect(db.query(command(-1))).rejects.toThrow('Invalid manual quote input');
  await expect(db.query(command(900000000001))).rejects.toThrow('Invalid manual quote input');
});
test('manual mode denies automatic pricing even to Sales', async () => {
  await expect(
    db.query(
      `select public.calculate_preliminary_price('${request}',12.5,null,'61000000-0000-4000-8000-000000000001',2,gen_random_uuid())`,
    ),
  ).rejects.toThrow('Automated pricing unavailable');
});
test('customer cannot mutate manual quotes or read provenance', async () => {
  await db.exec(
    "select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',false)",
  );
  await expect(db.query(command())).rejects.toThrow('Request unavailable');
  expect((await db.query('select * from public.quote_pricing_details')).rows).toHaveLength(0);
  await db.exec(
    "select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',false)",
  );
});
test('manual quote sends through existing workflow and survives a mode change immutably', async () => {
  await db.query(`select public.send_quote('${mutation}')`);
  await db.exec("reset role;update public.pricing_settings set pricing_mode='AUTOMATED'");
  await expect(
    db.query(`update public.quote_versions set final_subtotal_minor=1 where id='${mutation}'`),
  ).rejects.toThrow();
  expect(
    (
      await db.query<{ status: string }>(
        `select status from public.quote_versions where id='${mutation}'`,
      )
    ).rows[0]?.status,
  ).toBe('SENT');
  await db.exec('set role authenticated');
});

test('directional coverage supports SA/EG hub routes and rejects reverse routes', async () => {
  await db.exec(`reset role; select private.provision_initial_market_catalogue('21000000-0000-4000-8000-000000000001');
 update public.markets set active=true where organization_id='21000000-0000-4000-8000-000000000001';
 insert into public.market_services(organization_id,market_id,service_id,active)
 select organization_id,id,'41000000-0000-4000-8000-000000000001',true from public.markets where organization_id='21000000-0000-4000-8000-000000000001' on conflict do nothing;
 insert into public.service_areas(organization_id,market_id,service_id,city_id,active,pickup_eligible,delivery_eligible)
 select ms.organization_id,ms.market_id,ms.service_id,c.id,true,lower(c.code) in ('riyadh','cairo'),true from public.market_services ms join public.market_cities c on c.market_id=ms.market_id
 where ms.organization_id='21000000-0000-4000-8000-000000000001' on conflict(organization_id,market_id,service_id,city_id) do update set pickup_eligible=excluded.pickup_eligible,delivery_eligible=true;
 `);
  for (const [country, origin, destination, allowed] of [
    ['SA', 'Riyadh', 'Riyadh', true],
    ['SA', 'Riyadh', 'Jeddah', true],
    ['SA', 'Jeddah', 'Riyadh', false],
    ['EG', 'cairo', 'cairo', true],
    ['EG', 'cairo', 'alexandria', true],
    ['EG', 'alexandria', 'cairo', false],
  ] as const) {
    await db.exec('begin');
    try {
      const ids = (
        await db.query<{ id: string; market_id: string }>(
          `insert into public.requests(organization_id,market_id,customer_id,service_id,description,contact_name,contact_phone,preferred_date,time_window)
 select organization_id,id,'31000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','TEST move','TEST customer',case country_code when 'SA' then '+966500000001' else '+201000000001' end,current_date+1,'flexible' from public.markets where organization_id='21000000-0000-4000-8000-000000000001' and country_code=$1 returning id,market_id`,
          [country],
        )
      ).rows[0]!;
      for (const [kind, code] of [
        ['pickup', origin],
        ['delivery', destination],
      ])
        await db.query(
          `insert into public.request_locations(organization_id,request_id,kind,city,city_id,address,floor,elevator)
 select organization_id,$1,$2,name_en,id,'TEST address',0,true from public.market_cities where market_id=$3 and code=$4`,
          [ids.id, kind, ids.market_id, code],
        );
      await db.query(
        "insert into public.request_items(organization_id,request_id,description,quantity,position) values('21000000-0000-4000-8000-000000000001',$1,'TEST item',1,0)",
        [ids.id],
      );
      await db.exec(
        "set local role authenticated;select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000002',true)",
      );
      const action = db.query(
        "select public.request_command('submit',$1,0,gen_random_uuid(),'{}')",
        [ids.id],
      );
      if (allowed) await expect(action).resolves.toBeDefined();
      else await expect(action).rejects.toThrow('route or add-on unavailable');
    } finally {
      await db.exec('rollback');
    }
  }
  await db.exec('set role authenticated');
});

test('Egypt manual quotes derive EGP and effective tax, and stale manual drafts cannot be sent', async () => {
  await db.exec(`reset role;
 insert into public.pricing_settings(organization_id,market_id,currency,pricing_mode)
 select organization_id,id,currency,'MANUAL' from public.markets where organization_id='21000000-0000-4000-8000-000000000001' and country_code='EG';
 insert into public.market_tax_versions(organization_id,market_id,code,version,rate_bps,label_ar,label_en,active,effective_from,configuration_kind)
 select organization_id,id,'test-eg-manual',1,1400,'اختبار','TEST',true,now()-interval '1 day','STAGING_TEST' from public.markets where organization_id='21000000-0000-4000-8000-000000000001' and country_code='EG';`);
  const r = (
    await db.query<{
      id: string;
    }>(`insert into public.requests(organization_id,market_id,customer_id,service_id,status,revision,reference,submitted_at)
 select organization_id,id,'31000000-0000-4000-8000-000000000001','41000000-0000-4000-8000-000000000001','SUBMITTED',3,'N365-202610-990001',now() from public.markets where organization_id='21000000-0000-4000-8000-000000000001' and country_code='EG' returning id`)
  ).rows[0]!;
  await db.exec(
    "set role authenticated;select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',false)",
  );
  const q = (
    await db.query<{
      result: { id: string; currency: string; vat_amount_minor: number; total_minor: number };
    }>(
      `select public.create_manual_quote_draft($1,3,10005,1.250,'TEST',1000,gen_random_uuid()) result`,
      [r.id],
    )
  ).rows[0]!.result;
  expect(q.currency).toBe('EGP');
  expect(q.vat_amount_minor).toBe(1401);
  expect(q.total_minor).toBe(11406);
  await db.exec('reset role');
  await db.query('update public.requests set revision=revision+1 where id=$1', [r.id]);
  await db.exec('set role authenticated');
  await expect(db.query('select public.send_quote($1)', [q.id])).rejects.toThrow(
    'Quote cannot be sent',
  );
});

test('manual provenance rejects absent amount, inactive coverage and inapplicable add-ons fail closed', async () => {
  await db.exec('reset role');
  await db.exec('begin');
  try {
    await expect(
      db.query(
        `update public.quote_pricing_details set manual_subtotal_minor=null where pricing_mode='MANUAL' and sent_by is null`,
      ),
    ).rejects.toThrow();
  } finally {
    await db.exec('rollback');
  }
  await db.exec('reset role');
  await db.exec('begin');
  try {
    await db.query(
      `update public.service_areas set active=false where organization_id='21000000-0000-4000-8000-000000000001'`,
    );
    expect(
      (
        await db.query<{ valid: boolean }>(
          `select private.request_coverage_valid(r) valid from public.requests r where id='${request}'`,
        )
      ).rows[0]?.valid,
    ).toBe(false);
  } finally {
    await db.exec('rollback');
  }
  await db.exec('reset role');
  await db.exec('begin');
  try {
    await db.query(
      `update public.service_addon_applicability set active=false where organization_id='21000000-0000-4000-8000-000000000001'`,
    );
    await db.query(
      `insert into public.request_additional_services(organization_id,request_id,additional_service_id) select organization_id,'${request}',id from public.additional_services where organization_id='21000000-0000-4000-8000-000000000001' limit 1 on conflict do nothing`,
    );
    expect(
      (
        await db.query<{ valid: boolean }>(
          `select private.request_coverage_valid(r) valid from public.requests r where id='${request}'`,
        )
      ).rows[0]?.valid,
    ).toBe(false);
  } finally {
    await db.exec('rollback');
  }
});

test('Customer, other tenant Sales, unprivileged Operations, Driver and anonymous cannot author manual pricing', async () => {
  await db.exec('reset role');
  await db.exec(`insert into auth.users(id,email,email_confirmed_at) values('11000000-0000-4000-8000-000000000099','manual-driver@example.invalid',now());
  insert into public.organization_memberships(organization_id,profile_id,member_type) values('21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000099','driver');
  insert into public.user_roles(organization_id,profile_id,role_id) select '21000000-0000-4000-8000-000000000001','11000000-0000-4000-8000-000000000099',id from public.roles where code='DRIVER';`);
  for (const suffix of ['002', '003', '004', '005', '099']) {
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
      '11000000-0000-4000-8000-000000000' + suffix,
    ]);
    await db.exec('set role authenticated');
    await expect(db.query(command())).rejects.toThrow('Request unavailable');
    await db.exec('reset role');
  }
  await db.exec("select set_config('request.jwt.claim.sub','',false);set role anon");
  await expect(db.query(command())).rejects.toThrow('permission denied');
  await db.exec('reset role');
});

test('Sales revises a manual draft without duplicate drafts or changing previously sent money', async () => {
  await db.exec(
    "reset role;update public.pricing_settings set pricing_mode='MANUAL';select set_config('request.jwt.claim.sub','11000000-0000-4000-8000-000000000001',false);set role authenticated",
  );
  const r = '51000000-0000-4000-8000-000000000003';
  const a = '69000000-0000-4000-8000-000000000071',
    b = '69000000-0000-4000-8000-000000000072',
    c = '69000000-0000-4000-8000-000000000073';
  const create = (id: string, amount: number) =>
    db.query(
      "select public.create_manual_quote_draft($1,1,$2,10,'TEST verified route',3600,$3) result",
      [r, amount, id],
    );
  const first = await create(a, 10000);
  await create(b, 20000);
  expect((await create(a, 10000)).rows).toEqual(first.rows);
  await db.query('select public.send_quote($1)', [b]);
  await create(c, 30000);
  await db.query('select public.send_quote($1)', [c]);
  const rows = (
    await db.query<{ id: string; status: string; final_subtotal_minor: number }>(
      'select id,status,final_subtotal_minor from public.quote_versions where id in ($1,$2,$3) order by id',
      [a, b, c],
    )
  ).rows;
  expect(rows).toEqual([
    { id: b, status: 'SUPERSEDED', final_subtotal_minor: 20000 },
    { id: c, status: 'SENT', final_subtotal_minor: 30000 },
  ]);
});
