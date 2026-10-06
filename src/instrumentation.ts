export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnvironment, attestBackend, verifyArtifact } =
      await import('./infrastructure/config/environment-authority');
    const { default: manifest } = await import('../config/deployment-manifest.json');
    const current = validateEnvironment(process.env, manifest);
    // Production is never ready without the independently approved backend designation.
    if (process.env.NODE_ENV === 'production') {
      const { readFile } = await import('node:fs/promises');
      let artifact;
      try {
        artifact = JSON.parse(await readFile('.naql365-build-identity.json', 'utf8'));
      } catch {
        throw new Error('ENV_BUILD_ARTIFACT_MISSING');
      }
      verifyArtifact(artifact, current);
      await attestBackend(process.env, manifest);
    }
  }
}
