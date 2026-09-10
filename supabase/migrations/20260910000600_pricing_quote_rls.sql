-- Phase 2 minimum grants and tenant/customer visibility.
insert into public.permissions(code) values('pricing.calculate'),('quotes.manage') on conflict(code) do nothing;
insert into public.role_permissions(role_id,permission_id)
 select r.id,p.id from public.roles r cross join public.permissions p
 where r.code in ('SUPER_ADMIN','SALES') and p.code in ('pricing.calculate','quotes.manage') on conflict do nothing;
alter table public.vehicle_pricing_classes enable row level security;
alter table public.pricing_settings enable row level security;
alter table public.pricing_rules enable row level security;
alter table public.distance_snapshots enable row level security;
alter table public.pricing_evaluations enable row level security;
alter table public.pricing_evaluation_components enable row level security;
alter table public.quote_pricing_details enable row level security;
revoke all on public.vehicle_pricing_classes,public.pricing_settings,public.pricing_rules,public.distance_snapshots,public.pricing_evaluations,public.pricing_evaluation_components,public.quote_pricing_details from anon,authenticated;
grant select on public.vehicle_pricing_classes to authenticated;
grant select on public.distance_snapshots,public.pricing_evaluations,public.pricing_evaluation_components,public.quote_pricing_details to authenticated;
create policy distance_snapshots_sales_read on public.distance_snapshots for select to authenticated using(private.has_permission(organization_id,'pricing.calculate'));
create policy vehicle_pricing_sales_read on public.vehicle_pricing_classes for select to authenticated using(private.has_permission(organization_id,'pricing.calculate'));
create policy pricing_evaluations_sales_read on public.pricing_evaluations for select to authenticated using(private.has_permission(organization_id,'pricing.calculate'));
create policy pricing_components_sales_read on public.pricing_evaluation_components for select to authenticated using(private.has_permission(organization_id,'pricing.calculate'));
create policy quote_pricing_sales_read on public.quote_pricing_details for select to authenticated using(private.has_permission(organization_id,'quotes.manage'));

drop policy quotes_staff_read on public.quotes;
drop policy quote_versions_staff_read on public.quote_versions;
drop policy quote_items_staff_read on public.quote_items;
drop policy orders_staff_read on public.orders;
create function private.owns_quote(tenant uuid, quote_id_value uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.quotes q where q.organization_id=tenant and q.id=quote_id_value and private.owns_request(tenant,q.request_id))
$$;
create function private.customer_can_read_quote(tenant uuid, quote_id_value uuid) returns boolean language sql stable security definer set search_path='' as $$
 select private.owns_quote(tenant,quote_id_value) and exists(select 1 from public.quote_versions v where v.organization_id=tenant and v.quote_id=quote_id_value and v.status<>'DRAFT')
$$;
create function private.customer_can_read_quote_version(tenant uuid, version_id_value uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.quote_versions v where v.organization_id=tenant and v.id=version_id_value and v.status<>'DRAFT' and private.owns_quote(tenant,v.quote_id))
$$;
revoke all on function private.owns_quote(uuid,uuid),private.customer_can_read_quote(uuid,uuid),private.customer_can_read_quote_version(uuid,uuid) from public;
grant execute on function private.owns_quote(uuid,uuid),private.customer_can_read_quote(uuid,uuid),private.customer_can_read_quote_version(uuid,uuid) to authenticated;
create policy quotes_read on public.quotes for select to authenticated using(private.has_permission(organization_id,'quotes.read') or private.customer_can_read_quote(organization_id,id));
create policy quote_versions_read on public.quote_versions for select to authenticated using(private.has_permission(organization_id,'quotes.read') or (status<>'DRAFT' and private.owns_quote(organization_id,quote_id)));
create policy quote_items_read on public.quote_items for select to authenticated using(private.has_permission(organization_id,'quotes.read') or private.customer_can_read_quote_version(organization_id,quote_version_id));
create policy orders_read on public.orders for select to authenticated using(private.has_permission(organization_id,'orders.read') or (customer_id is not null and private.owns_customer(organization_id,customer_id)));

