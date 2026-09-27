-- Return invalid attempts normally so their rate-budget increment commits.
-- No bearer, IP address or fingerprint is retained in the budget.
alter table private.guest_rate_budgets drop constraint guest_rate_budgets_scope_check;
alter table private.guest_rate_budgets add constraint guest_rate_budgets_scope_check
 check(scope in ('create','mutation','upload','analytics','exchange'));
create function public.guest_exchange_attempt() returns jsonb
 language plpgsql security definer set search_path='' as $$
declare tenant uuid; g private.guest_access_grants;
begin
 select organization_id into tenant from private.customer_enrollment;
 if tenant is null then return jsonb_build_object('allowed',false,'limited',false); end if;
 begin
  perform private.consume_guest_budget(tenant,'exchange',tenant,300);
 exception when sqlstate 'PT429' then
  return jsonb_build_object('allowed',false,'limited',true);
 end;
 g=private.guest_context();
 if g.id is null or g.organization_id<>tenant then return jsonb_build_object('allowed',false,'limited',false); end if;
 return jsonb_build_object('allowed',true,'limited',false,'requestId',g.request_id,'expiresAt',g.expires_at);
end $$;
revoke all on function public.guest_exchange_attempt() from public,anon,authenticated;
grant execute on function public.guest_exchange_attempt() to anon;
