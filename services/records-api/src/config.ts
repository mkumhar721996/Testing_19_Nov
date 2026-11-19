export interface Config {
  databaseUrl: string;
  sessionSecret: string;
  sessionTtlSeconds: number;
  identityProvider: 'entra' | 'fake';
  entra?: { tenantId: string; clientId: string };
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const identityProvider = env.IDENTITY_PROVIDER ?? 'entra';
  if (identityProvider !== 'entra' && identityProvider !== 'fake') {
    throw new Error('IDENTITY_PROVIDER must be "entra" or "fake"');
  }
  if (identityProvider === 'fake' && env.NODE_ENV !== 'test') {
    throw new Error('IDENTITY_PROVIDER=fake is allowed only when NODE_ENV=test');
  }
  return {
    databaseUrl: required(env, 'DATABASE_URL'),
    sessionSecret: required(env, 'SESSION_SECRET'),
    sessionTtlSeconds: Number(env.SESSION_TTL_SECONDS ?? 3600),
    identityProvider,
    entra:
      identityProvider === 'entra'
        ? { tenantId: required(env, 'ENTRA_TENANT_ID'), clientId: required(env, 'ENTRA_CLIENT_ID') }
        : undefined,
  };
}
