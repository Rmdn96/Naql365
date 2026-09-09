import 'server-only';
import { redirect, notFound } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { AppError } from '@/domain/shared/errors';
import { customerClient, requestDetails } from './service';
export async function customerPage(locale: Locale) {
  try {
    return await customerClient();
  } catch (error) {
    if (error instanceof AppError) {
      if (error.code === 'unauthenticated') redirect(`/${locale}/login`);
      if (error.code === 'forbidden') redirect(`/${locale}/account`);
    }
    throw error;
  }
}
export async function detailsPage(locale: Locale, id: string) {
  await customerPage(locale);
  try {
    return await requestDetails(id);
  } catch (error) {
    if (error instanceof AppError && (error.code === 'not_found' || error.code === 'forbidden'))
      notFound();
    throw error;
  }
}
