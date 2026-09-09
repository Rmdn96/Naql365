import { createScanner, ScriptTarget, SyntaxKind } from 'typescript';

// A string used by a vendor's CSS loader is not a source-map directive. Scan actual
// JavaScript comments so the audit neither reports string literals nor misses inline comments.
export function hasSourceMapDirective(source: string): boolean {
  const scanner = createScanner(ScriptTarget.Latest, false);
  scanner.setText(source);
  for (let token = scanner.scan(); token !== SyntaxKind.EndOfFileToken; token = scanner.scan()) {
    if (
      (token === SyntaxKind.SingleLineCommentTrivia ||
        token === SyntaxKind.MultiLineCommentTrivia) &&
      /^\/[/\*][#@]\s*sourceMappingURL=/.test(scanner.getTokenText())
    )
      return true;
  }
  return false;
}
