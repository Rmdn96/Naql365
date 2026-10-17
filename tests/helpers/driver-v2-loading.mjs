import { readFileSync } from 'node:fs';
import ts from 'typescript';
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
// Operator/test-only adapter. Playwright transforms imported TSX to __pw_type
// descriptors; compile the trusted canonical presentation module with real React.
const source = readFileSync(
  new URL('../../src/components/ui/presentation.tsx', import.meta.url),
  'utf8',
);
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React },
}).outputText;
const components = {};
new Function('React', 'exports', code)(React, components);
export function driverLoadingMarkup(label) {
  return renderToStaticMarkup(React.createElement(components.Skeleton, { label }));
}
