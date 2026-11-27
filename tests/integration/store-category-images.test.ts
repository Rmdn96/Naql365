import { expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { foundationDatabase } from '../helpers/database.mjs';

it('keeps category media private while drafting and revokes previous images on replacement and removal', async () => {
  const db = await foundationDatabase();
  const org = '91000000-0000-4000-8000-000000000001';
  const market = '95000000-0000-4000-8000-000000000001';
  const owner = '92000000-0000-4000-8000-000000000002';
  const staff = '92000000-0000-4000-8000-000000000003';
  const category = '98000000-0000-4000-8000-000000000001';
  const product = '98000000-0000-4000-8000-000000000002';
  const digest = createHash('sha256').update('illustration fixture').digest('hex');
  const bytes = JSON.stringify({ size: 20, sha256: digest, rights: 'Illustration fixture' });
  const metadata = JSON.stringify({ mimetype: 'image/webp', size: 20 });
  const first = randomUUID(),
    replacement = randomUUID(),
    stale = randomUUID();
  const path = (asset: string) => 'category/' + asset + '.webp';
  const command = (action: string, asset: string, revision: number, input = '{}') =>
    db.query('select public.store_category_image_command($1,$2,$3,$4,$5,$6,$7)', [
      org,
      market,
      category,
      revision,
      action,
      asset,
      input,
    ]);
  const as = async (role: 'anon' | 'authenticated' | 'postgres', sub = '') => {
    await db.exec('reset role');
    await db.query("select set_config('request.jwt.claim.sub',$1,false)", [sub]);
    if (role !== 'postgres') await db.exec('set role ' + role);
  };
  const projection = async () =>
    (await db.query<{ v: unknown }>('select public.store_quote_category_images() v')).rows[0]?.v;
  const access = async (asset: string) =>
    (
      await db.query<{ v: boolean }>('select exists(select from storage.objects where name=$1) v', [
        path(asset),
      ])
    ).rows[0]?.v;
  const object = (asset: string, meta = metadata) =>
    db.query(
      "insert into storage.objects(bucket_id,name,metadata) values('store-product-media',$1,$2)",
      [path(asset), meta],
    );
  try {
    const fixture = readFileSync('supabase/tests/store_purchase.test.sql', 'utf8').split(
      '-- FIXTURE END.',
    )[0]!;
    await db.exec(
      fixture +
        '\ncommit; grant usage on schema storage to anon; grant select on storage.objects to anon;',
    );
    await db.query(
      "insert into public.user_roles(organization_id,profile_id,role_id) select $1,$2,id from public.roles where code='SUPER_ADMIN'",
      [org, owner],
    );
    await db.exec(
      "insert into private.store_quote_launch(scope_id) select id from private.store_policy_versions where kind='STOREFRONT_SCOPE'",
    );
    await as('authenticated', staff);
    await expect(command('reserve', first, 1, bytes)).rejects.toMatchObject({ code: '42501' });
    await expect(
      db.query('select public.store_category_image_admin($1,$2,$3)', [org, market, [category]]),
    ).rejects.toMatchObject({ code: '42501' });
    await as('anon');
    await expect(command('reserve', first, 1, bytes)).rejects.toMatchObject({ code: '42501' });
    await as('authenticated', owner);
    await command('reserve', first, 1, bytes);
    await command('reserve', first, 1, bytes);
    await expect(command('finish', first, 1)).rejects.toMatchObject({ code: 'PT409' });
    await db.exec("select set_config('storage.operation','object.upload',false)");
    await expect(
      object(first, JSON.stringify({ mimetype: 'image/png', size: 20 })),
    ).rejects.toMatchObject({ code: '42501' });
    await object(first);
    await command('finish', first, 1);
    await command('finish', first, 1);
    await as('anon');
    expect(await access(first)).toBe(false);
    expect(await projection()).toEqual({});
    await as('authenticated', owner);
    await command('approve', first, 2);
    await as('anon');
    expect(await access(first)).toBe(false);
    expect(await projection()).toEqual({});
    await as('postgres');
    await db.query(
      'update private.store_products set revision=revision+1,quote_approved_revision=revision+1 where id=$1',
      [product],
    );
    await db.exec('update private.store_quote_launch set enabled=true');
    await as('anon');
    expect(await access(first)).toBe(true);
    expect(await projection()).toEqual({ 'synthetic-category': first });
    await as('authenticated', owner);
    await command('reserve', replacement, 3, bytes);
    await command('reserve', stale, 3, bytes);
    await object(replacement);
    await command('finish', replacement, 3);
    await expect(command('finish', stale, 3)).rejects.toMatchObject({ code: 'PT409' });
    await as('anon');
    expect(await access(first)).toBe(false);
    expect(await access(replacement)).toBe(false);
    expect(await projection()).toEqual({});
    await as('authenticated', owner);
    await command('approve', replacement, 4);
    await command('remove', replacement, 5);
    await as('anon');
    expect(await access(replacement)).toBe(false);
    expect(await projection()).toEqual({});
    await as('postgres');
    expect(
      (
        await db.query(
          "select count(*)::int n from public.audit_logs where action like 'store.category_image_%'",
        )
      ).rows,
    ).toEqual([{ n: 5 }]);
  } finally {
    await db.close();
  }
}, 60000);
