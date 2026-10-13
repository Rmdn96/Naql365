// Operator-only synthetic preparation. Never imported by application code.
import { randomUUID } from 'node:crypto';
import { query } from './supabase.mjs';
export const literal = (v) => (v === null ? 'null' : "'" + String(v).replaceAll("'", "''") + "'");
const json = (v) => literal(JSON.stringify(v)) + '::jsonb';
export function visualFixtures(ref, org, identities, track, runQuery = query) {
  const sql = (s) => runQuery(ref, s);
  const pendingRequests = [];
  const flushRequests = () => {
    // Bound each CLI argument below Windows' process command-line limit.
    while (pendingRequests.length) {
      const chunk = pendingRequests.slice(0, 5);
      sql('begin;' + chunk.join('') + 'commit;');
      pendingRequests.splice(0, chunk.length);
    }
  };
  const command = (actor, expression) =>
    sql(
      `begin;set local role authenticated;set local request.jwt.claim.sub=${literal(identities[actor].id)};select ${expression} as result;commit;`,
    )[0].result;
  const sa = randomUUID(),
    eg = randomUUID(),
    region = randomUUID(),
    city = randomUUID(),
    service = randomUUID(),
    customer = randomUUID(),
    vehicleClass = randomUUID();
  track('catalogue', { sa, eg, region, city, service, customer, vehicleClass });
  function setup(financialFixtures = true) {
    sql(`begin;
      insert into public.organizations(id,name) values('${org}','Synthetic visual acceptance');
      ${Object.entries(identities)
        .map(
          ([role, user]) =>
            `insert into public.organization_memberships(organization_id,profile_id,member_type) values('${org}','${user.id}','${role === 'CUSTOMER' ? 'customer' : 'staff'}');insert into public.user_roles(organization_id,profile_id,role_id) select '${org}','${user.id}',id from public.roles where code='${role}';`,
        )
        .join('')}
      insert into public.markets(id,organization_id,country_code,name_ar,name_en,active,currency,timezone,phone_country_code) values('${sa}','${org}','SA','السعودية','Saudi Arabia',true,'SAR','Asia/Riyadh','+966'),('${eg}','${org}','EG','مصر','Egypt',true,'EGP','Africa/Cairo','+20');
      insert into public.market_regions(id,organization_id,market_id,code,name_ar,name_en,administrative_type) values('${region}','${org}','${sa}','test','منطقة الاختبار','Test region','region');
      insert into public.market_cities(id,organization_id,market_id,region_id,code,name_ar,name_en) values('${city}','${org}','${sa}','${region}','riyadh','الرياض','Riyadh');
      insert into public.services(id,organization_id,code,name_ar,name_en,active,property_required) values('${service}','${org}','furniture','نقل الأثاث والاحتياجات المنزلية','Furniture and household transport',true,true);
      insert into public.market_services(organization_id,market_id,service_id,active) values('${org}','${sa}','${service}',true);
      insert into public.service_areas(organization_id,market_id,service_id,city_id,active,pickup_eligible,delivery_eligible) values('${org}','${sa}','${service}','${city}',true,true,true);
      insert into public.vehicle_pricing_classes(id,organization_id,market_id,code,name_ar,name_en,active) values('${vehicleClass}','${org}','${sa}','test','شاحنة اختبار','Test truck',true);
      insert into public.pricing_settings(organization_id,market_id,currency,pricing_mode) values('${org}','${sa}','SAR','MANUAL');
      ${financialFixtures ? `insert into public.market_tax_versions(organization_id,market_id,code,version,rate_bps,label_ar,label_en,active,effective_from,configuration_kind) values('${org}','${sa}','test-vat',1,1500,'ضريبة اختبار','Test tax',true,now()-interval '1 day','STAGING_TEST');` : ''}
      insert into public.customers(id,organization_id,profile_id) values('${customer}','${org}','${identities.CUSTOMER.id}');
      ${financialFixtures ? `insert into public.bank_accounts(organization_id,market_id,currency,bank_name_ar,bank_name_en,beneficiary_ar,beneficiary_en,account_number,created_by) values('${org}','${sa}','SAR','بنك اختبار اصطناعي','Synthetic TEST bank','مستفيد اختبار','TEST BENEFICIARY','TEST-ONLY-VISUAL','${identities.SUPER_ADMIN.id}');` : ''}commit;`);
  }
  function request(label, n) {
    const id = randomUUID();
    track('request', { id, label });
    pendingRequests.push(`insert into public.requests(id,organization_id,customer_id,market_id,status,revision,service_id,reference,submitted_at,contact_name,contact_phone,contact_email,description,preferred_date,time_window) values('${id}','${org}','${customer}','${sa}','SUBMITTED',1,'${service}','N365-202610-${Date.now()}${String(n).padStart(2, '0')}',now(),'عميل اختبار للتأكد من وضوح العناوين الطويلة','+966500000001','synthetic@example.invalid','أثاث منزل تجريبي — بيانات اصطناعية للاختبار فقط',current_date+2,'flexible');
      insert into public.request_locations(request_id,organization_id,kind,city,city_id,district,address,floor,elevator) values('${id}','${org}','pickup','الرياض','${city}','حي اختبار','عنوان استلام اصطناعي طويل لاختبار التفاف النص ووضوح المسار على الهاتف',0,true),('${id}','${org}','delivery','الرياض','${city}','حي اختبار آخر','عنوان تسليم اصطناعي طويل لاختبار العربية والمسافات المنطقية',1,true);
      insert into public.request_items(request_id,organization_id,description,quantity,notes) values('${id}','${org}','أثاث تجريبي',2,'اختبار فقط');`);
    return id;
  }
  function draft(requestId, amount = 12345) {
    flushRequests();
    const id = randomUUID();
    track('quote', { id, requestId });
    command(
      'SALES',
      `public.create_manual_quote_draft('${requestId}',1,${amount},18.75,'TEST verified manual road distance',172800,'${id}')`,
    );
    return id;
  }
  const send = (id) => command('SALES', `public.send_quote('${id}')`);
  function respond(id, decision) {
    const result = command(
      'CUSTOMER',
      `public.respond_to_quote('${id}',${literal(decision)},${literal(randomUUID())},${decision === 'reject' ? literal('TEST customer decision') : 'null'})`,
    );
    if (result.order_id) track('order', { id: result.order_id });
    return result.order_id;
  }
  function pay(orderId, action, payload = {}, actor = 'CUSTOMER') {
    return command(
      actor,
      `public.payment_command('${orderId}',${literal(action)},'${randomUUID()}',coalesce((select revision from public.payments where order_id='${orderId}'),0),${json(payload)})`,
    );
  }
  function op(action, id, payload = {}) {
    const revision =
      action === 'create_trip'
        ? `(select revision from public.jobs where id='${id}')`
        : ['create_job', 'create_driver', 'create_vehicle'].includes(action)
          ? '0'
          : `coalesce((select revision from public.trips where id='${id}'),0)`;
    const result = command(
      'OPERATIONS',
      `public.operations_command('${org}',${literal(action)},'${id}',${revision},'${randomUUID()}',${json(payload)})`,
    );
    if (['create_job', 'create_trip', 'create_driver', 'create_vehicle'].includes(action))
      track(action, { id: result.id });
    return result.id;
  }
  async function proof(orderId, admin) {
    const buffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/wAAAABJRU5ErkJggg==',
      'base64',
    );
    const r = pay(orderId, 'reserve', {
      fileId: randomUUID(),
      mime: 'image/png',
      size: buffer.length,
    });
    track('storage', { bucket: 'documents', path: r.path });
    const upload = await admin.storage
      .from('documents')
      .upload(r.path, buffer, { contentType: 'image/png' });
    if (upload.error) throw Error('VISUAL_PROOF_UPLOAD_FAILED');
    pay(orderId, 'submit', { attemptId: r.attemptId });
    return r.attemptId;
  }
  function snapshot() {
    return sql(
      `select md5(coalesce(string_agg(v,'|' order by v),'')) as hash from (select 'grants:'||to_jsonb(rp)::text v from public.role_permissions rp union all select 'markets:'||to_jsonb(m)::text from public.markets m where organization_id<>'${org}' union all select 'pricing:'||to_jsonb(p)::text from public.pricing_settings p where organization_id<>'${org}' union all select 'banks:'||to_jsonb(b)::text from public.bank_accounts b where organization_id<>'${org}') s`,
    )[0].hash;
  }
  async function cleanup(admin, ledger) {
    if (!ledger.some((row) => row.kind === 'organization' && row.id === org))
      throw Error('OWNED_TENANT_LEDGER_REQUIRED');
    const owned = sql(`select name from public.organizations where id='${org}'`)[0];
    if (owned && owned.name !== 'Synthetic visual acceptance')
      throw Error('OWNED_TENANT_NAME_MISMATCH');
    for (const row of ledger.filter((x) => x.kind === 'storage')) {
      const r = await admin.storage.from(row.bucket).remove([row.path]);
      if (r.error) throw Error('VISUAL_STORAGE_CLEANUP_FAILED');
    }
    // No table outside this exact run-owned tenant is selected. Retry dependency
    // leaves in subtransactions; immutable fixture deletion uses the established gate.
    sql(`begin;set local app.fixture_cleanup='on';do $cleanup$ declare rec record;leftover integer;progress integer;begin
      for pass in 1..40 loop progress=0;
        for rec in select c.table_schema,c.table_name from information_schema.columns c join information_schema.tables bt on bt.table_schema=c.table_schema and bt.table_name=c.table_name and bt.table_type='BASE TABLE' where c.column_name='organization_id' and c.table_schema in ('public','private') and c.table_name not in ('organizations','market_tax_versions') loop
          begin execute format('delete from %I.%I where organization_id=$1',rec.table_schema,rec.table_name) using '${org}'::uuid;get diagnostics leftover=row_count;progress=progress+leftover;exception when foreign_key_violation then null;end;
        end loop;
        if progress=0 and exists(select 1 from public.market_tax_versions where organization_id='${org}') then
          if exists(select 1 from public.quote_versions where organization_id='${org}') or exists(select 1 from public.orders where organization_id='${org}') or exists(select 1 from public.pricing_evaluations where organization_id='${org}') then raise exception 'Synthetic tax still commercially referenced';end if;
          -- Operator-only, atomic cleanup: the exclusive table lock blocks other
          -- sessions throughout the temporary trigger pause. Restore the exact
          -- trigger before commit; a failure rolls back both DDL and deletion.
          -- No role/RLS/function definition or accepted tax record is changed.
          if exists(select 1 from public.market_tax_versions where organization_id='${org}' and (configuration_kind<>'STAGING_TEST' or code<>'test-vat')) then raise exception 'Not a run-owned synthetic tax version';end if;
          if (select tgenabled from pg_trigger where tgrelid='public.market_tax_versions'::regclass and tgname='tax_version_immutable')<>'O' then raise exception 'Unexpected tax guard baseline';end if;
          alter table public.market_tax_versions disable trigger tax_version_immutable;
          delete from public.market_tax_versions where organization_id='${org}' and configuration_kind='STAGING_TEST' and code='test-vat';
          alter table public.market_tax_versions enable trigger tax_version_immutable;progress=1;
        end if;
        exit when progress=0;
      end loop;
      for rec in select c.table_schema,c.table_name from information_schema.columns c join information_schema.tables bt on bt.table_schema=c.table_schema and bt.table_name=c.table_name and bt.table_type='BASE TABLE' where c.column_name='organization_id' and c.table_schema in ('public','private') and c.table_name<>'organizations' loop
        execute format('select count(*) from %I.%I where organization_id=$1',rec.table_schema,rec.table_name) into leftover using '${org}'::uuid;
        if leftover<>0 then raise exception 'Run-owned rows remain';end if;
      end loop;delete from public.organizations where id='${org}';end $cleanup$;commit;`);
    for (const user of Object.values(identities)) {
      const r = await admin.auth.admin.deleteUser(user.id);
      if (r.error) throw Error('VISUAL_AUTH_CLEANUP_FAILED');
    }
    const ids = Object.values(identities)
      .map((x) => literal(x.id))
      .join(',');
    const remaining = sql(
      `select (select count(*) from auth.users where id in (${ids}))::int as auth,(select count(*) from public.organizations where id='${org}')::int as organizations,(select count(*) from storage.objects where name like '${org}/%')::int as storage`,
    )[0];
    if (Object.values(remaining).some((x) => x !== 0)) throw Error('VISUAL_CLEANUP_NOT_ZERO');
    return remaining;
  }
  return {
    setup,
    request,
    draft,
    send,
    respond,
    pay,
    op,
    proof,
    snapshot,
    cleanup,
    sql,
    command,
    sa,
    eg,
    city,
    vehicleClass,
    customer,
  };
}
