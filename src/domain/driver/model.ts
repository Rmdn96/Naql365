import { z } from 'zod';
import { tripStatuses, stopStatuses, payloadSchemas } from '@/domain/operations/model';

export const driverViews = ['today', 'upcoming', 'completed'] as const;
export const driverActions = [
  'dispatch',
  'arrive',
  'start_service',
  'complete_stop',
  'depart',
  'complete_trip',
] as const;
export const issueCategories = [
  'CUSTOMER_UNAVAILABLE',
  'ADDRESS_ISSUE',
  'ACCESS_BLOCKED',
  'ITEM_NOT_READY',
  'VEHICLE_ISSUE',
  'DAMAGE_CONCERN',
  'OTHER',
] as const;
export const eventLocation = z.strictObject({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  capturedAt: z.iso.datetime({ offset: true }),
  accuracy: z.number().min(0).max(100000).optional(),
});
export type EventLocation = z.infer<typeof eventLocation>;
export const driverCommand = z
  .strictObject({
    tripId: z.uuid(),
    action: z.enum(driverActions),
    revision: z.number().int().nonnegative(),
    mutationId: z.uuid(),
    payload: z.unknown(),
    location: eventLocation.nullable().default(null),
  })
  .transform((value, ctx) => {
    const payload = payloadSchemas[value.action].safeParse(value.payload);
    if (!payload.success || (value.location && value.action !== 'arrive')) {
      ctx.addIssue({ code: 'custom', message: 'Invalid execution command' });
      return z.NEVER;
    }
    return { ...value, payload: payload.data };
  });
export const driverIssue = z.strictObject({
  tripId: z.uuid(),
  stopId: z.uuid(),
  category: z.enum(issueCategories),
  reason: z.string().trim().min(1).max(1000),
  mutationId: z.uuid(),
});
export const driverTrip = z.object({
  id: z.uuid(),
  reference: z.string(),
  status: z.enum(tripStatuses),
  revision: z.number().int(),
  plannedStart: z.string().nullable(),
  plannedEnd: z.string().nullable(),
  completedAt: z.string().nullable(),
  market: z.object({
    id: z.uuid(),
    countryCode: z.enum(['SA', 'EG']),
    nameAr: z.string(),
    nameEn: z.string(),
    timezone: z.string(),
  }),
  vehicle: z.object({ identifier: z.string(), type: z.string() }),
  contact: z.object({ name: z.string().nullable(), phone: z.string().nullable() }).nullable(),
  stops: z
    .array(
      z.object({
        id: z.uuid(),
        position: z.number().int(),
        kind: z.enum(['PICKUP', 'DELIVERY']),
        status: z.enum(stopStatuses),
        address: z.string().nullable(),
        instructions: z.string(),
        arrivedAt: z.string().nullable(),
        completedAt: z.string().nullable(),
      }),
    )
    .max(40),
  attention: z.boolean(),
  issues: z.array(
    z.object({
      id: z.uuid(),
      stopId: z.uuid(),
      category: z.enum(issueCategories),
      reason: z.string(),
      status: z.enum(['OPEN', 'RESOLVED']),
      createdAt: z.string(),
      photoState: z.enum(['PENDING', 'FINAL', 'REMOVING']).nullable(),
    }),
  ),
  pod: z
    .object({
      id: z.uuid(),
      state: z.enum(['PENDING', 'REMOVING', 'FINAL']),
      capturedAt: z.string().nullable(),
      own: z.boolean(),
    })
    .nullable(),
});
export type DriverTrip = z.infer<typeof driverTrip>;
export function marketDate(value: Date, timezone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(value);
}
