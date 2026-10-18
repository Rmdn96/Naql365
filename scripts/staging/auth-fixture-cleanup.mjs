// Operator-only fixture tooling. No application import or runtime authority.
export function authFixtureCleanupSql(org, users) {
  if (
    !/^[a-f0-9-]{36}$/.test(org) ||
    !Array.isArray(users) ||
    users.length < 1 ||
    users.length > 8 ||
    users.some((id) => !/^[a-f0-9-]{36}$/.test(id))
  )
    throw Error('FIXTURE_LEDGER_DENIED');
  const ids = `array[${users.map((id) => `'${id}'::uuid`).join(',')}]::uuid[]`;
  return `begin;
do $$ declare owned_customers uuid[]; begin
select coalesce(array_agg(id),array[]::uuid[]) into owned_customers from public.customers where organization_id='${org}' or profile_id=any(${ids});
delete from public.drivers where organization_id='${org}';
delete from public.customers where organization_id='${org}' or profile_id=any(${ids});
delete from public.user_roles where organization_id='${org}' or profile_id=any(${ids});
delete from public.organization_memberships where organization_id='${org}' or profile_id=any(${ids});
delete from public.markets where organization_id='${org}';
delete from public.audit_logs where organization_id='${org}' or actor_id=any(${ids}) or (entity_type='customers' and entity_id=any(owned_customers)) or (entity_type in ('organization_memberships','user_roles') and entity_id=any(${ids}));
delete from public.organizations where id='${org}';
end $$;
commit;`;
}
