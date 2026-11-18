import { it, expect } from 'vitest';
import { randomUUID, createHash } from 'node:crypto';
import sharp from 'sharp';
import { optionalDescriptions } from '../../src/domain/store/draft-content';
import { foundationDatabase } from '../helpers/database.mjs';
it('persists paused-scope category, product, EGP price and image metadata without supplier records', async () => {
  const db = await foundationDatabase();
  const org = randomUUID(),
    owner = randomUUID(),
    role = randomUUID(),
    scope = randomUUID(),
    policy = randomUUID();
  try {
    await db.exec(
      `insert into public.organizations(id,name) values('${org}','Isolated store test');insert into auth.users(id) values('${owner}');select private.provision_initial_market_catalogue('${org}');update public.markets set active=true where organization_id='${org}';insert into public.organization_memberships(organization_id,profile_id,member_type,status) values('${org}','${owner}','staff','active');insert into public.roles(id,code,member_type) values('${role}','TEST_STORE_OPERATOR','staff');insert into public.role_permissions select '${role}',id from public.permissions where code like 'store.%' or code='portal.access';insert into public.user_roles values('${org}','${owner}','${role}',now());`,
    );
    const market = (
      await db.query<{ id: string }>(`select id from public.markets where organization_id=$1`, [
        org,
      ])
    ).rows[0]!.id;
    await db.query(
      `insert into private.store_policy_versions(id,organization_id,market_id,currency,kind,policy_code,version,content,status,scope_paused,effective_from,approved_by,approved_at,evidence_ref) values($1,$2,$3,'EGP','STOREFRONT_SCOPE','isolated-test',1,'{"publication_enabled":false}','APPROVED',true,now(),$4,now(),'Isolated test authorization')`,
      [scope, org, market, owner],
    );
    await db.query(
      `insert into private.store_policy_versions(id,organization_id,market_id,currency,kind,policy_code,version,content,effective_from) values($1,$2,$3,'EGP','RETAIL_PRESENTATION','test-retail',1,'{"title_ar":"سعر اختبار","title_en":"Test price","body_ar":"للاختبار فقط","body_en":"Isolated testing only"}',now())`,
      [policy, org, market],
    );
    await db.exec(
      `set role authenticated;select set_config('request.jwt.claim.sub','${owner}',false);`,
    );
    const command = async (
      operation: string,
      payload: object,
      target: string | null = null,
      revision: number | null = null,
    ) =>
      (
        await db.query<{ result: { id: string; revision: number } }>(
          `select public.store_catalog_ui_command_v1('EG','draft',$1,$2,$3::jsonb,$4::uuid,$5::bigint) as result`,
          [operation, randomUUID(), JSON.stringify(payload), target, revision],
        )
      ).rows[0]!.result;
    const category = await command('create_category', {
      slug: 'test-category',
      content: { title_ar: 'فئة اختبار', title_en: 'Test category' },
      parent_id: null,
    });
    const product = await command('create_product', {
      slug: 'test-product',
      sku: 'TEST-001',
      category_id: category.id,
      content: {
        title_ar: 'منتج اختبار',
        title_en: 'Test product',
        ...optionalDescriptions('', ''),
        specifications: [],
      },
    });
    const listing = await command('create_listing', { product_id: product.id });
    await command('create_price', {
      listing_id: listing.id,
      version: 1,
      amount_minor: 12550,
      presentation_policy_id: policy,
      effective_from: new Date().toISOString(),
    });
    const image = await sharp({
      create: { width: 32, height: 32, channels: 3, background: '#0055aa' },
    })
      .webp()
      .toBuffer();
    const asset = randomUUID();
    const ext = async (action: string, payload: object) =>
      (
        await db.query<{ result: { id: string } }>(
          `select public.store_catalog_extension_v1($1,$2,$3,$4,$5,1,$6::jsonb) as result`,
          [org, market, action, randomUUID(), listing.id, JSON.stringify(payload)],
        )
      ).rows[0]!.result;
    await ext('reserve_media', {
      assetId: asset,
      size: image.length,
      sha256: createHash('sha256').update(image).digest('hex'),
      rightsReference: 'Generated test image',
    });
    // PGlite models Storage metadata only. Real upload/browser acceptance is separate.
    await db.exec('reset role');
    await db.query(
      `insert into storage.objects(bucket_id,name,metadata) values('store-product-media',$1,$2::jsonb)`,
      [asset + '.webp', JSON.stringify({ mimetype: 'image/webp', size: image.length })],
    );
    await db.exec('set role authenticated');
    await ext('finalize_media', { assetId: asset });
    const read = async (kind: string) =>
      (
        await db.query<{
          result: {
            items: {
              id: string;
              content: { title_en: string };
              amountMinor: number;
              pendingMedia: unknown[];
              state: string;
            }[];
          };
        }>(`select public.store_catalog_admin_v2($1,$2,$3) as result`, [org, market, kind])
      ).rows[0]!.result;
    expect((await read('products')).items[0]!.content.title_en).toBe('Test product');
    expect((await read('categories')).items[0]!.id).toBe(category.id);
    expect((await read('prices')).items[0]!.amountMinor).toBe(12550);
    expect((await read('listings')).items[0]!.pendingMedia).toHaveLength(1);
    expect((await read('listings')).items[0]!.state).toBe('DRAFT');
    await db.exec('reset role');
    expect(
      (await db.query<{ n: number }>(`select count(*)::int as n from private.store_suppliers`))
        .rows[0]!.n,
    ).toBe(0);
    expect(
      (
        await db.query<{ n: number }>(
          `select count(*)::int as n from private.store_supplier_agreements`,
        )
      ).rows[0]!.n,
    ).toBe(0);
    expect(
      (
        await db.query(
          `select scope_paused,content from private.store_policy_versions where id=$1`,
          [scope],
        )
      ).rows[0],
    ).toEqual({ scope_paused: true, content: { publication_enabled: false } });
  } finally {
    await db.close();
  }
});
