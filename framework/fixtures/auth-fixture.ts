import type { APIRequest, APIRequestContext, BrowserContext, Page } from '@playwright/test';
import type { EnvironmentConfig, EnvironmentInput } from '../../config/environments.js';
import type { ExecutionMode } from '../../config/test-projects.js';
import { resolveTargetURL } from '../runtime/environment-manager.js';

type StorageState = Awaited<ReturnType<APIRequestContext['storageState']>>;
export function scopedCredentialEnvironment(
  environment: EnvironmentConfig,
  env: EnvironmentInput = process.env,
): EnvironmentInput {
  const prefix = environment.name.toUpperCase().replaceAll('-', '_');
  return Object.fromEntries(
    [
      'TEST_EMAIL',
      'TEST_PASSWORD',
      'TEST_USER_TOKEN',
      'TEST_ADMIN_TOKEN',
      'TEST_EXPIRED_TOKEN',
      'TEST_SESSION_LOGIN_PATH',
    ].map((key) => [key, env[`${prefix}_${key}`] ?? env[key]]),
  );
}
export type AuthProfile =
  | { kind: 'bearer'; token: string }
  | { kind: 'session'; path: string; email: string; password: string };

export function readAuthProfiles(
  environment: EnvironmentConfig,
  env: EnvironmentInput = process.env,
): Record<string, AuthProfile> {
  const credentials = scopedCredentialEnvironment(environment, env);
  const value = (key: string) => credentials[key];
  const profiles: Record<string, AuthProfile> = {};
  for (const [name, key] of [
    ['test-user', 'TEST_USER_TOKEN'],
    ['test-admin', 'TEST_ADMIN_TOKEN'],
    ['expired-user', 'TEST_EXPIRED_TOKEN'],
  ] as const) {
    const token = value(key);
    if (token) profiles[name] = { kind: 'bearer', token };
  }
  const path = value('TEST_SESSION_LOGIN_PATH');
  if (path) {
    const email = value('TEST_EMAIL');
    const password = value('TEST_PASSWORD');
    if (!email || !password)
      throw new Error('Session authentication requires dedicated TEST_EMAIL and TEST_PASSWORD');
    profiles['test-session'] = { kind: 'session', path, email, password };
  }
  return profiles;
}

/** Contexts and storage state are reused only within this test, never across workers. */
export class Authentication {
  private readonly contexts = new Map<string, Promise<APIRequestContext>>();
  private readonly states = new Map<string, StorageState>();
  constructor(
    private readonly factory: APIRequest,
    private readonly environment: EnvironmentConfig,
    private readonly mode: ExecutionMode,
    private readonly profiles: Readonly<Record<string, AuthProfile>>,
    private readonly timeout = 15000,
  ) {}

  context(name: string): Promise<APIRequestContext> {
    if (this.mode === 'frontend-mocked')
      return Promise.reject(new Error('Live authentication is forbidden in mocked mode'));
    if (!Object.hasOwn(this.profiles, name) && !this.states.has(name))
      return Promise.reject(new Error('Authentication profile is not configured'));
    let pending = this.contexts.get(name);
    if (!pending) {
      pending = this.create(name);
      this.contexts.set(name, pending);
    }
    return pending;
  }

  private async create(name: string): Promise<APIRequestContext> {
    const profile = this.profiles[name];
    const state = this.states.get(name);
    const context = await this.factory.newContext({
      timeout: this.timeout,
      ...(state ? { storageState: state } : {}),
      ...(profile?.kind === 'bearer'
        ? { extraHTTPHeaders: { Authorization: `Bearer ${profile.token}` } }
        : {}),
    });
    try {
      if (profile?.kind === 'session' && !state) {
        const response = await context.post(
          resolveTargetURL(profile.path, 'api', this.environment),
          { data: { email: profile.email, password: profile.password }, maxRedirects: 0 },
        );
        try {
          if (!response.ok())
            throw new Error('Session login failed; verify dedicated credentials and endpoint');
        } finally {
          await response.dispose();
        }
      }
      return context;
    } catch {
      await context.dispose();
      throw new Error(
        'Authentication setup failed; verify profile, credentials and service availability',
      );
    }
  }

  private validateState(state: StorageState): void {
    const origins = [this.environment.frontendBaseURL, this.environment.apiBaseURL];
    const hosts = origins.map((origin) => new URL(origin).hostname);
    if (
      state.cookies.some(
        (cookie) => cookie.domain.startsWith('.') || !hosts.includes(cookie.domain),
      ) ||
      state.origins.some((origin) => !origins.includes(origin.origin))
    ) {
      throw new Error('Authentication state contains an unrelated origin or broad-domain cookie');
    }
  }

  async applyToBrowser(name: string, browser: BrowserContext): Promise<void> {
    if (this.mode === 'frontend-mocked')
      throw new Error('Live authentication is forbidden in mocked mode');
    if (this.profiles[name]?.kind === 'bearer')
      throw new Error('Bearer profiles are API-only; use a session profile or browser login');
    const state = await (await this.context(name)).storageState();
    this.validateState(state);
    await browser.addCookies(state.cookies);
    await browser.addInitScript((origins) => {
      const entry = origins.find((item) => item.origin === window.location.origin);
      for (const item of entry?.localStorage ?? [])
        window.localStorage.setItem(item.name, item.value);
    }, state.origins);
  }

  async loginInBrowser(
    name: string,
    page: Page,
    login: (page: Page) => Promise<void>,
  ): Promise<void> {
    if (this.mode === 'frontend-mocked')
      throw new Error('Live authentication is forbidden in mocked mode');
    if (this.contexts.has(name) || this.states.has(name))
      throw new Error('Authentication profile already initialized');
    await login(page);
    const state = await page.context().storageState();
    this.validateState(state);
    this.states.set(name, structuredClone(state));
  }

  async dispose(): Promise<void> {
    const outcomes = await Promise.allSettled(
      [...this.contexts.values()].map(async (pending) => {
        const context = await pending.catch(() => undefined);
        await context?.dispose();
      }),
    );
    this.contexts.clear();
    this.states.clear();
    if (outcomes.some((result) => result.status === 'rejected'))
      throw new Error('Authentication context cleanup failed');
  }
}
