-- Reuse existing notification ownership and operational event truth.
alter table public.notifications
 add column trip_id uuid references public.trips(id) on delete cascade,
 add column market_id uuid references public.markets(id),
 add column event_code text check(event_code in ('TRIP_STARTED','TRIP_COMPLETED','TRIP_REASSIGNED','ISSUE_REPORTED')),
 add column audience text check(audience in ('CUSTOMER','STAFF')),
 add column read_at timestamptz,
 add constraint notification_execution_facts check(event_code is null or (trip_id is not null and market_id is not null and audience is not null));
create index notifications_recent on public.notifications(recipient_profile_id,created_at desc,id);
drop policy notifications_self on public.notifications;
create policy notifications_self on public.notifications for select to authenticated using(recipient_profile_id=(select auth.uid()) and private.is_member(organization_id)
 and (audience is null or (audience='CUSTOMER' and private.has_permission(organization_id,'account.access'))
 or (audience='STAFF' and (private.has_permission(organization_id,'operations.manage') or private.has_permission(organization_id,'dispatch.manage')))));
create function private.notify_execution() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.trips; code text;
begin
 code=case new.event_type when 'DISPATCH' then 'TRIP_STARTED' when 'COMPLETE_TRIP' then 'TRIP_COMPLETED' when 'REASSIGN' then 'TRIP_REASSIGNED' when 'ISSUE_REPORTED' then 'ISSUE_REPORTED' end;
 if code is null then return new; end if;
 select * into t from public.trips where id=new.trip_id;
 if code in ('TRIP_STARTED','TRIP_COMPLETED') then
  insert into public.notifications(organization_id,recipient_profile_id,idempotency_key,trip_id,market_id,event_code,audience)
  select t.organization_id,c.profile_id,new.id::text||':'||c.profile_id::text,t.id,t.market_id,code,'CUSTOMER'
  from public.jobs j join public.orders o on o.id=j.order_id join public.customers c on c.id=o.customer_id
  join public.organization_memberships m on m.organization_id=t.organization_id and m.profile_id=c.profile_id and m.status='active'
  where j.id=t.job_id on conflict(organization_id,idempotency_key) do nothing;
 end if;
 if code in ('TRIP_COMPLETED','TRIP_REASSIGNED','ISSUE_REPORTED') then
  insert into public.notifications(organization_id,recipient_profile_id,idempotency_key,trip_id,market_id,event_code,audience)
  select t.organization_id,m.profile_id,new.id::text||':'||m.profile_id::text,t.id,t.market_id,code,'STAFF'
  from public.organization_memberships m where m.organization_id=t.organization_id and m.status='active' and m.member_type='staff'
  and exists(select 1 from public.user_roles ur join public.role_permissions rp on rp.role_id=ur.role_id join public.permissions p on p.id=rp.permission_id
   where ur.organization_id=t.organization_id and ur.profile_id=m.profile_id and p.code in ('operations.manage','dispatch.manage'))
  on conflict(organization_id,idempotency_key) do nothing;
 end if;
 return new;
end $$;
revoke all on function private.notify_execution() from public,anon,authenticated;
create trigger notify_execution after insert on public.trip_events for each row execute function private.notify_execution();

create function public.read_notification(p_notification uuid) returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.notifications set read_at=coalesce(read_at,clock_timestamp()) where id=p_notification;
 if not found then raise exception 'Notification unavailable' using errcode='42501'; end if;
end $$;
-- Only read_at can be changed by the recipient. All facts remain server-owned.
grant update(read_at) on public.notifications to authenticated;
create policy notification_mark_read on public.notifications for update to authenticated using(recipient_profile_id=(select auth.uid()) and private.is_member(organization_id)) with check(recipient_profile_id=(select auth.uid()) and private.is_member(organization_id));
revoke all on function public.read_notification(uuid) from public,anon,authenticated;
grant execute on function public.read_notification(uuid) to authenticated;

create function public.tracking_policy() returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('movingSeconds',moving_seconds,'stationarySeconds',stationary_seconds,'staleSeconds',stale_seconds,'movementM',movement_m,'speedMps',speed_mps,'maxAgeSeconds',max_age_seconds,'futureSeconds',future_seconds)
 from private.tracking_configuration where singleton and auth.uid() is not null
$$;
create function public.tracking_feed(p_order uuid default null,p_market uuid default null,p_trip uuid default null,p_driver uuid default null,p_offset integer default 0) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 if p_offset is null or p_offset<0 or p_offset>10000 then raise exception 'Invalid page' using errcode='22023'; end if;
 if p_order is not null and not exists(select 1 from public.orders o where o.id=p_order and private.owns_customer(o.organization_id,o.customer_id) and private.has_permission(o.organization_id,'account.access')) then raise exception 'Order unavailable' using errcode='42501'; end if;
 if p_order is null and p_trip is null and not exists(select 1 from public.organization_memberships m where m.profile_id=auth.uid() and (private.has_permission(m.organization_id,'operations.manage') or private.has_permission(m.organization_id,'dispatch.manage'))) then raise exception 'Operations required' using errcode='42501'; end if;
 if p_trip is not null and not private.tracking_reader(p_trip) then raise exception 'Trip unavailable' using errcode='42501'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'reference',x.reference,'status',x.status,'active',private.tracking_active(x.id),
 'market',jsonb_build_object('id',m.id,'countryCode',m.country_code,'timezone',m.timezone),
 'nextStop',(select jsonb_build_object('kind',s.kind,'position',s.position) from public.trip_stops s where s.trip_id=x.id and s.status<>'COMPLETED' order by s.position limit 1),
 'location',case when private.tracking_active(x.id) and l.latitude is not null then jsonb_build_object('latitude',l.latitude,'longitude',l.longitude,'accuracy',l.accuracy_m,'capturedAt',l.captured_at,'receivedAt',l.received_at) else null end,
 'eta',jsonb_build_object('status','UNAVAILABLE','reason','PROVIDER_NOT_CONFIGURED')) order by x.created_at desc,x.id),'[]'::jsonb) into result
 from (select t.* from public.trips t join public.jobs j on j.id=t.job_id
 where private.tracking_reader(t.id) and (p_order is null or j.order_id=p_order) and (p_market is null or t.market_id=p_market) and (p_trip is null or t.id=p_trip)
 and (p_driver is null or (private.has_permission(t.organization_id,'operations.manage') or private.has_permission(t.organization_id,'dispatch.manage')) and exists(select 1 from public.assignments a where a.trip_id=t.id and a.driver_id=p_driver and a.ended_at is null))
 and (p_order is not null or p_trip is not null or private.tracking_active(t.id))
 order by t.created_at desc,t.id limit 50 offset p_offset) x join public.markets m on m.id=x.market_id left join public.trip_live_locations l on l.trip_id=x.id;
 return result;
end $$;
revoke all on function public.tracking_policy(),public.tracking_feed(uuid,uuid,uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.tracking_policy(),public.tracking_feed(uuid,uuid,uuid,uuid,integer) to authenticated;

-- Postgres Changes rechecks each subscriber's RLS. Only INSERT/UPDATE are published:
-- DELETE delivery cannot be used as an authorization boundary. History stays private.
do $$ begin
 if not exists(select 1 from pg_publication where pubname='supabase_realtime') then
  create publication supabase_realtime with(publish='insert,update');
 end if;
 if exists(select 1 from pg_publication_tables where pubname='supabase_realtime') then raise exception 'Review existing Realtime publication before changing its operations'; end if;
 alter publication supabase_realtime set(publish='insert,update');
 alter publication supabase_realtime add table public.trip_live_locations,public.notifications;
end $$;
