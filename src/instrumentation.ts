export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { catalogTrace } = await import('./infrastructure/store/catalog-trace');
    catalogTrace({ stage: 'startup', outcome: 'started' });
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
    catalogTrace({ stage: 'startup', outcome: 'ready' });
  }
}

// Observe server-render failures without logging request data or changing propagation.
export const onRequestError: import('next').Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  if (
    process.env.NEXT_RUNTIME !== 'nodejs' ||
    process.env.APP_ENV !== 'local' ||
    process.env.NAQL365_CATALOG_DIAGNOSTICS !== '1'
  )
    return;
  if (context.routeType !== 'render' || !/^\/(ar|en)\/?(?:\?|$)/.test(request.path)) return;
  try {
    const { catalogTrace } = await import('./infrastructure/store/catalog-trace');
    const { safeHomeException } = await import('./infrastructure/markets/home-trace');
    catalogTrace({ stage: 'route-error', outcome: 'threw', ...safeHomeException(error) });
  } catch {
    // Diagnostic delivery must never replace the original application failure.
  }
};
