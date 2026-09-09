import type { Money } from '@/domain/pricing/ports';
export type PaymentIntent = Readonly<{
  paymentId: string;
  organizationId: string;
  amount: Money;
  idempotencyKey: string;
}>;
export interface PaymentProviderPort {
  createIntent(input: PaymentIntent): Promise<{ providerReference: string }>;
  verifyWebhook(
    rawBody: string,
    signature: string,
  ): Promise<{ eventId: string; providerReference: string }>;
}
export type InvoiceRef = Readonly<{ id: string; organizationId: string; orderId: string }>;
