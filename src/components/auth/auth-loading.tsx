'use client';
import { usePathname } from 'next/navigation';
import { AuthExperience } from './auth-experience';
import { LoadingState } from '@/components/ui/primitives';

export default function AuthLoading() {
  const locale = usePathname().split('/')[1] === 'en' ? 'en' : 'ar';
  const label = locale === 'ar' ? 'جارٍ تحميل مساحة حسابك…' : 'Loading your account workspace…';
  return (
    <AuthExperience
      locale={locale}
      title={locale === 'ar' ? 'لحظة واحدة' : 'One moment'}
      intro={
        locale === 'ar'
          ? 'نجهّز الخطوة التالية لحسابك.'
          : 'Preparing the next step for your account.'
      }
    >
      <LoadingState label={label} />
    </AuthExperience>
  );
}
