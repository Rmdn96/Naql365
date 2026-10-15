export interface Family {
  id: string;
  role: string;
  route: string;
  state: string;
  batch: string;
}
export interface Presentation {
  width: number;
  theme: string;
  system: string;
}
export interface RequiredRow extends Presentation {
  id: string;
  family: string;
  role: string;
  route: string;
  state: string;
  locale: string;
}
export interface EvidenceRow extends RequiredRow {
  applicationSha: string;
  result: string;
  filename: string;
  sha256: string;
}
export const families: Family[];
export const locales: string[];
export const core: Set<string>;
export function presentations(family: Family): Presentation[];
export function matrixId(family: Family, locale: string, view: Presentation): string;
export function requiredMatrix(): RequiredRow[];
export function matrixStore(
  applicationSha: string,
  directory?: string,
): {
  directory: string;
  required: RequiredRow[];
  index: {
    applicationSha: string;
    rows: EvidenceRow[];
    failures: unknown[];
    total: number;
    pass: number;
    missing: string[];
  };
  save(): void;
  has(id: string): boolean;
  add(row: EvidenceRow): void;
  complete(batch: string): boolean;
};
