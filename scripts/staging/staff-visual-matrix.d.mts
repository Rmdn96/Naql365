export const applicationSha: string;
export const widths: number[];
export const locales: string[];
export const families: { id: string; role: string; route: string; state: string; batch: string }[];
export type MatrixRow = {
  id: string;
  result: string;
  applicationSha: string;
  filename: string;
  sha256: string;
};
export function matrixStore(directory?: string): {
  directory: string;
  required: {
    id: string;
    family: string;
    role: string;
    route: string;
    state: string;
    locale: string;
    width: number;
  }[];
  index: { rows: MatrixRow[]; total: number; pass: number; missing: string[] };
  save(): void;
  has(id: string): boolean;
  add(row: MatrixRow): void;
  complete(batch: string): boolean;
};
