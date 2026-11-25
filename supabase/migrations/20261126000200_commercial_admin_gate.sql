-- Activation is separate so the owner can prove access before enabling the Auth and API gates.
create function private.is_commercial_admin(user_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.organization_memberships m
    join public.user_roles ur on (ur.organization_id, ur.profile_id) = (m.organization_id, m.profile_id)
    join public.roles r on r.id = ur.role_id
    where m.profile_id = user_id and m.status = 'active' and m.member_type = 'staff'
      and r.code = 'SUPER_ADMIN' and r.member_type = 'staff'
  )
$$;
revoke all on function private.is_commercial_admin(uuid) from public, anon, authenticated;

create function public.commercial_admin_session() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.is_commercial_admin(auth.uid())
$$;
revoke all on function public.commercial_admin_session() from public, anon;
grant execute on function public.commercial_admin_session() to authenticated;

create function private.commercial_auth_token_hook(event jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  select case when private.is_commercial_admin((event->>'user_id')::uuid)
    then jsonb_build_object('claims', event->'claims')
    else jsonb_build_object('error', jsonb_build_object('http_code', 403, 'message', 'Sign-in unavailable')) end
$$;
revoke all on function private.commercial_auth_token_hook(jsonb) from public, anon, authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.commercial_auth_token_hook(jsonb) to supabase_auth_admin;

create function public.commercial_api_session_gate() returns void
language plpgsql stable security definer set search_path = '' as $$
begin
  if auth.role() = 'authenticated' and not private.is_commercial_admin(auth.uid()) then
    raise exception 'Session unavailable' using errcode = '42501';
  end if;
end
$$;
revoke all on function public.commercial_api_session_gate() from public;
grant execute on function public.commercial_api_session_gate() to anon, authenticated, service_role;
