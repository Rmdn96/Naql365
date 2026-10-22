import type { ReactNode } from 'react';
import { DesignFoundation } from '@/components/design-system/foundation';
import type { Locale } from '@/i18n/config';
import { BrandLink } from '@/components/shell/brand-link';

export function AuthExperience({
  locale,
  title,
  intro,
  children,
}: {
  locale: Locale;
  title: string;
  intro: string;
  children: ReactNode;
}) {
  const ar = locale === 'ar';
  return (
    <DesignFoundation family="auth" className="auth-v2">
      <div className="container auth-v2-layout">
        <aside className="auth-v2-story" aria-label={ar ? 'نقل 365' : 'Naql365'}>
          <BrandLink
            locale={locale}
            size="auth"
            href={`/${locale}`}
            label={ar ? 'نقل 365 — الرئيسية' : 'Naql365 — Home'}
          />
          <div className="auth-v2-story-copy">
            <p className="auth-v2-eyebrow">
              {ar ? 'رحلة نقل أوضح' : 'A clearer transport journey'}
            </p>
            <h2>
              {ar ? 'كل رحلة تبدأ بخطوة موثوقة.' : 'Every journey starts with a confident step.'}
            </h2>
            <p>
              {ar
                ? 'من الطلب إلى التسليم… كل شيء تحت السيطرة.'
                : 'From request to delivery — stay in control.'}
            </p>
          </div>
          <ol className="auth-v2-route" aria-label={ar ? 'كيف تعمل الخدمة' : 'How it works'}>
            {(ar
              ? ['أرسل طلبك', 'راجع عرض السعر النهائي', 'تابع رحلة النقل']
              : ['Send your request', 'Review your final quote', 'Follow your transport journey']
            ).map((text, i) => (
              <li key={text}>
                <span aria-hidden="true">0{i + 1}</span>
                {text}
              </li>
            ))}
          </ol>
          <p className="auth-v2-trust">
            {ar
              ? 'حافظ على خصوصية كلمة المرور وروابط التأكيد.'
              : 'Keep your password and confirmation links private.'}
          </p>
        </aside>
        <section className="auth-v2-surface" aria-labelledby="auth-v2-title">
          <div className="auth-v2-form-inner">
            <p className="auth-v2-kicker">
              {ar ? 'مساحة النقل الخاصة بك' : 'Your transport workspace'}
            </p>
            <h1 id="auth-v2-title">{title}</h1>
            <p className="auth-intro">{intro}</p>
            {children}
          </div>
        </section>
      </div>
    </DesignFoundation>
  );
}
