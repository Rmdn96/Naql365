'use client';
import { useState } from 'react';
import type { Locale } from '@/i18n/config';
import { Input } from '@/components/ui/primitives';

/** Presentation only: preserve the existing field name, constraints and autocomplete. */
export function PasswordField({
  locale,
  label,
  login,
}: {
  locale: Locale;
  label: string;
  login: boolean;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="auth-v2-password">
      <Input
        id="password"
        label={label}
        name="password"
        type={visible ? 'text' : 'password'}
        required
        minLength={login ? 1 : 12}
        maxLength={128}
        autoComplete={login ? 'current-password' : 'new-password'}
        dir="ltr"
      />
      <button
        className="auth-v2-reveal"
        type="button"
        aria-controls="password"
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
      >
        {locale === 'ar'
          ? visible
            ? 'إخفاء كلمة المرور'
            : 'إظهار كلمة المرور'
          : visible
            ? 'Hide password'
            : 'Show password'}
      </button>
    </div>
  );
}
