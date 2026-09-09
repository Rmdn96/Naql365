export const roles = ['SUPER_ADMIN', 'SALES', 'OPERATIONS', 'DISPATCHER', 'FINANCE', 'CUSTOMER_SERVICE', 'DRIVER', 'CUSTOMER'] as const;
export type Role = (typeof roles)[number];
export type Principal = { userId: string; organizationId: string };
export interface AuthorizationPort {
  hasPermission(principal: Principal, permission: string): Promise<boolean>;
}
