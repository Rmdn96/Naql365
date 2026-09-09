export type NotificationChannel = 'in_app' | 'email' | 'whatsapp' | 'sms';
export type NotificationEnvelope = Readonly<{
  id: string; organizationId: string; recipientProfileId: string;
  templateKey: string; locale: 'ar' | 'en'; channel: NotificationChannel; idempotencyKey: string;
}>;
export interface NotificationDeliveryPort {
  deliver(envelope: NotificationEnvelope): Promise<{ providerReference: string }>;
}
