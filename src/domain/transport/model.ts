export type RequestRef = Readonly<{ id: string; organizationId: string; customerId: string }>;
export type QuoteVersionRef = Readonly<{
  id: string;
  quoteId: string;
  organizationId: string;
  version: number;
}>;
export type OrderRef = Readonly<{
  id: string;
  organizationId: string;
  acceptedQuoteVersionId: string;
}>;
export type JobRef = Readonly<{ id: string; organizationId: string; orderId: string }>;
export type TripStopRef = Readonly<{
  id: string;
  organizationId: string;
  tripId: string;
  position: number;
}>;
export interface QuoteAcceptancePort {
  // Implementation must use one database transaction and a unique quote acceptance constraint.
  accept(input: {
    organizationId: string;
    quoteVersionId: string;
    idempotencyKey: string;
  }): Promise<OrderRef>;
}
