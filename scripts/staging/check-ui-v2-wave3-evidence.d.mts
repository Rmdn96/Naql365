export function requiredWave3Evidence(): {
  state: string;
  locale: string;
  theme: string;
  width: number;
}[];
export function verifyWave3Evidence(
  directory: string,
  applicationSha: string,
): { required: number; passed: number; missing: number; missingStates: string[]; result: string };
