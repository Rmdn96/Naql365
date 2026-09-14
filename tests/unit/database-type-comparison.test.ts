import { expect, it } from 'vitest';
import { schemaTypes } from '../../scripts/database-type-comparison.mjs';
it('excludes only the official hosted version hint and still detects real schema drift', () => {
  const base =
    'export type Database = {\n  public: { Tables: { trips: { Row: { id: string } } } }\n}\n';
  const hint =
    '  // Allows to automatically instantiate createClient with right options\n  // instead of createClient<Database, { PostgrestVersion: \'XX\' }>(URL, KEY)\n  __InternalSupabase: {\n    PostgrestVersion: "14.5"\n  }\n';
  const hosted = base.replace('  public:', hint + '  public:');
  expect(schemaTypes(hosted)).toBe(schemaTypes(base));
  expect(schemaTypes(hosted.replace('id: string', 'id: number'))).not.toBe(schemaTypes(base));
  expect(
    schemaTypes(
      hosted.replace('PostgrestVersion: "14.5"', 'PostgrestVersion: "14.5"\n    extra: true'),
    ),
  ).not.toBe(schemaTypes(base));
});