create trigger vehicle_pricing_classes_updated_at before update on public.vehicle_pricing_classes for each row execute function private.touch_updated_at();
create trigger pricing_settings_updated_at before update on public.pricing_settings for each row execute function private.touch_updated_at();
create trigger pricing_rules_updated_at before update on public.pricing_rules for each row execute function private.touch_updated_at();
create or replace function private.audit_change() returns trigger language plpgsql security definer set search_path = '' as $$
declare old_row jsonb; new_row jsonb; row_data jsonb;
begin
 if tg_op <> 'INSERT' then old_row=to_jsonb(old); end if;
 if tg_op <> 'DELETE' then new_row=to_jsonb(new); end if;
 row_data=coalesce(new_row,old_row);
 insert into public.audit_logs(organization_id,actor_id,action,entity_type,entity_id,before_data,after_data)
 values((row_data->>'organization_id')::uuid,auth.uid(),lower(tg_op),tg_table_name,
 coalesce(row_data->>'id',row_data->>'quote_version_id',row_data->>'profile_id',row_data->>'role_id')::uuid,old_row,new_row);
 return coalesce(new,old);
end $$;
create trigger pricing_rules_audit after insert or update or delete on public.pricing_rules for each row execute function private.audit_change();
create trigger quote_pricing_details_audit after insert or update or delete on public.quote_pricing_details for each row execute function private.audit_change();

create function private.protect_distance_snapshot() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Distance snapshots are immutable' using errcode='55000'; end $$;
revoke all on function private.protect_distance_snapshot() from public,anon,authenticated;
create trigger distance_snapshot_immutable before update or delete on public.distance_snapshots for each row execute function private.protect_distance_snapshot();

create function private.protect_pricing_component() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'Pricing components are immutable' using errcode='55000'; end $$;
revoke all on function private.protect_pricing_component() from public,anon,authenticated;
create trigger pricing_component_immutable before update or delete on public.pricing_evaluation_components for each row execute function private.protect_pricing_component();

create function private.protect_quote_version() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status<>'DRAFT' and (
  new.organization_id<>old.organization_id or new.quote_id<>old.quote_id or new.version<>old.version or
  new.currency<>old.currency or
  new.distance_km is distinct from old.distance_km or new.distance_source is distinct from old.distance_source or new.distance_verified_at is distinct from old.distance_verified_at or
  new.final_subtotal_minor<>old.final_subtotal_minor or
  new.vat_rate_bps<>old.vat_rate_bps or new.vat_amount_minor<>old.vat_amount_minor or new.total_minor<>old.total_minor or
  new.validity_seconds<>old.validity_seconds or new.expires_at is distinct from old.expires_at or new.sent_at is distinct from old.sent_at
 ) then raise exception 'Sent quote terms are immutable' using errcode='55000'; end if;
 if old.status in ('ACCEPTED','REJECTED','EXPIRED','SUPERSEDED') and new.status<>old.status then raise exception 'Terminal quote state is immutable' using errcode='55000'; end if;
 return new;
end $$;
revoke all on function private.protect_quote_version() from public,anon,authenticated;
create trigger quote_version_immutable before update on public.quote_versions for each row execute function private.protect_quote_version();

create function private.protect_quote_item() returns trigger language plpgsql set search_path='' as $$
declare version_status text;
begin
 select status into version_status from public.quote_versions where id=coalesce(new.quote_version_id,old.quote_version_id);
 if version_status is distinct from 'DRAFT' then raise exception 'Sent quote items are immutable' using errcode='55000'; end if;
 return coalesce(new,old);
end $$;
revoke all on function private.protect_quote_item() from public,anon,authenticated;
create trigger quote_item_immutable before insert or update or delete on public.quote_items for each row execute function private.protect_quote_item();
create trigger quote_pricing_detail_immutable before update or delete on public.quote_pricing_details for each row execute function private.protect_quote_item();
