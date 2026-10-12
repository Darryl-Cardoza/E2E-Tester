import type { BrowserContext, Request, Route } from '@playwright/test';
import { setTimeout } from 'node:timers/promises';
import type { EnvironmentConfig } from '../../config/environments.js';
import type { ExecutionMode } from '../../config/test-projects.js';
import type { ActionParameters } from '../types/scenario.js';
import { resolveTargetURL } from './environment-manager.js';

export function readApiPrefixes(value = process.env.API_PATH_PREFIXES ?? '/api'): string[] {
  const prefixes = value.split(',').map((item) => item.trim());
  if (prefixes.some((prefix) => !/^\/(?:[A-Za-z0-9_-]+\/?)*$/.test(prefix))) {
    throw new Error('API_PATH_PREFIXES must contain comma-separated root-relative path prefixes');
  }
  return prefixes.map((prefix) => (prefix === '/' ? prefix : prefix.replace(/\/$/, '')));
}

/** One context-wide router owns framework mocks and the unmatched-request boundary. */
export class BrowserPolicy {
  private readonly mocks = new Map<string, ActionParameters['mock.api']>();
  private readonly issues = new Set<string>();
  private installed = false;
  constructor(
    private readonly browser: BrowserContext,
    private readonly environment: EnvironmentConfig,
    private readonly mode: ExecutionMode,
    private readonly prefixes = readApiPrefixes(),
  ) {}

  isApi(url: URL): boolean {
    if (url.origin !== this.environment.apiBaseURL) return false;
    if (this.environment.apiBaseURL !== this.environment.frontendBaseURL) return true;
    return this.prefixes.some(
      (prefix) =>
        prefix === '/' || url.pathname === prefix || url.pathname.startsWith(prefix + '/'),
    );
  }

  private readonly failedRequest = (request: Request): void => {
    if (this.mode !== 'frontend-mocked' && this.isApi(new URL(request.url()))) {
      this.issues.add('Backend connection failed; check the configured API service and network');
    }
  };

  private readonly route = async (route: Route): Promise<void> => {
    const request = route.request();
    const url = new URL(request.url());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !this.environment.allowedHosts.includes(url.host)
    ) {
      this.issues.add('Browser request blocked: target host is not allowlisted');
      await route.abort('blockedbyclient');
      return;
    }
    const mock = this.mocks.get(`${request.method()} ${url.href}`);
    if (this.mode === 'frontend-mocked' && mock) {
      if (mock.delay) await setTimeout(mock.delay);
      await route.fulfill({
        status: mock.status,
        headers: { 'content-type': 'application/json', ...mock.headers },
        ...(mock.body !== undefined ? { body: JSON.stringify(mock.body) } : {}),
      });
      return;
    }
    if (this.mode === 'frontend-mocked' && this.isApi(url)) {
      // Avoid including URL/query values or credentials in reports.
      this.issues.add(
        `Missing mock handler for ${request.method()} application API request; check mock.api URL, query and method`,
      );
      await route.abort('blockedbyclient');
      return;
    }
    // Browser-level continuation does not re-route redirect chains. Fetch a single
    // response and reject HTTP redirects before the browser can follow any hop.
    try {
      const response = await route.fetch({ maxRedirects: 0 });
      try {
        const location = response.headers().location;
        if (response.status() >= 300 && response.status() < 400 && location) {
          this.issues.add(
            'HTTP redirect blocked by browser isolation; use the final URL or client-side navigation',
          );
          await route.abort('blockedbyclient');
          return;
        }
        await route.fulfill({ response });
      } finally {
        await response.dispose();
      }
    } catch {
      this.issues.add(
        this.isApi(url)
          ? 'Backend connection failed; check the configured API service and network'
          : 'Frontend resource request failed; check service availability',
      );
      await route.abort('failed').catch(() => undefined);
    }
  };

  async install(): Promise<void> {
    if (this.installed) return;
    if (this.mode === 'backend') throw new Error('Backend tests must not create browser contexts');
    this.installed = true;
    await this.browser.route('**/*', this.route);
    this.browser.on('requestfailed', this.failedRequest);
    await this.browser.routeWebSocket(/.*/, async (socket) => {
      const url = new URL(socket.url());
      const allowed = this.environment.allowedHosts.includes(url.host);
      if (this.mode === 'frontend-mocked' || !allowed) {
        this.issues.add('WebSocket blocked by execution mode or target allowlist');
        await socket.close();
      } else socket.connectToServer();
    });
  }

  addMock(parameters: ActionParameters['mock.api']): void {
    if (this.mode !== 'frontend-mocked') throw new Error('Mocks require frontend-mocked mode');
    if (
      parameters.status >= 300 &&
      parameters.status < 400 &&
      Object.keys(parameters.headers ?? {}).some((key) => key.toLowerCase() === 'location')
    ) {
      throw new Error('HTTP redirect mocks are unsupported by browser isolation');
    }
    const url = resolveTargetURL(parameters.url, 'api', this.environment);
    this.mocks.set(`${parameters.method} ${url}`, structuredClone(parameters));
  }

  assertHealthy(): void {
    if (this.issues.size) throw new Error([...this.issues].join('\n'));
  }

  async dispose(): Promise<void> {
    if (!this.installed) return;
    this.installed = false;
    this.browser.off('requestfailed', this.failedRequest);
    await this.browser.unroute('**/*', this.route);
    this.mocks.clear();
    this.assertHealthy();
  }
}
