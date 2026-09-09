import { z } from 'zod';

export function deploymentEnvironment() {
  const environment = z
    .enum(['local', 'staging', 'production'])
    .parse(process.env.APP_ENV || 'local');
  if (process.env.VERCEL_ENV === 'preview' && environment !== 'staging') {
    throw new Error('Vercel Preview requires APP_ENV=staging');
  }
  return environment;
}

export function stagingAuthEnabled() {
  return (
    deploymentEnvironment() !== 'production' && process.env.STAGING_AUTH_SMOKE_ENABLED === 'true'
  );
}

export function preventIndexing() {
  return deploymentEnvironment() !== 'production';
}
