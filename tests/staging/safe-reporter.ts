import type { Reporter, TestCase, TestResult, FullResult } from '@playwright/test/reporter';

// Hosted auth failures can contain cookies, filled inputs or signed URLs. Never serialize
// Playwright errors, steps, stdout, attachments or traces from this privileged test run.
export default class SafeReporter implements Reporter {
  onTestEnd(test: TestCase, result: TestResult) {
    process.stdout.write(`${result.status}: ${test.titlePath().slice(1).join(' > ')}\n`);
  }
  onError() {
    process.stderr.write(
      'Staging test setup failed; inspect configuration without printing secrets.\n',
    );
  }
  onEnd(result: FullResult) {
    process.stdout.write(`Staging suite: ${result.status}\n`);
  }
}
