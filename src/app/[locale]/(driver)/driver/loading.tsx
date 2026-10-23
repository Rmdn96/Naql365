'use client';
import { usePathname } from 'next/navigation';
import { DriverState } from '@/components/driver/state';
export default function Loading() {
  return (
    <DriverState
      state="loading"
      title={usePathname().startsWith('/ar/') ? 'جارٍ تحميل الرحلات' : 'Loading trips'}
    />
  );
}
