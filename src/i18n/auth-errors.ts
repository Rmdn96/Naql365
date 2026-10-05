import type { Locale } from './config';

const messages = {
  ar: {
    credentials: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
    confirmation:
      'يلزم تأكيد البريد الإلكتروني قبل تسجيل الدخول. افتح رسالة التأكيد في المتصفح نفسه.',
    provisioning: 'تم تسجيل الدخول، لكن إعداد حسابك لم يكتمل. أعد المحاولة أو تواصل مع الدعم.',
    membership: 'لا توجد عضوية فعالة وصالحة لهذا الحساب. تواصل مع مسؤول المؤسسة.',
    server: 'تعذر الاتصال بخدمة الحساب الآن. حاول مجددًا بعد قليل.',
    validation: 'تحقق من صيغة البريد الإلكتروني ومتطلبات كلمة المرور.',
  },
  en: {
    credentials: 'The email or password is incorrect.',
    confirmation:
      'Confirm your email before signing in. Open the confirmation email in the same browser.',
    provisioning: 'You are signed in, but account setup is incomplete. Retry or contact support.',
    membership:
      'This account has no valid active membership. Contact your organization administrator.',
    server: 'The account service is unavailable right now. Please try again shortly.',
    validation: 'Check the email format and password requirements.',
  },
};
export function authErrorMessage(locale: Locale, code?: string) {
  const dictionary = messages[locale];
  return code && Object.hasOwn(dictionary, code)
    ? dictionary[code as keyof typeof dictionary]
    : dictionary.server;
}
