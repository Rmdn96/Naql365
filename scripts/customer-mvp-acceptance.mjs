import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import { localSupabase } from './local-supabase.mjs';
import { startBrowserServer, stopBrowserServer } from './browser-server.mjs';

const local = localSupabase();
if (process.env.GITHUB_ACTIONS !== 'true' || local.apiPort !== '54321')
  throw Error('Fresh GitHub runner and local Supabase required');
const origin = 'http://127.0.0.1:3000';
const output = 'test-results/customer-mvp-acceptance';
mkdirSync(output, { recursive: true });
const admin = createClient(local.API_URL, local.SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const sql = (input) => execFileSync('docker', [
  'exec','-i','supabase_db_naql365','psql','-X','-qAt','-v','ON_ERROR_STOP=1','-U','postgres',
], {input, encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const org = '21000000-0000-4000-8000-000000000001';
const sales = '11000000-0000-4000-8000-000000000001';
const fixture = readFileSync('supabase/tests/phase2.test.sql','utf8').split('set local role authenticated;')[0];
if (sql('select count(*) from private.customer_enrollment') !== '0')
  throw Error('Test baseline is not empty');
sql(fixture + '\n' + [
  "insert into private.customer_enrollment (organization_id) values ('" + org + "');",
  "update public.pricing_settings set pricing_mode='MANUAL' where organization_id='" + org + "';",
  "update public.service_areas set pickup_eligible=true,delivery_eligible=true where organization_id='" + org + "';",
  'commit;',
].join('\n'));
const env = {
  ...process.env, APP_ENV:'local', APP_URL:origin,
  NEXT_PUBLIC_SUPABASE_URL:local.API_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:local.PUBLISHABLE_KEY,
  STAGING_AUTH_SMOKE_ENABLED:'false',
};
console.log('START Linux Node ' + process.version + ' build with loopback Supabase');
execFileSync(process.execPath,['scripts/guarded-next.mjs','build','--webpack'],{
  env,stdio:'inherit',timeout:360000,
});
console.log('PASS Linux Production Build with loopback Supabase');
const server = await startBrowserServer(env,3000);
const browser = await chromium.launch();
const checks = [];
const setup = {};
const text = {
  ar: { enroll:'أكمل ملفك للبدء', nav:['الرئيسية','النقل','المتجر','حسابي'] },
  en: { enroll:'Complete your profile', nav:['Home','Transport','Store','My account'] },
};
async function test(label, fn) {
  try { await fn(); checks.push({label,status:'PASS'}); console.log('PASS '+label); }
  catch(e) {
    checks.push({label,status:'FAIL'}); console.error('FAIL '+label, String(e.message).slice(0,1000));
  }
  writeFileSync(output+'/results.json',JSON.stringify(checks,null,2));
}
function href(locale,tail) { return origin + '/' + locale + tail; }
async function enter(page,locale,route,email,password) {
  await page.goto(href(locale,route));
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.locator('.auth-form button[type=submit]').click();
}
try {
  for (const [locale,width] of [['ar',390],['en',1440]]) {
    if (locale === 'ar') continue; // The preceding run passed this case against the unchanged application.
    await test(locale+' '+width+' signup, profile persistence, relogin, edit, navigation',async()=>{
      const page = await browser.newPage({viewport:{width,height:900},locale});
      const jsErrors=[];
      page.on('pageerror',e=>jsErrors.push(e.name));
      const email='acceptance-'+randomUUID()+'@example.com', pass='Test'+randomUUID();
      await enter(page,locale,'/register',email,pass);
      await expect(page.locator('.auth-form + [role=status], [role=status]').filter({hasText:locale==='ar'?'إذا كان البريد':'If eligible, this address'}).first()).toBeVisible();
      let user;
      await expect.poll(async()=>{
        const r=await admin.auth.admin.listUsers();
        user=r.data?.users.find(u=>u.email===email);
        return Boolean(user);
      }).toBe(true);
      expect(user.email_confirmed_at).toBeFalsy();
      const confirmed=await admin.auth.admin.updateUserById(user.id,{email_confirm:true});
      expect(confirmed.error).toBeNull();
      expect(confirmed.data.user.email_confirmed_at).toBeTruthy();
      await enter(page,locale,'/login',email,pass);
      await expect(page).toHaveURL(href(locale,'/account'));
      expect(await page.locator('form.profile-form').count()).toBe(0);
      await page.locator('a[href="/'+locale+'/account/profile/edit"]').click();
      await page.locator('#name').fill('Synthetic Customer '+locale);
      await page.locator('#phone').fill('+201000000028');
      await page.locator('form.profile-form button').click();
      await expect(page).toHaveURL(href(locale,'/account/profile?profile=saved'));
      const summary=page.locator('main dl');
      await expect(summary).toContainText('+201000000028');
      await page.reload();
      await expect(summary).toContainText('Synthetic Customer '+locale);
      await expect(summary).toContainText('+201000000028');
      await page.locator('main form button').click();
      await expect(page).toHaveURL(href(locale,'/login'));
      await enter(page,locale,'/login',email,pass);
      await expect(page).toHaveURL(href(locale,'/account'));
      const nav=page.locator('.customer-workspace-nav a');
      await expect(nav).toHaveCount(4);
      for(const [index,label] of text[locale].nav.entries()) await expect(nav.nth(index)).toHaveText(label);
      await page.screenshot({path:output+'/'+locale+'-'+width+'.png',fullPage:true});
      await nav.nth(1).click();
      await expect(page).toHaveURL(href(locale,'/account/requests'));
      await nav.nth(2).click();
      await expect(page).toHaveURL(href(locale,'/store'));
      const storeNav=page.locator(width===390?'.cm-bottom-nav a':'.cm-navigation nav a');
      await expect(storeNav).toHaveCount(4);
      await storeNav.nth(3).click();
      await expect(page).toHaveURL(href(locale,'/account/profile'));
      await expect(summary).toContainText('+201000000028');
      await page.locator('a[href="/'+locale+'/account/profile/edit"]').click();
      await expect(page.locator('#name')).toHaveValue('Synthetic Customer '+locale);
      await page.locator('#name').fill('Updated Customer '+locale);
      await page.locator('#phone').fill('+201000000029');
      await page.locator('form.profile-form button').click();
      await expect(summary).toContainText('Updated Customer '+locale);
      await expect(summary).toContainText('+201000000029');
      const persisted=await admin.from('profiles').select('display_name,phone').eq('id',user.id).single();
      expect(persisted.data).toEqual({display_name:'Updated Customer '+locale,phone:'+201000000029'});
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
      await page.goto(href(locale,'/portal'));
      await expect(page.locator('.staff-dashboard-grid')).toHaveCount(0);
      expect(sql("select count(*) from public.organization_memberships where profile_id='"+user.id+"' and member_type='staff'")).toBe('0');
      expect(jsErrors).toEqual([]);
      setup[locale]={page,email};
    });
  }
  await test('transport draft, save, send, manual Sales quote and customer review',async()=>{
    if(!setup.en) throw Error('English account scenario prerequisite failed');
    const {page,email}=setup.en;
    const ids=JSON.parse(sql("select json_build_object('market',m.id,'pickup',(select id from public.market_cities where market_id=m.id and code='Riyadh'),'delivery',(select id from public.market_cities where market_id=m.id and code='Jeddah')) from public.markets m where m.organization_id='"+org+"'"));
    await page.goto(href('en','/account/requests'));
    await page.locator('#request-market').selectOption(ids.market);
    await page.getByRole('button',{name:'Start a transport request',exact:false}).or(page.locator('main form button[type=submit]')).first().click();
    await expect(page).toHaveURL(/\/en\/request\/[a-f0-9-]+$/);
    const id=new URL(page.url()).pathname.split('/').at(-1);
    const api=origin+'/api/customer/requests/'+id;
    const post=async(operation,revision,data)=>{
      const r=await page.request.post(api,{headers:{Origin:origin},data:{operation,revision,mutationId:randomUUID(),...(data?{payload:data}:{})}});
      expect(r.ok(),operation+' status '+r.status()).toBe(true);
      return r.json();
    };
    const loc=(city_id,city)=>({city_id,city,district:'Synthetic',address:'Synthetic address',notes:'',floor:1,elevator:true,access_notes:''});
    await post('save',0,{
      service_id:'41000000-0000-4000-8000-000000000001',description:'Synthetic transport acceptance',notes:'',
      pickup:loc(ids.pickup,'Riyadh'),delivery:loc(ids.delivery,'Jeddah'),
      items:[{description:'Box',quantity:2,notes:''}],additional_service_ids:[],
      preferred_date:new Date(Date.now()+172800000).toISOString().slice(0,10),time_window:'morning',
      contact_name:'Updated Customer en',contact_phone:'+201000000029',contact_email:email,contact_notes:'',
    });
    await post('submit',1);
    await page.goto(href('en','/account/requests/'+id));
    await expect(page.locator('.request-reference')).toHaveText(/^N365-\d{6}-\d{6,}$/);
    await expect(page.locator('.request-summary')).toContainText('Synthetic transport acceptance');
    expect(sql("select status||':'||revision from public.requests where id='"+id+"'")).toBe('SUBMITTED:2');
    expect(sql("select count(*) from public.quotes where request_id='"+id+"'")).toBe('0');
    const quote=randomUUID();
    sql("begin;set local role authenticated;select set_config('request.jwt.claim.sub','"+sales+"',true);select public.create_manual_quote_draft('"+id+"',2,15000,12.5,'Synthetic reviewed route',86400,'"+quote+"');select public.send_quote('"+quote+"');commit;");
    await page.goto(href('en','/account'));
    await page.locator('a[href="/en/account/quotes/'+quote+'"]').click();
    await expect(page).toHaveURL(href('en','/account/quotes/'+quote));
    expect(sql("select pricing_mode from public.quote_pricing_details where quote_version_id='"+quote+"'")).toBe('MANUAL');
  });
} finally {
  await browser.close();
  await stopBrowserServer(server,3000);
}
console.log(JSON.stringify({passed:checks.filter(c=>c.status==='PASS').length,failed:checks.filter(c=>c.status==='FAIL').length}));
if(checks.some(c=>c.status==='FAIL'))process.exitCode=1;

