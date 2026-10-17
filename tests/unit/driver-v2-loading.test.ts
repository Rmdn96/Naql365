import { expect, it } from 'vitest';
import { driverLoadingMarkup } from '../helpers/driver-v2-loading.mjs';
it('renders the existing canonical loading component with real React and escaped labels', () => {
  const html = driverLoadingMarkup('جارٍ التحميل <test>');
  expect(html).toContain('class="skeleton"');
  expect(html).toContain('role="status"');
  expect(html).toContain('جارٍ التحميل &lt;test&gt;');
  expect(html).not.toContain('__pw_type');
});
