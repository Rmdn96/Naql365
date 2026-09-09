import { z } from 'zod';
export const entityId = z.uuid();
export const tenantInput = z.object({ organizationId: entityId }).strict();
export const fileAccessInput = z.object({ fileId: entityId }).strict();
export const signInInput = z
  .object({ email: z.email().max(254), password: z.string().min(12).max(128) })
  .strict();
