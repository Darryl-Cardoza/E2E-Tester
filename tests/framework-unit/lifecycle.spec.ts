import { test, expect } from '@playwright/test';
import { Authentication, readAuthProfiles } from '../../framework/fixtures/auth-fixture.js';
import { ApiClient } from '../../framework/clients/api-client.js';
import { TestData } from '../../framework/fixtures/data-fixture.js';
import { ScenarioContext } from '../../framework/runtime/scenario-context.js';
import { executeScenario } from '../../framework/yaml/interpreter.js';
import { validateScenario } from '../../framework/yaml/validator.js';
import { startLifecycleServer } from '../support/lifecycle-server.js';

test('browser authentication is accepted only for live browser categories', () => {
  const definition = {
    schemaVersion: 1,
    id: 'AUTH-SCHEMA',
    title: 'session',
    tags: [],
    browserAuth: 'test-session',
    steps: [{ action: 'ui.navigate', path: '/' }],
  };
  expect(() =>
    validateScenario({ ...definition, type: 'frontend', modes: ['frontend-live'] }, 'auth.yaml'),
  ).not.toThrow();
  expect(() =>
    validateScenario({ ...definition, type: 'frontend', modes: ['frontend-mocked'] }, 'auth.yaml'),
  ).toThrow('/browserAuth');
  expect(() => validateScenario({ ...definition, type: 'backend' }, 'auth.yaml')).toThrow(
    '/browserAuth',
  );
});

test('named bearer and session profiles are reusable, isolated, and preserve expired-token responses', async ({
  playwright,
  request,
}) => {
  const server = await startLifecycleServer();
  const auth = new Authentication(playwright.request, server.environment, 'backend', {
    user: { kind: 'bearer', token: server.credentials.userToken },
    admin: { kind: 'bearer', token: server.credentials.adminToken },
    expired: { kind: 'bearer', token: 'synthetic-expired-token' },
    session: {
      kind: 'session',
      path: '/login',
      email: server.credentials.email,
      password: server.credentials.password,
    },
  });
  const api = new ApiClient(request, server.environment, 2000, {}, 'backend', auth);
  try {
    expect((await api.send({ method: 'GET', path: '/me', auth: 'user' })).body).toEqual({
      role: 'user',
    });
    expect((await api.send({ method: 'GET', path: '/me', auth: 'admin' })).body).toEqual({
      role: 'admin',
    });
    expect((await api.send({ method: 'GET', path: '/me', auth: 'expired' })).status).toBe(401);
    const sessions = await Promise.all([auth.context('session'), auth.context('session')]);
    expect(sessions[0]).toBe(sessions[1]);
    expect(server.logins()).toBe(1);
    expect((await api.send({ method: 'GET', path: '/me', auth: 'session' })).status).toBe(200);
    expect((await api.send({ method: 'GET', path: '/me' })).status).toBe(401);
    await expect(auth.context('unknown')).rejects.toThrow('not configured');
  } finally {
    await auth.dispose();
    await server.close();
  }
});

test('environment credentials select the active environment and session failures omit credentials', async ({
  playwright,
}) => {
  const server = await startLifecycleServer();
  const env = { ...server.environment, name: 'staging' as const };
  expect(
    readAuthProfiles(env, {
      STAGING_TEST_USER_TOKEN: 'staging-only',
      DEVELOPMENT_TEST_USER_TOKEN: 'development-only',
      TEST_USER_TOKEN: 'fallback',
    })['test-user'],
  ).toEqual({ kind: 'bearer', token: 'staging-only' });
  const auth = new Authentication(playwright.request, server.environment, 'backend', {
    bad: { kind: 'session', path: '/login', email: 'bad@example.test', password: 'DO-NOT-PRINT' },
  });
  try {
    await expect(auth.context('bad')).rejects.toThrow('Authentication setup failed');
    await expect(auth.context('bad')).rejects.not.toThrow('DO-NOT-PRINT');
    const mocked = new Authentication(
      playwright.request,
      server.environment,
      'frontend-mocked',
      {},
    );
    await expect(mocked.context('user')).rejects.toThrow('forbidden');
  } finally {
    await auth.dispose();
    await server.close();
  }
});

test('parallel owners clean only their own records and generation stays unique', async ({
  request,
}) => {
  const server = await startLifecycleServer();
  const api = new ApiClient(request, server.environment, 2000);
  const first = new TestData(api);
  const second = new TestData(api);
  try {
    expect(first.owner).not.toBe(second.owner);
    const emails = new Set(Array.from({ length: 100 }, () => first.generate('email')));
    expect(emails.size).toBe(100);
    await Promise.all([
      first.create('test-users', { email: first.generate('email') }),
      second.create('test-users', { email: second.generate('email') }),
    ]);
    expect(server.records.size).toBe(2);
    await first.cleanup();
    expect([...server.records.values()].map((record) => record.testOwner)).toEqual([second.owner]);
    await first.cleanup();
    await second.cleanup();
    expect(server.records.size).toBe(0);
    expect(server.deletes()).toBe(2);
    await expect(first.create('unconfigured', {})).rejects.toThrow('not configured');
  } finally {
    await server.close();
  }
});

test('ownership mismatch refuses deletion and cleanup failures remain retryable', async ({
  request,
}) => {
  const server = await startLifecycleServer();
  const data = new TestData(new ApiClient(request, server.environment, 2000));
  try {
    await data.create('test-users', {});
    const record = [...server.records.values()][0]!;
    record.testOwner = 'someone-else';
    await expect(data.cleanup()).rejects.toThrow('Owned-record cleanup failed');
    expect(server.deletes()).toBe(0);
    record.testOwner = data.owner;
    server.failDeletion(true);
    await expect(data.cleanup()).rejects.toThrow(record.id);
    server.failDeletion(false);
    await data.cleanup();
    expect(server.records.size).toBe(0);
  } finally {
    await server.close();
  }
});

for (const fail of [false, true]) {
  test(`YAML-created data is cleaned after ${fail ? 'failure' : 'success'}`, async ({
    request,
  }) => {
    const server = await startLifecycleServer();
    const context = new ScenarioContext(
      server.environment,
      'backend',
      new ApiClient(request, server.environment, 2000),
    );
    try {
      const execution = executeScenario(
        {
          schemaVersion: 1,
          id: 'LIFECYCLE',
          title: 'Lifecycle',
          type: 'backend',
          tags: [],
          steps: [
            {
              action: 'data.create',
              resource: 'test-users',
              body: { email: 'qa@example.test' },
              saveAs: 'user',
            },
            ...(fail ? [{ action: 'assert.status' as const, from: 'missing', equals: 200 }] : []),
          ],
        },
        context,
        'lifecycle.yaml',
        undefined,
        (_name, body) => body(),
      );
      if (fail) await expect(execution).rejects.toThrow('assertion failed');
      else await execution;
      expect(server.records.size).toBe(1);
      await context.dispose();
      expect(server.records.size).toBe(0);
    } finally {
      await context.dispose();
      await server.close();
    }
  });
}
