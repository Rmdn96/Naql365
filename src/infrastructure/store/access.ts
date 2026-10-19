import 'server-only';
import { cache } from 'react';
import { staffAccess } from '@/infrastructure/identity/staff-context';
// Presentation grants from the SAME canonical, single-organization staff context.
// Every destination and command independently repeats database authorization.
export const storeStaffModules = cache(async () => {
  const names = [
    'store.orders.read',
    'store.payments.read',
    'store.settlements.manage',
    'store.catalog.read',
    'store.supplier_cost.read',
    'finance.read',
  ] as const;
  const access = await Promise.all(names.map((permission) => staffAccess(permission)));
  const a = access.map((result) => result.status === 'authorized');
  return {
    orders: !!a[0],
    finance: !!a[1] && !!a[5],
    reconciliation: !!a[2] && !!a[4] && !!a[5],
    catalog: !!a[3],
  };
});
