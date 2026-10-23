import type { DriverTrip } from '@/domain/driver/model';
export function driverFixture(view: string): DriverTrip {
  const completed = view === 'history',
    pod = view === 'pod';
  return {
    id: '14000000-0000-4000-8000-000000000001',
    reference: 'TEST-DRIVER-EG',
    status: completed
      ? 'COMPLETED'
      : pod
        ? 'DELIVERED'
        : view === 'tracking'
          ? 'IN_TRANSIT'
          : 'READY',
    revision: 3,
    plannedStart: '2026-10-23T10:00:00Z',
    plannedEnd: null,
    completedAt: completed ? '2026-10-23T12:00:00Z' : null,
    market: {
      id: '14000000-0000-4000-8000-000000000002',
      countryCode: 'EG',
      nameAr: 'مصر',
      nameEn: 'Egypt',
      timezone: 'Africa/Cairo',
    },
    vehicle: { identifier: 'TEST-VEHICLE', type: 'Truck' },
    contact: completed ? null : { name: 'TEST Customer', phone: '+201000000000' },
    stops: [
      {
        id: '14000000-0000-4000-8000-000000000003',
        position: 1,
        kind: 'PICKUP',
        status: completed || pod ? 'COMPLETED' : 'PENDING',
        address: completed ? null : 'TEST Cairo pickup',
        instructions: completed ? '' : 'Synthetic instructions',
        arrivedAt: null,
        completedAt: null,
      },
      {
        id: '14000000-0000-4000-8000-000000000004',
        position: 2,
        kind: 'DELIVERY',
        status: completed || pod ? 'COMPLETED' : 'PENDING',
        address: completed ? null : 'TEST delivery',
        instructions: '',
        arrivedAt: null,
        completedAt: null,
      },
    ],
    attention: view === 'issue',
    issues:
      view === 'issue'
        ? [
            {
              id: '14000000-0000-4000-8000-000000000005',
              stopId: '14000000-0000-4000-8000-000000000003',
              category: 'OTHER',
              reason: 'TEST exception',
              status: 'OPEN',
              createdAt: '2026-10-23T10:00:00Z',
              photoState: null,
            },
          ]
        : [],
    pod: completed
      ? {
          id: '14000000-0000-4000-8000-000000000006',
          state: 'FINAL',
          capturedAt: '2026-10-23T12:00:00Z',
          own: true,
        }
      : null,
  };
}
