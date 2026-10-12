import type { EnvironmentConfig } from '../../config/environments.js';

/** Only root-relative paths may be supplied by test definitions. */
export function resolveTargetURL(
  path: string,
  target: 'frontend' | 'api',
  environment: EnvironmentConfig,
): string {
  const pathname = path.split(/[?#]/, 1)[0] ?? '';
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    // Explicitly reject control characters before URL normalization can discard them.
    // eslint-disable-next-line no-control-regex
    /[\\\s\u0000-\u001f\u007f]/.test(path) ||
    /%(?:2e|2f|5c|25|0[0-9a-f]|1[0-9a-f]|7f)/i.test(pathname) ||
    pathname.split('/').some((segment) => segment === '.' || segment === '..')
  ) {
    throw new Error(
      'Target must be a root-relative path without traversal, backslashes or control characters',
    );
  }
  const base = target === 'api' ? environment.apiBaseURL : environment.frontendBaseURL;
  const url = new URL(path, base);
  if (url.origin !== new URL(base).origin || !environment.allowedHosts.includes(url.host)) {
    throw new Error('Target origin is not allowed');
  }
  return url.href;
}
