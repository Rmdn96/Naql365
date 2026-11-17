import { expect, it } from 'vitest';
import { optionalDescriptions } from '@/domain/store/draft-content';
it('omits blank optional descriptions and retains entered public text', () => {
  expect(optionalDescriptions('', '  ')).toEqual({});
  expect(optionalDescriptions(' وصف ', ' Description ')).toEqual({
    description_ar: 'وصف',
    description_en: 'Description',
  });
});
