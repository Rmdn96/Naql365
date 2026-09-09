import { expect, it } from 'vitest';
import { hasSourceMapDirective } from '../helpers/source-map';

it.each([
  'const x = 1; //# sourceMappingURL=app.js.map',
  'const x = 1;\n/*# sourceMappingURL=data:application/json;base64,e30= */',
])('detects a real comment directive', (source) => {
  expect(hasSourceMapDirective(source)).toBe(true);
});
it('does not treat CSS-loader string literals as exposed source maps', () => {
  expect(
    hasSourceMapDirective('let r = "\\n/*# sourceMappingURL=data:application/json;base64,";'),
  ).toBe(false);
});
