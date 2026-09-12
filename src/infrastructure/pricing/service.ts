import 'server-only';
import { z } from 'zod';
import { AppError } from '@/domain/shared/errors';
import { calculatePriceInput, createQuoteInput, quoteResponseInput } from '@/domain/pricing/model';
import { portalAccess } from '@/infrastructure/identity/access';
import { customerClient } from '@/infrastructure/requests/service';
import { createSupabaseServerClient } from '@/infrastructure/supabase/server';

function pricingError(code: string): never {
  if (code === '42501') throw new AppError('forbidden', 'Commercial access denied');
  if (code === '40001' || code === '23505')
    throw new AppError('conflict', 'Commercial state changed');
  if (['22023', '22P02', '23514', '55000'].includes(code))
    throw new AppError('validation', 'Commercial action is not valid');
  throw new AppError('internal', 'Commercial operation unavailable');
}

async function salesClient(permission: 'pricing.calculate' | 'quotes.manage', writable = false) {
  const access = await portalAccess(permission);
  if (access.status === 'unauthenticated')
    throw new AppError('unauthenticated', 'Sign in required');
  if (access.status !== 'authorized')
    throw new AppError('forbidden', 'Commercial permission required');
  return {
    client: await createSupabaseServerClient(writable),
    organizationId: access.principal.organizationId,
  };
}

export async function salesQueue() {
  const { client, organizationId } = await salesClient('pricing.calculate');
  const { data, error } = await client
    .from('requests')
    .select(
      'id,reference,submitted_at,contact_name,status,services(name_ar,name_en),request_locations(kind,city),quotes(reference,quote_versions(id,status,version,total_minor,expires_at))',
    )
    .eq('organization_id', organizationId)
    .eq('status', 'SUBMITTED')
    .order('submitted_at', { ascending: true })
    .limit(100);
  if (error) pricingError(error.code);
  return data;
}

export async function salesRequestDetails(requestId: string) {
  z.uuid().parse(requestId);
  const { client, organizationId } = await salesClient('pricing.calculate');
  const [request, vehicles, evaluations] = await Promise.all([
    client
      .from('requests')
      .select(
        'id,reference,status,revision,submitted_at,description,notes,contact_name,contact_phone,contact_email,services(name_ar,name_en),request_locations(kind,city,district,address,floor,elevator,access_notes),request_items(description,quantity,notes),request_additional_services(additional_services(code,name_ar,name_en)),quotes(id,reference,quote_versions(id,version,status,final_subtotal_minor,vat_amount_minor,total_minor,currency,expires_at,distance_km,distance_source))',
      )
      .eq('organization_id', organizationId)
      .eq('id', requestId)
      .eq('status', 'SUBMITTED')
      .maybeSingle(),
    client
      .from('vehicle_pricing_classes')
      .select('id,code,name_ar,name_en')
      .eq('organization_id', organizationId)
      .eq('active', true)
      .order('code'),
    client
      .from('pricing_evaluations')
      .select(
        'id,status,route_scope,worker_count,calculated_subtotal_minor,currency,calculated_at,distance_snapshots(distance_km,source_type,verified_at,source_note),vehicle_pricing_classes(name_ar,name_en),pricing_evaluation_components(component_code,label_ar,label_en,quantity,unit_amount_minor,total_amount_minor,position)',
      )
      .eq('organization_id', organizationId)
      .eq('request_id', requestId)
      .order('calculated_at', { ascending: false })
      .limit(10),
  ]);
  for (const [operation, result] of [
    ['request', request],
    ['vehicles', vehicles],
    ['evaluations', evaluations],
  ] as const)
    if (result.error) {
      console.error('sales pricing query failed', { operation, code: result.error.code });
      pricingError(result.error.code);
    }
  if (!request.data) throw new AppError('not_found', 'Submitted request unavailable');
  return {
    request: request.data,
    vehicles: vehicles.data ?? [],
    evaluations: evaluations.data ?? [],
  };
}

export async function calculatePreliminary(input: unknown) {
  const command = calculatePriceInput.parse(input);
  const { client } = await salesClient('pricing.calculate', true);
  const { data, error } = await client.rpc('calculate_preliminary_price', {
    p_request_id: command.requestId,
    p_distance_km: command.distanceKm,
    p_source_note: command.sourceNote,
    p_vehicle_class_id: command.vehicleClassId,
    p_worker_count: command.workerCount,
    p_mutation_id: command.mutationId,
  });
  if (error) pricingError(error.code);
  return data;
}

export async function createQuoteDraft(input: unknown) {
  const command = createQuoteInput.parse(input);
  const { client } = await salesClient('quotes.manage', true);
  const { data, error } = await client.rpc('create_quote_draft', {
    p_evaluation_id: command.evaluationId,
    p_adjustment_minor: command.adjustmentMinor,
    p_adjustment_reason: command.adjustmentReason,
    p_validity_seconds: command.validitySeconds,
    p_mutation_id: command.mutationId,
  });
  if (error) pricingError(error.code);
  return data;
}

export async function sendQuote(quoteVersionId: string) {
  z.uuid().parse(quoteVersionId);
  const { client } = await salesClient('quotes.manage', true);
  const { data, error } = await client.rpc('send_quote', { p_quote_version_id: quoteVersionId });
  if (error) pricingError(error.code);
  return data;
}

export async function customerQuotes() {
  const { client } = await customerClient();
  const { data, error } = await client
    .from('quotes')
    .select(
      'id,reference,request_id,requests(reference,services(name_ar,name_en)),quote_versions(id,version,status,final_subtotal_minor,vat_amount_minor,total_minor,currency,expires_at,sent_at)',
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) pricingError(error.code);
  return data;
}

export async function customerQuoteDetails(quoteVersionId: string, recordView = true) {
  z.uuid().parse(quoteVersionId);
  const { client } = await customerClient(recordView);
  if (recordView) {
    const viewed = await client.rpc('view_customer_quote', { p_quote_version_id: quoteVersionId });
    if (viewed.error) pricingError(viewed.error.code);
  }
  const { data, error } = await client
    .from('quote_versions')
    .select(
      'id,version,status,currency,final_subtotal_minor,vat_rate_bps,vat_amount_minor,total_minor,expires_at,sent_at,viewed_at,accepted_at,rejected_at,distance_km,distance_source,quotes(reference,request_id,requests(reference,services(name_ar,name_en),request_locations(kind,city))),quote_items(component_code,label_ar,label_en,quantity,unit_amount_minor,total_amount_minor,position),orders(id,reference,accepted_at)',
    )
    .eq('id', quoteVersionId)
    .maybeSingle();
  if (error) pricingError(error.code);
  if (!data) throw new AppError('not_found', 'Quote unavailable');
  return data;
}

export async function respondToQuote(quoteVersionId: string, input: unknown) {
  z.uuid().parse(quoteVersionId);
  const command = quoteResponseInput.parse(input);
  const { client } = await customerClient(true);
  const { data, error } = await client.rpc('respond_to_quote', {
    p_quote_version_id: quoteVersionId,
    p_action: command.action,
    p_idempotency_key: command.idempotencyKey,
    p_reason: command.reason,
  });
  if (error) pricingError(error.code);
  if (
    data &&
    typeof data === 'object' &&
    !Array.isArray(data) &&
    data.error_code === 'QUOTE_EXPIRED'
  )
    throw new AppError('validation', 'Quote expired');
  return data;
}
