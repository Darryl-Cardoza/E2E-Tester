import { test, expect } from '@playwright/test';
import { readEnvironment } from '../../config/environments.js';
import { readRuntime } from '../../config/runtime.js';
import { createProjects } from '../../config/test-projects.js';
import { resolveTargetURL } from '../../framework/runtime/environment-manager.js';

test('local demo targets loopback and rejects external overrides', () => {
  expect(readEnvironment({}).apiBaseURL).toBe('http://127.0.0.1:4173');
  expect(() => readEnvironment({ API_BASE_URL: 'https://external.test' })).toThrow(
    'fixed loopback',
  );
});

test('unknown environments and incomplete external configuration fail closed', () => {
  expect(() => readEnvironment({ TEST_ENV: 'production' })).toThrow('TEST_ENV');
  expect(() => readEnvironment({ TEST_ENV: 'staging' })).toThrow('require');
});

const external = {
  TEST_ENV: 'staging',
  FRONTEND_BASE_URL: 'https://app.example.test',
  API_BASE_URL: 'https://api.example.test',
  ALLOWED_TARGET_HOSTS: 'app.example.test,api.example.test',
};

test('external origins require an exact allowlist match', () => {
  expect(readEnvironment(external).name).toBe('staging');
  expect(() => readEnvironment({ ...external, ALLOWED_TARGET_HOSTS: 'example.test' })).toThrow(
    'host',
  );
});

for (const url of [
  'file:///tmp',
  'https://secret:password@app.example.test',
  'https://app.example.test/path',
  'invalid',
]) {
  test(`reject invalid base URL ${url.split(':')[0] ?? 'unknown'} ${url.length}`, () => {
    expect(() => readEnvironment({ ...external, FRONTEND_BASE_URL: url })).toThrow();
    try {
      readEnvironment({ ...external, FRONTEND_BASE_URL: url });
    } catch (error) {
      expect(String(error)).not.toContain('password');
    }
  });
}

test('relative API paths preserve queries', () => {
  expect(resolveTargetURL('/api/users?limit=2', 'api', readEnvironment(external))).toBe(
    'https://api.example.test/api/users?limit=2',
  );
});

for (const path of [
  'https://evil.test',
  '//evil.test',
  '/\\evil.test',
  '/../private',
  '/%2e%2e/private',
  '/%252e/private',
  '/a\n',
]) {
  test(`reject unsafe path ${JSON.stringify(path)}`, () => {
    expect(() => resolveTargetURL(path, 'api', readEnvironment({}))).toThrow('root-relative');
  });
}

test('runtime validates integers and browser selection', () => {
  expect(readRuntime({ CI: 'true' }).retries).toBe(2);
  expect(readRuntime({ CI: 'false' }).retries).toBe(0);
  for (const value of ['0', '-1', 'NaN', '', '1.2']) {
    expect(() => readRuntime({ WORKERS: value })).toThrow('WORKERS');
  }
  expect(() => readRuntime({ BROWSER: 'unknown' })).toThrow('BROWSER');
});

test('projects separate categories and require explicit frontend eligibility tags', () => {
  const projects = createProjects(readEnvironment({}), readRuntime({}));
  expect(projects.map((project) => project.name)).toEqual([
    'frontend-mocked',
    'frontend-live',
    'backend',
    'journeys',
  ]);
  expect(projects[0]?.grep).toEqual(/@frontend-mocked(?=\s|$)/);
  expect(projects[1]?.grep).toEqual(/@frontend-live(?=\s|$)/);
  expect(projects[2]?.testMatch).toContain('**/tests/typescript/backend/**/*.spec.ts');
  expect(projects[3]?.testMatch).toContain('**/tests/typescript/journeys/**/*.spec.ts');
});
