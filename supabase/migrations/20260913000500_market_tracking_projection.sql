create or replace function public.customer_order_progress(p_order_id uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare o public.orders; result jsonb;
begin
 select * into o from public.orders where id=p_order_id;
 if not found or not private.owns_customer(o.organization_id,o.customer_id) or not private.has_permission(o.organization_id,'account.access')
 then raise exception 'Order unavailable' using errcode='42501'; end if;
 select jsonb_build_object('id',o.id,'reference',o.reference,'status',o.operational_status,'completedAt',o.operational_completed_at,'market', (select jsonb_build_object('countryCode',m.country_code,'nameAr',m.name_ar,'nameEn',m.name_en,'currency',o.currency,'timezone',m.timezone) from public.markets m where m.id=o.market_id),
 'trips',coalesce((select jsonb_agg(jsonb_build_object('reference',t.reference,'status',t.status,
 'totalStops',(select count(*) from public.trip_stops s where s.trip_id=t.id),
 'completedStops',(select count(*) from public.trip_stops s where s.trip_id=t.id and s.status='COMPLETED'),
 'podCaptured',exists(select 1 from public.trip_pods p where p.trip_id=t.id and p.state='FINAL')) order by t.created_at,t.id)
 from public.trips t join public.jobs j on j.id=t.job_id where j.order_id=o.id),'[]'::jsonb)) into result;
 return result;
end $$;
revoke all on function public.customer_order_progress(uuid) from public,anon,authenticated;
grant execute on function public.customer_order_progress(uuid) to authenticated;

