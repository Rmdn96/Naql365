-- Preserve new tax provenance as strictly as existing sent currency/distance/amount facts.
create function private.freeze_sent_tax() returns trigger language plpgsql set search_path='' as $$
begin
 if old.status<>'DRAFT' and (new.tax_version_id,new.tax_code,new.tax_label_ar,new.tax_label_en) is distinct from
 (old.tax_version_id,old.tax_code,old.tax_label_ar,old.tax_label_en)
 then raise exception 'Sent tax snapshot is immutable' using errcode='55000'; end if;
 return new;
end $$;
revoke all on function private.freeze_sent_tax() from public,anon,authenticated;
create trigger sent_tax_immutable before update on public.quote_versions for each row execute function private.freeze_sent_tax();

-- Quote currency is explicit even before a version is sent; it always derives from Request market.
alter table public.quotes add column currency text;
alter table public.quotes disable trigger quotes_updated_at;
alter table public.quotes disable trigger quotes_audit;
update public.quotes q set currency=m.currency from public.markets m where m.id=q.market_id;
alter table public.quotes enable trigger quotes_updated_at;
alter table public.quotes enable trigger quotes_audit;
alter table public.quotes alter column currency set not null,
 add foreign key(organization_id,market_id,currency) references public.markets(organization_id,id,currency);
create function private.derive_quote_currency() returns trigger language plpgsql security definer set search_path='' as $$
declare expected text;
begin
 select m.currency into expected from public.requests r join public.markets m on m.id=r.market_id where r.id=new.request_id and r.organization_id=new.organization_id;
 if new.currency is null then new.currency=expected; end if;
 if new.currency is distinct from expected then raise exception 'Quote currency differs from market' using errcode='23514'; end if;
 return new;
end $$;
revoke all on function private.derive_quote_currency() from public,anon,authenticated;
create trigger b_quote_currency before insert or update on public.quotes for each row execute function private.derive_quote_currency();

-- Versioned tax table is the single configuration authority. Existing rate values were
-- copied by the foundation migration; sent/accepted rate and money fields are untouched.
alter table public.pricing_settings drop column vat_rate_bps;

-- Existing service-area relation now supplies explicitly activated domestic coverage.
grant insert,update,delete on public.service_areas to authenticated;
create policy service_area_admin on public.service_areas for all to authenticated
 using(private.has_permission(organization_id,'markets.manage')) with check(private.has_permission(organization_id,'markets.manage'));
create policy service_area_customer on public.service_areas for select to authenticated
 using(private.is_member(organization_id) and active);

-- Audit events inherit a non-PII market identifier where their entity has a market.
create function private.audit_market_context() returns trigger language plpgsql security definer set search_path='' as $$
declare market uuid;
begin
 if new.entity_type=any(array['requests','distance_snapshots','pricing_evaluations','quotes','quote_versions','orders','jobs','trips','trip_pods','assignments','drivers','vehicles']) then
  execute format('select market_id from public.%I where id=$1 and organization_id=$2',new.entity_type) into market using new.entity_id,new.organization_id;
  if market is not null then new.metadata=new.metadata||jsonb_build_object('market_id',market); end if;
 end if;
 return new;
end $$;
revoke all on function private.audit_market_context() from public,anon,authenticated;
create trigger audit_market before insert on public.audit_logs for each row execute function private.audit_market_context();
