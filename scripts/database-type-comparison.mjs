/** @param {string} source */
export function schemaTypes(source) {
  // Hosted generation adds a client-version hint which --local does not emit.
  // This exact optional metadata block is not part of the PostgreSQL public schema.
  // Do not normalize any table, relationship, enum or RPC declaration.
  return source
    .replaceAll('\r\n', '\n')
    .replace(
      /^  \/\/ Allows to automatically instantiate createClient with right options\n  \/\/ instead of createClient<Database, \{ PostgrestVersion: 'XX' \}>\(URL, KEY\)\n  __InternalSupabase: \{\n    PostgrestVersion: "[0-9.]+"\n  \}\n/m,
      '',
    )
    .trimEnd();
}
