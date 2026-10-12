import type { APIRequestContext } from '@playwright/test';
import type { ActionParameters, JsonValue } from '../types/scenario.js';
import type { EnvironmentConfig } from '../../config/environments.js';
import { resolveTargetURL } from '../runtime/environment-manager.js';
import type { ExecutionMode } from '../../config/test-projects.js';
import type { Authentication } from '../fixtures/auth-fixture.js';

export interface SavedResponse {
  status: number;
  headers: Record<string, string>;
  body: JsonValue;
  durationMs: number;
}
export type AuthenticationProfiles = Readonly<Record<string, Readonly<Record<string, string>>>>;

export class ApiClient {
  constructor(
    private readonly request: APIRequestContext,
    private readonly environment: EnvironmentConfig,
    private readonly timeout: number,
    private readonly profiles: AuthenticationProfiles = {},
    private readonly mode: ExecutionMode = 'backend',
    private readonly authentication?: Authentication,
  ) {}

  async send(parameters: ActionParameters['api.request']): Promise<SavedResponse> {
    if (this.mode === 'frontend-mocked')
      throw new Error('Direct API calls are forbidden in mocked frontend mode');
    const url = resolveTargetURL(parameters.path, 'api', this.environment);
    const auth = parameters.auth;
    if (auth && !this.authentication && !Object.hasOwn(this.profiles, auth))
      throw new Error('Authentication profile is not configured');
    const start = performance.now();
    const request =
      auth && this.authentication ? await this.authentication.context(auth) : this.request;
    const response = await request.fetch(url, {
      method: parameters.method,
      headers: { ...parameters.headers, ...(auth ? this.profiles[auth] : {}) },
      ...(parameters.query ? { params: parameters.query } : {}),
      ...(parameters.body !== undefined
        ? { data: parameters.body === null ? 'null' : parameters.body }
        : {}),
      timeout: parameters.timeout ?? this.timeout,
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    try {
      const text = await response.text();
      let body: JsonValue = text;
      if (response.headers()['content-type']?.includes('json') && text)
        body = JSON.parse(text) as JsonValue;
      return {
        status: response.status(),
        headers: response.headers(),
        body,
        durationMs: performance.now() - start,
      };
    } finally {
      await response.dispose();
    }
  }
}
