import { afterEach, expect, it, vi } from 'vitest';
vi.mock('node:fs/promises', () => ({ readFile: vi.fn() }));
vi.mock('../../src/infrastructure/store/catalog-trace', () => ({ catalogTrace: vi.fn() }));
vi.mock('../../src/infrastructure/config/environment-authority', () => ({
  validateEnvironment: vi.fn(() => ({ environment: 'production' })),
  verifyArtifact: vi.fn(),
  attestBackend: vi.fn(),
}));
import { readFile } from 'node:fs/promises';
import {
  attestBackend,
  verifyArtifact,
} from '../../src/infrastructure/config/environment-authority';
import { register } from '../../src/instrumentation';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetAllMocks();
});
it('requires the build artifact and attestation through the Next runtime hook', async () => {
  vi.stubEnv('NEXT_RUNTIME', 'nodejs');
  vi.stubEnv('NODE_ENV', 'production');
  vi.mocked(readFile).mockResolvedValue('{}');
  await register();
  expect(verifyArtifact).toHaveBeenCalled();
  expect(attestBackend).toHaveBeenCalled();
  vi.mocked(attestBackend).mockRejectedValue(new Error('ENV_BACKEND_ATTESTATION_UNAVAILABLE'));
  await expect(register()).rejects.toThrow('ENV_BACKEND_ATTESTATION_UNAVAILABLE');
});
it('fails closed when the packaged build identity is absent', async () => {
  vi.stubEnv('NEXT_RUNTIME', 'nodejs');
  vi.stubEnv('NODE_ENV', 'production');
  vi.mocked(readFile).mockRejectedValue(new Error('ENOENT'));
  await expect(register()).rejects.toThrow('ENV_BUILD_ARTIFACT_MISSING');
  expect(attestBackend).not.toHaveBeenCalled();
});
