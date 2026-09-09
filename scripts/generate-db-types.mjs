import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
const binary = process.platform === 'win32' ? 'node_modules/supabase/bin/supabase.exe' : 'node_modules/supabase/bin/supabase';
const generated = execFileSync(binary, ['gen','types','typescript','--local','--schema','public'], {encoding:'utf8',stdio:['ignore','pipe','inherit']});
writeFileSync('src/infrastructure/supabase/database.types.ts',generated);
