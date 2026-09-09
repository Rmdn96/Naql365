import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/,
  /\bsb_secret_[A-Za-z0-9_-]{15,}\b/,
  /\bAKIA[A-Z0-9]{16}\b/,
  /\beyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/,
  /postgres(?:ql)?:\/\/[^\s:/]+:[^\s@]+@/,
];
const findings = [];
for (const file of files) {
  if (/(^|\/)\.env(?:\.|$)/.test(file) && file !== '.env.example')
    findings.push(`${file}: tracked environment file`);
  if (!existsSync(file) || /\.(png|jpg|woff2?)$/.test(file)) continue;
  const content = readFileSync(file, 'utf8');
  if (patterns.some((pattern) => pattern.test(content)))
    findings.push(`${file}: possible credential (value redacted)`);
}
if (findings.length) {
  process.stderr.write(findings.join('\n') + '\n');
  process.exit(1);
}
process.stdout.write(`Secret-pattern scan passed for ${files.length} tracked files.\n`);
