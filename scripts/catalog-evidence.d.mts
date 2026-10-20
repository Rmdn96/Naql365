import type { z } from 'zod';
import type { diagnosticRecord } from '../src/infrastructure/store/catalog-diagnostic-schema';
type Record = z.infer<typeof diagnosticRecord>;
export function createCatalogEvidence(output: string): {
  file: string;
  snapshot(): { version: number; fileRecords: Record[]; stdoutRecords: Record[]; rejected: number };
  receive(event: unknown): void;
};
