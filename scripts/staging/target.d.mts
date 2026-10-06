export function acceptanceTarget(
  env?: Record<string, string | undefined>,
  approved?: { staging: { projectRef: string; origins: string[]; hostingerOrigins: string[] } },
): { origin: string; provider: string };
export function protectionHeaders(env?: Record<string, string | undefined>): Record<string, string>;
