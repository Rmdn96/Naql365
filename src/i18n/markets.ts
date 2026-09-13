import type { Locale } from './config';
const ar = {
  market: 'الدولة',
  choose: 'اختر الدولة',
  fixed: 'لتغيير الدولة، ألغِ المسودة وابدأ طلبًا جديدًا.',
  region: 'المنطقة / المحافظة',
  city: 'المدينة',
  postal: 'الرمز البريدي (اختياري)',
  building: 'المبنى (اختياري)',
  unit: 'الوحدة (اختياري)',
  timezone: 'المنطقة الزمنية',
  all: 'كل الدول',
  currency: 'العملة',
  localTimeError: 'الموعد المحلي غير صالح أو ملتبس بسبب تغيير التوقيت. اختر موعدًا آخر.',
  unavailable: 'لا توجد تغطية مفعلة لهذا الموقع.',
};
const en: Record<keyof typeof ar, string> = {
  market: 'Country',
  choose: 'Choose country',
  fixed: 'To change country, cancel this draft and start a new request.',
  region: 'Region / Governorate',
  city: 'City',
  postal: 'Postal code (optional)',
  building: 'Building (optional)',
  unit: 'Unit (optional)',
  timezone: 'Time zone',
  all: 'All countries',
  currency: 'Currency',
  localTimeError: 'This local time is invalid or ambiguous at a clock change. Choose another time.',
  unavailable: 'Service coverage is not active for this location.',
};
export const marketDictionary = (locale: Locale) => (locale === 'ar' ? ar : en);
