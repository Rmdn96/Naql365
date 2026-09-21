import type {
  Reporter,
  TestCase,
  TestResult,
  FullResult,
  TestStep,
} from '@playwright/test/reporter';

// Hosted auth failures can contain cookies, filled inputs or signed URLs. Never serialize
// Playwright errors, steps, stdout, attachments or traces from this privileged test run.
export default class SafeReporter implements Reporter {
  onStepEnd(_test: TestCase, _result: TestResult, step: TestStep) {
    if (step.error && step.location?.file.replaceAll('\\', '/').includes('/tests/')) {
      process.stdout.write(
        `Failed test step: ${step.location.file.replaceAll('\\', '/').split('/').slice(-2).join('/')}:${step.location.line}\n`,
      );
    }
  }
  onTestEnd(test: TestCase, result: TestResult) {
    process.stdout.write(
      `${result.status}: ${test.titlePath().slice(1).join(' > ')}; durationMs=${result.duration}\n`,
    );
    for (const annotation of test.annotations.filter(
      (item) => item.type === 'safe-security-probe',
    )) {
      process.stdout.write(`Suspension probe: ${annotation.description}\n`);
    }
    if (result.status !== 'passed') {
      for (const error of result.errors) {
        const kind = error.message?.includes('Failed to fetch')
          ? 'browser-fetch-failed'
          : error.message?.includes('Timeout')
            ? 'timeout'
            : 'assertion-or-runtime';
        process.stdout.write(
          `Diagnostic category: ${kind}; source line: ${error.location?.line ?? 'unavailable'}\n`,
        );
      }
    }
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
