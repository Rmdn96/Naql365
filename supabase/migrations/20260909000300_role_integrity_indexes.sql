-- Complete reverse role lookup indexes; tenant table relationship indexes are in migration 001.
create index user_roles_role_idx on public.user_roles(role_id);
create index role_permissions_permission_idx on public.role_permissions(permission_id);
create index audit_logs_actor_idx on public.audit_logs(actor_id);

-- A customer/driver record must reference the corresponding membership category.
create function private.validate_person_membership() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.organization_memberships m
    where m.organization_id = new.organization_id and m.profile_id = new.profile_id
      and m.member_type = case when tg_table_name = 'customers' then 'customer' else 'driver' end
  ) then
    raise exception 'Record does not match membership type' using errcode = '23514';
  end if;
  return new;
end $$;
revoke all on function private.validate_person_membership() from public;
create trigger customers_membership_type before insert or update on public.customers
  for each row execute function private.validate_person_membership();
create trigger drivers_membership_type before insert or update on public.drivers
  for each row execute function private.validate_person_membership();

create function private.preserve_membership_type() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.member_type <> old.member_type and (
    exists(select 1 from public.customers c where c.organization_id=old.organization_id and c.profile_id=old.profile_id)
    or exists(select 1 from public.drivers d where d.organization_id=old.organization_id and d.profile_id=old.profile_id)
    or exists(select 1 from public.user_roles r where r.organization_id=old.organization_id and r.profile_id=old.profile_id)
  ) then
    raise exception 'Remove incompatible roles and dependent identity records before changing membership type' using errcode='23514';
  end if;
  return new;
end $$;
revoke all on function private.preserve_membership_type() from public;
create trigger preserve_membership_type before update on public.organization_memberships
  for each row execute function private.preserve_membership_type();
