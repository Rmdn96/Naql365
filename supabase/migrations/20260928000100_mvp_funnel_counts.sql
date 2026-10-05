-- Anonymous, approximate funnel counters. Never authorization, billing, or audit evidence.
-- No identities, URLs, IPs, tokens, contact details or location are accepted/stored.
create table private.mvp_funnel_counts (
 organization_id uuid not null references public.organizations(id),
 day date not null,
 country text not null check(country in ('SA','EG')),
 event text not null check(event in ('homepage_viewed','request_started','request_completed','preliminary_quote_viewed','final_quote_viewed','quote_accepted','quote_rejected','payment_method_selected','transfer_proof_submitted','tracking_viewed','whatsapp_clicked')),
 context text not null check(context in ('home','request','quote','checkout','tracking')),
 count bigint not null check(count>0),
 primary key(organization_id,day,country,event,context)
);
alter table private.mvp_funnel_counts enable row level security;
revoke all on private.mvp_funnel_counts from public,anon,authenticated;
create function public.record_mvp_event(p_event text,p_country text,p_context text) returns void
language plpgsql security definer set search_path='' as $$
declare org uuid;
begin
 if p_event is null or p_event not in ('homepage_viewed','request_started','request_completed','preliminary_quote_viewed','final_quote_viewed','quote_accepted','quote_rejected','payment_method_selected','transfer_proof_submitted','tracking_viewed','whatsapp_clicked')
 or p_country is null or p_country not in ('SA','EG') or p_context is null or p_context not in ('home','request','quote','checkout','tracking')
 then raise exception 'Unsupported metric' using errcode='22023'; end if;
 select e.organization_id into org from private.customer_enrollment e join public.markets m on m.organization_id=e.organization_id and m.country_code=p_country and m.active;
 if org is null then return; end if;
 perform private.consume_guest_budget(org,'analytics',org,600);
 insert into private.mvp_funnel_counts values(org,(clock_timestamp() at time zone 'UTC')::date,p_country,p_event,p_context,1)
 on conflict(organization_id,day,country,event,context) do update set count=mvp_funnel_counts.count+1;
 delete from private.mvp_funnel_counts where organization_id=org and day<(clock_timestamp() at time zone 'UTC')::date-90;
end $$;
revoke all on function public.record_mvp_event(text,text,text) from public,anon,authenticated;
grant execute on function public.record_mvp_event(text,text,text) to anon,authenticated;
