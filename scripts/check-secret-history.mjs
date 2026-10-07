import { execFileSync } from 'node:child_process';
const objects = execFileSync('git', ['rev-list', '--objects', '--all'], {
  encoding: 'utf8',
  maxBuffer: 64 * 1024 * 1024,
})
  .trim()
  .split('\n')
  .filter(
    (line) =>
      /\.(?:ts|tsx|js|mjs|json|sql|md|yml|yaml|toml|env)$/.test(line) || / \.env/.test(line),
  )
  .map((line) => line.split(' ')[0]);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})\b/,
  /\bsb_secret_[A-Za-z0-9_-]{15,}\b/,
  /\beyJ[A-Za-z0-9_-]{12,}\.eyJ[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_-]{12,}\b/,
  /postgres(?:ql)?:\/\/[^\s:/]+:[^\s@]+@/,
];
let scanned = 0;
for (let i = 0; i < objects.length; i += 100) {
  const output = execFileSync('git', ['cat-file', '--batch'], {
    input: objects.slice(i, i + 100).join('\n') + '\n',
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (patterns.some((p) => p.test(output)))
    throw Error('Historical credential pattern found; content withheld');
  scanned += objects.slice(i, i + 100).length;
}
console.log(
  'History credential-pattern scan PASS: ' +
    scanned +
    ' text blobs; heuristic coverage, not proof of absence of every secret format.',
);
