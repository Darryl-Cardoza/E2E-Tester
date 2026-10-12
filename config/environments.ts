export const environmentNames = ['local-demo', 'development', 'staging'] as const;
export type EnvironmentName = (typeof environmentNames)[number];
export type EnvironmentInput = Readonly<Record<string, string | undefined>>;

export interface EnvironmentConfig {
  readonly name: EnvironmentName;
  readonly frontendBaseURL: string;
  readonly apiBaseURL: string;
  readonly allowedHosts: readonly string[];
}

function validateBaseURL(value: string, key: string, hosts: readonly string[]): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${key} must be an absolute HTTP(S) URL`);
  }
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    url.pathname !== '/'
  ) {
    throw new Error(
      `${key} must be an HTTP(S) origin without credentials, path, query or fragment`,
    );
  }
  if (!hosts.includes(url.host)) throw new Error(`${key} host is not in ALLOWED_TARGET_HOSTS`);
  return url.origin;
}

export function readEnvironment(env: EnvironmentInput = process.env): EnvironmentConfig {
  const name = env.TEST_ENV ?? 'local-demo';
  if (!environmentNames.includes(name as EnvironmentName)) {
    throw new Error('TEST_ENV must be local-demo, development or staging');
  }
  if (name === 'local-demo') {
    if (env.FRONTEND_BASE_URL || env.API_BASE_URL || env.ALLOWED_TARGET_HOSTS) {
      throw new Error('local-demo uses fixed loopback targets; remove external URL/host overrides');
    }
    return {
      name,
      frontendBaseURL: 'http://127.0.0.1:4173',
      apiBaseURL: 'http://127.0.0.1:4173',
      allowedHosts: ['127.0.0.1:4173'],
    };
  }
  const hosts = (env.ALLOWED_TARGET_HOSTS ?? '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);
  if (!env.FRONTEND_BASE_URL || !env.API_BASE_URL || !hosts.length) {
    throw new Error(
      'External environments require FRONTEND_BASE_URL, API_BASE_URL and ALLOWED_TARGET_HOSTS',
    );
  }
  return {
    name: name as EnvironmentName,
    frontendBaseURL: validateBaseURL(env.FRONTEND_BASE_URL, 'FRONTEND_BASE_URL', hosts),
    apiBaseURL: validateBaseURL(env.API_BASE_URL, 'API_BASE_URL', hosts),
    allowedHosts: hosts,
  };
}
