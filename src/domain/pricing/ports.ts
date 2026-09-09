export const pricingFactors = ['base', 'distance', 'vehicle', 'load', 'workers', 'floors', 'elevator', 'packing', 'disassembly', 'assembly', 'urgency', 'special_handling'] as const;
export type PricingFactor = (typeof pricingFactors)[number];
export type Money = Readonly<{ minorUnits: bigint; currency: string }>;
export type PricingRule = Readonly<{ id: string; version: number; factor: PricingFactor }>;
export interface PricingRulesRepository {
  findEffectiveRules(organizationId: string, effectiveAt: Date): Promise<readonly PricingRule[]>;
}
// Rule evaluation and quote calculation belong to a later phase.
