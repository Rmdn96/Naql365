# Migration 50 dependency security assessment — 2026-10-19

The unchanged lockfile at accepted delivery
`6ab494c7dc703bba6f2e3f0afb8796b3791ed13d` was inspected with read-only
`npm audit --json`, `npm audit --omit=dev --json`, dependency-tree inspection
and registry metadata. No install, audit-fix, override or dependency edit was
performed. Node 24.18 / npm 11.16 were used locally.

## Findings

The full audit reports five High affected package nodes, arising from **one
underlying advisory**, not five independently identified vulnerabilities:

`eslint-config-next@16.3.8` (direct development dependency)
→ `@next/eslint-plugin-next@16.3.8` → `fast-glob@3.3.1`
→ `micromatch@4.0.8` → `braces@3.0.3`.

GHSA-vfj7-8cjw-p6xm / CVE-2026-93687 concerns stack-exhaustion denial of
service from deeply nested brace patterns. The advisory lists versions through
3.0.3 as affected and no patched version at inspection time.
[GitHub advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm).

The installed and registry-latest braces versions were both 3.0.3. The audit's
suggested eslint-config-next 14.2.35 change is a major-line downgrade from the
accepted Next 16 toolchain; it is not a demonstrated compatible remediation.
No safe patched compatible version was identified, so dependencies were left
unchanged rather than forcing an unrelated framework/toolchain change.

## Exposure and disposition

Production-only audit reports **zero known advisories**. The identified chain
belongs to lint/build tooling. No direct application import or confirmed
customer-request exploitation was identified. This does not prove the complete
production bundle free of vulnerabilities, nor rule out CI/build exposure to
attacker-controlled glob patterns. No credential or customer-data disclosure
was demonstrated. Vercel/Hostinger build tooling can share this exposure even
though the reported dependency is development-only.

Keep untrusted configuration/glob changes subject to review and run builds
without unnecessary privileged credentials. Monitor the upstream advisory and
test a targeted patched dependency chain when available. Do not run
`npm audit fix --force` or downgrade Next tooling merely to clear the counter.
Re-run lint, types, tests and build after a proposed compatible update.

This remains an unresolved build/CI security finding requiring release-owner
assessment before Production approval. Passing CI does not remediate it.
Historical five-High warnings and this result are consistent at affected-node
level; multiple dependency paths must not be reported as separate CVEs.
