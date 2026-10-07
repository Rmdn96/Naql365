type TargetManifest = {
  staging: {
    projectRef: string;
    origins: string[];
    hostingerOrigins: string[];
    hostingerProtection?: Record<string, { mode: string; approval: string }>;
  };
};
export function acceptanceTarget(
  env?: Record<string, string | undefined>,
  approved?: TargetManifest,
): { origin: string; provider: string };
export function protectionHeaders(
  env?: Record<string, string | undefined>,
  approved?: TargetManifest,
): Record<string, string>;
