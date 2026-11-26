import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { foundationDatabase } from '../helpers/database.mjs';

it('imports the commercial kit as drafts and isolates the reviewed quote workflow from payments', async () => {
  const db = await foundationDatabase();
  const org = '91000000-0000-4000-8000-000000000001';
  const operator = '92000000-0000-4000-8000-000000000002';
  const fixture = readFileSync('supabase/tests/store_purchase.test.sql', 'utf8').split(
    '-- FIXTURE END.',
  )[0]!;
  const catalog = JSON.parse(readFileSync('docs/catalog-quote/catalog-review.json', 'utf8'));
  const imported = new Map<string, string>();
  try {
    await db.exec(fixture + '\ncommit;');
    for (const category of catalog.categories) {
      const row = await db.query<{ id: string }>(
        'insert into private.store_categories(organization_id,slug,draft_content) values($1,$2,$3) on conflict(organization_id,slug) do nothing returning id',
        [
          org,
          category.code.toLowerCase(),
          JSON.stringify({ title_ar: category.title_ar, title_en: category.title_en }),
        ],
      );
      imported.set(category.code, row.rows[0]!.id);
    }
    for (const item of catalog.items) {
      const key = imported.get(item.category);
      const args = [
        org,
        key,
        item.sku,
        item.sku.toLowerCase(),
        JSON.stringify({ title_ar: item.title_ar, title_en: item.title_en }),
      ];
      for (let attempt = 0; attempt < 2; attempt++)
        await db.query(
          'insert into private.store_products(organization_id,category_id,sku,slug,draft_content) values($1,$2,$3,$4,$5) on conflict(organization_id,sku) do nothing',
          args,
        );
    }
    expect(
      (
        await db.query(
          "select count(*)::int n from private.store_products where sku <> 'SYNTHETIC'",
        )
      ).rows[0],
    ).toEqual({ n: 40 });
    const listing = (
      await db.query<{ id: string; revision: number }>(
        "select id,revision from private.store_products where sku='SYNTHETIC'",
      )
    ).rows[0]!;
    const gate = await db.query(
      "insert into private.store_quote_launch(scope_id) select id from private.store_policy_versions where kind='STOREFRONT_SCOPE' returning enabled",
    );
    expect(gate.rows[0]).toEqual({ enabled: false });
    const key = randomUUID();
    const contact = {
      full_name: 'Synthetic Guest',
      phone: '01012345678',
      governorate: 'GIZA',
      area: 'Test',
      address: 'Synthetic address',
    };
    const items = [{ sku: 'SYNTHETIC', quantity: 2, revision: Number(listing.revision) }];
    const submit = async (patch = {}, line = items) =>
      (
        await db.query<{ ref: string }>('select public.store_submit_quote($1,$2,$3) ref', [
          key,
          JSON.stringify({ ...contact, ...patch }),
          JSON.stringify(line),
        ])
      ).rows[0]!.ref;
    await db.exec('set role anon');
    const projection = async () =>
      (
        await db.query<{ v: { enabled: boolean; items: object[] } }>(
          'select public.store_quote_catalog() v',
        )
      ).rows[0]!.v;
    expect(await projection()).toEqual({ enabled: false, items: [] });
    await expect(submit()).rejects.toMatchObject({ code: 'PT409' });
    await expect(db.query('select * from private.store_quote_requests')).rejects.toMatchObject({
      code: '42501',
    });
    await db.exec('reset role; update private.store_quote_launch set enabled=true');
    await db.exec('set role anon');
    expect(await projection()).toEqual({ enabled: true, items: [] });
    await expect(submit()).rejects.toMatchObject({ code: 'PT409' });
    await db.exec(
      "reset role; set role authenticated;select set_config('request.jwt.claim.sub','" +
        operator +
        "',false)",
    );
    await expect(
      db.query('select public.store_approve_quote_product($1,$2,true)', [
        listing.id,
        listing.revision,
      ]),
    ).rejects.toMatchObject({ code: '42501' });
    await db.exec(
      "reset role;insert into public.user_roles(organization_id,profile_id,role_id) select '" +
        org +
        "','" +
        operator +
        "',id from public.roles where code='SUPER_ADMIN';set role authenticated",
    );
    await db.query('select public.store_approve_quote_product($1,$2,true)', [
      listing.id,
      listing.revision,
    ]);
    await db.exec("reset role; set role anon; select set_config('request.jwt.claim.sub','',false)");
    expect((await projection()).items).toEqual([
      expect.objectContaining({ sku: 'SYNTHETIC', price: null }),
    ]);
    await expect(submit()).rejects.toMatchObject({ code: 'PT409' });
    items[0]!.revision += 1;
    await expect(submit({ governorate: 'ALEXANDRIA' })).rejects.toMatchObject({ code: '22023' });
    await expect(submit({}, [{ ...items[0]!, quantity: 100 }])).rejects.toMatchObject({
      code: '22023',
    });
    const reference = await submit();
    expect(reference).toMatch(/^Q-[a-f0-9]{32}$/);
    expect(await submit()).toBe(reference);
    await expect(submit({ area: 'Changed' })).rejects.toMatchObject({ code: 'P4091' });
    await expect(db.query('select public.store_quote_queue()')).rejects.toMatchObject({
      code: '42501',
    });
    await db.exec(
      "reset role;set role authenticated;select set_config('request.jwt.claim.sub','" +
        operator +
        "',false)",
    );
    const queue = async () =>
      (
        await db.query<{
          v: { offer: Record<string, unknown> | null; confirmed_at: string | null }[];
        }>('select public.store_quote_queue() v')
      ).rows[0]!.v;
    expect(await queue()).toEqual([
      expect.objectContaining({ reference, offer: null, confirmed_at: null }),
    ]);
    await expect(
      db.query("select public.store_review_quote($1,0,p_confirmation=>'test')", [key]),
    ).rejects.toMatchObject({ code: '22023' });
    await db.query('select public.store_review_quote($1,0,$2)', [
      key,
      JSON.stringify({ prices: { SYNTHETIC: 1500 }, delivery: 200 }),
    ]);
    expect((await queue())[0]?.offer).toMatchObject({ total: 3200, version: 1 });
    await expect(
      db.query("select public.store_review_quote($1,0,p_confirmation=>'test')", [key]),
    ).rejects.toMatchObject({ code: 'PT409' });
    await db.query(
      "select public.store_review_quote($1,1,p_confirmation=>'Synthetic reviewed consent')",
      [key],
    );
    expect((await queue())[0]?.confirmed_at).toBeTruthy();
    await expect(
      db.query("select public.store_review_quote($1,2,p_confirmation=>'test')", [key]),
    ).rejects.toMatchObject({ code: 'PT409' });
    await db.exec('reset role');
    expect((await db.query('select count(*)::int n from private.store_payments')).rows[0]).toEqual({
      n: 0,
    });
  } finally {
    await db.close();
  }
}, 60000);
