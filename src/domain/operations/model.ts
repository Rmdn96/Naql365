import { z } from 'zod';

export const tripStatuses = [
  'PLANNED',
  'ASSIGNED',
  'READY',
  'EN_ROUTE_TO_PICKUP',
  'AT_PICKUP',
  'PICKUP_IN_PROGRESS',
  'PICKED_UP',
  'IN_TRANSIT',
  'AT_DELIVERY',
  'DELIVERY_IN_PROGRESS',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'FAILED',
] as const;
export type TripStatus = (typeof tripStatuses)[number];
export const stopStatuses = ['PENDING', 'EN_ROUTE', 'ARRIVED', 'IN_PROGRESS', 'COMPLETED'] as const;
export const stopInput = z
  .object({
    kind: z.enum(['PICKUP', 'DELIVERY']),
    address: z.string().trim().min(1).max(500),
    notes: z.string().max(1000).default(''),
    pickups: z.array(z.number().int().min(0).max(39)).max(40),
  })
  .strict();
export const planInput = z
  .object({
    plannedStart: z.iso.datetime({ offset: true }),
    plannedEnd: z.iso.datetime({ offset: true }),
    stops: z.array(stopInput).min(2).max(40),
  })
  .strict()
  .superRefine((plan, ctx) => {
    if (Date.parse(plan.plannedEnd) <= Date.parse(plan.plannedStart))
      ctx.addIssue({ code: 'custom', message: 'Invalid window' });
    if (plan.stops[0]?.kind !== 'PICKUP' || plan.stops.at(-1)?.kind !== 'DELIVERY')
      ctx.addIssue({ code: 'custom', message: 'Pickup and delivery required' });
    plan.stops.forEach((s, index) => {
      if (
        (s.kind === 'PICKUP' && s.pickups.length > 0) ||
        (s.kind === 'DELIVERY' && s.pickups.length === 0) ||
        new Set(s.pickups).size !== s.pickups.length ||
        s.pickups.some((p) => p >= index || plan.stops[p]?.kind !== 'PICKUP')
      )
        ctx.addIssue({
          code: 'custom',
          path: ['stops', index, 'pickups'],
          message: 'Invalid pickup dependencies',
        });
    });
  });
const assignment = z.object({ driverId: z.uuid(), vehicleId: z.uuid() }).strict();
const stopCommand = z.object({ stopId: z.uuid() }).strict();
const reason = z.object({ reason: z.string().trim().min(1).max(500) }).strict();
const empty = z.object({}).strict();
export const payloadSchemas = {
  create_job: empty,
  create_trip: empty,
  plan: planInput,
  create_driver: z
    .object({ type: z.enum(['INTERNAL', 'EXTERNAL']), name: z.string().trim().min(1).max(120) })
    .strict(),
  create_vehicle: z
    .object({
      type: z.string().trim().min(1).max(80),
      identifier: z.string().trim().min(1).max(60),
    })
    .strict(),
  set_driver_active: z.object({ active: z.boolean() }).strict(),
  set_vehicle_active: z.object({ active: z.boolean() }).strict(),
  assign: assignment,
  reassign: assignment.extend({
    reason: z.string().trim().min(1).max(500),
    confirmed: z.literal(true),
  }),
  ready: empty,
  dispatch: empty,
  arrive: stopCommand,
  start_service: stopCommand,
  complete_stop: stopCommand,
  depart: stopCommand,
  complete_trip: empty,
  cancel: reason,
  fail: reason,
} as const;
export type OperationAction = keyof typeof payloadSchemas;
export const operationInput = z
  .object({
    organizationId: z.uuid(),
    entityId: z.uuid(),
    revision: z.number().int().nonnegative(),
    mutationId: z.uuid(),
    action: z.enum(Object.keys(payloadSchemas) as [OperationAction, ...OperationAction[]]),
    payload: z.unknown(),
  })
  .strict()
  .transform((input, ctx) => {
    const parsed = payloadSchemas[input.action].safeParse(input.payload);
    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', message: 'Invalid command payload' });
      return z.NEVER;
    }
    return { ...input, payload: parsed.data };
  });
export const operationResult = z.object({
  id: z.uuid(),
  revision: z.number().int().nonnegative(),
  status: z.enum(tripStatuses).optional(),
});
export const podInput = z
  .object({
    tripId: z.uuid(),
    fileId: z.uuid(),
    recipient: z.string().trim().min(1).max(120),
    notes: z.string().max(500),
  })
  .strict();
export const progressSchema = z.object({
  id: z.uuid(),
  reference: z.string().nullable(),
  status: z.enum(['NOT_STARTED', 'IN_PROGRESS', 'EXCEPTION', 'COMPLETED']),
  completedAt: z.string().nullable(),
  trips: z.array(
    z.object({
      reference: z.string().nullable(),
      status: z.enum(tripStatuses),
      totalStops: z.number().int(),
      completedStops: z.number().int(),
      podCaptured: z.boolean(),
    }),
  ),
});

// Presentation aid only. Every transition is independently revalidated by PostgreSQL.
export function nextStopAction(status: (typeof stopStatuses)[number]): OperationAction | null {
  return (
    {
      PENDING: 'depart',
      EN_ROUTE: 'arrive',
      ARRIVED: 'start_service',
      IN_PROGRESS: 'complete_stop',
      COMPLETED: null,
    } as const
  )[status];
}
