import { test, expect } from '@playwright/test';
import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import { VariableResolver, readJsonPath } from '../../framework/runtime/variable-resolver.js';
import { ScenarioContext } from '../../framework/runtime/scenario-context.js';
import { ApiClient } from '../../framework/clients/api-client.js';
import { ActionRegistry } from '../../framework/actions/registry.js';
import { createActionRegistry } from '../../framework/actions/default-registry.js';
import { executeScenario } from '../../framework/yaml/interpreter.js';
import { readEnvironment } from '../../config/environments.js';
import type { Scenario } from '../../framework/types/scenario.js';
import { scrubSecrets } from '../../framework/reporting/secret-scrubber.js';

test('variables preserve typed values, isolate scenarios and restrict namespaces', () => {
  const variables = new VariableResolver({
    TEST_EMAIL: 'qa@example.test',
    TEST_PASSWORD: 'private-value',
    HOME: 'not-allowed',
  });
  variables.generated.count = 3;
  variables.responses.user = { body: { items: [true] } };
  expect(variables.resolve('${TEST_EMAIL}')).toBe('qa@example.test');
  expect(
    variables.resolve({ count: '${generated.count}', active: '${responses.user.body.items[0]}' }),
  ).toEqual({ count: 3, active: true });
  expect(variables.resolve('item-${generated.count}')).toBe('item-3');
  for (const reference of [
    '${HOME}',
    '${MISSING}',
    '${env.PATH}',
    '${generated.constructor}',
    '${generated.missing}',
    '${bad',
  ])
    expect(() => variables.resolve(reference)).toThrow();
  expect(() => new VariableResolver({}).resolve('${generated.count}')).toThrow();
  variables.generated.loop = '${generated.loop}';
  expect(() => variables.resolve('${generated.loop}')).toThrow('Recursive');
  expect(() => readJsonPath({}, '$.constructor')).toThrow();
  expect(() => readJsonPath({}, '$[?(@.x)]')).toThrow('Unsupported');
});

test('registry validates parameters, rejects duplicates and unknown actions, and propagates failures', async ({
  request,
}) => {
  const environment = readEnvironment({});
  const context = new ScenarioContext(
    environment,
    'backend',
    new ApiClient(request, environment, 1000),
  );
  const registry = new ActionRegistry();
  let called = false;
  registry.register('data.generate', () => {
    called = true;
    return Promise.resolve();
  });
  await registry.execute({ action: 'data.generate', kind: 'uuid', saveAs: 'id' }, context);
  expect(called).toBe(true);
  expect(() => registry.register('data.generate', () => Promise.resolve())).toThrow('already');
  await expect(registry.execute({ action: 'shell.exec' }, context)).rejects.toThrow(
    'Invalid action',
  );
  await expect(registry.execute({ action: 'data.generate', kind: 3 }, context)).rejects.toThrow(
    'Invalid action',
  );
  await expect(
    registry.execute({ action: 'assert.status', from: 'x', equals: 200 }, context),
  ).rejects.toThrow('not registered');
  const failed = new ActionRegistry().register('data.generate', () =>
    Promise.reject(new Error('handler failure')),
  );
  await expect(
    failed.execute({ action: 'data.generate', kind: 'uuid', saveAs: 'id' }, context),
  ).rejects.toThrow('handler failure');
});

test('interpreter executes real HTTP requests, chains typed responses and evaluates API assertions', async ({
  request,
}) => {
  let redirected = false;
  const server = createServer((req, res) => {
    if (req.url === '/redirect') {
      res.writeHead(302, { location: '/forbidden' });
      res.end();
      return;
    }
    if (req.url === '/forbidden') redirected = true;
    res.writeHead(200, { 'content-type': 'application/json', 'x-test': 'yes' });
    res.end(
      JSON.stringify({
        email: 'qa@example.test',
        method: req.method,
        authorized: req.headers.authorization === 'Bearer local-token',
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = (server.address() as AddressInfo).port;
  const origin = `http://127.0.0.1:${port}`;
  const environment = {
    ...readEnvironment({}),
    apiBaseURL: origin,
    allowedHosts: [`127.0.0.1:${port}`],
  };
  const context = new ScenarioContext(
    environment,
    'backend',
    new ApiClient(request, environment, 2000, { qa: { Authorization: 'Bearer local-token' } }),
  );
  const scenario: Scenario = {
    schemaVersion: 1,
    id: 'ENGINE-API',
    title: 'API engine',
    type: 'backend',
    tags: [],
    steps: [
      { action: 'api.request', method: 'GET', path: '/me', auth: 'qa', saveAs: 'profile' },
      { action: 'assert.status', from: 'profile', equals: 200 },
      { action: 'assert.json', from: 'profile', path: '$.authorized', equals: true },
      { action: 'assert.header', from: 'profile', header: 'X-Test', equals: 'yes' },
      { action: 'assert.responseTime', from: 'profile', lessThan: 2000 },
      {
        action: 'api.request',
        method: 'POST',
        path: '/users',
        body: { email: '${responses.profile.body.email}' },
        saveAs: 'created',
      },
      { action: 'assert.json', from: 'created', path: '$.method', equals: 'POST' },
      { action: 'api.request', method: 'GET', path: '/redirect', saveAs: 'redirect' },
      { action: 'assert.status', from: 'redirect', equals: 302 },
    ],
  };
  try {
    await executeScenario(scenario, context, 'engine.yaml');
    expect(redirected).toBe(false);
    await expect(context.api.send({ method: 'GET', path: 'https://outside.test' })).rejects.toThrow(
      'root-relative',
    );
    await expect(context.api.send({ method: 'GET', path: '/', auth: 'unknown' })).rejects.toThrow(
      'not configured',
    );
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => (error ? reject(error) : resolve())),
    );
  }
});

test('teardown continues after failures, preserves primary failure, and excludes secret payloads', async ({
  request,
}) => {
  const environment = readEnvironment({});
  const context = new ScenarioContext(
    environment,
    'backend',
    new ApiClient(request, environment, 1000),
  );
  const registry = new ActionRegistry();
  const calls: string[] = [];
  registry.register('data.generate', (p) => {
    calls.push(p.saveAs);
    return p.saveAs === 'last' ? Promise.resolve() : Promise.reject(new Error('SECRET'));
  });
  const scenario: Scenario = {
    schemaVersion: 1,
    id: 'FAILURE',
    title: 'failure',
    type: 'backend',
    tags: [],
    steps: [{ action: 'data.generate', kind: 'uuid', saveAs: 'main' }],
    teardown: [
      { action: 'data.generate', kind: 'uuid', saveAs: 'cleanup' },
      { action: 'data.generate', kind: 'uuid', saveAs: 'last' },
    ],
  };
  const result = executeScenario(scenario, context, 'failure.yaml', registry, (_title, body) =>
    body(),
  );
  await expect(result).rejects.toThrow('/steps/0');
  await expect(result).rejects.toThrow('/teardown/0');
  await expect(result).rejects.not.toThrow('SECRET');
  expect(calls).toEqual(['main', 'cleanup', 'last']);
});

test('generation is unique and mocks are forbidden in live execution', async ({ request }) => {
  const environment = readEnvironment({});
  const context = new ScenarioContext(
    environment,
    'journeys',
    new ApiClient(request, environment, 1000),
  );
  const registry = createActionRegistry();
  await registry.execute({ action: 'data.generate', kind: 'email', saveAs: 'first' }, context);
  await registry.execute({ action: 'data.generate', kind: 'email', saveAs: 'second' }, context);
  expect(context.variables.generated.first).not.toBe(context.variables.generated.second);
  await expect(
    registry.execute({ action: 'mock.api', method: 'GET', url: '/', status: 200 }, context),
  ).rejects.toThrow('Mocks require');
  const calls: number[] = [];
  context.cleanup.push(
    () => {
      calls.push(1);
      return Promise.resolve();
    },
    () => {
      calls.push(2);
      return Promise.reject(new Error('private'));
    },
  );
  await expect(context.dispose()).rejects.toThrow('cleanup failed');
  expect(calls).toEqual([2, 1]);
});

test('report scrubbing removes credentials from raw, JSON and XML forms', () => {
  const secret = 'pa"ss&<word>';
  const text = `raw ${secret} json ${JSON.stringify(secret).slice(1, -1)} xml pa&quot;ss&amp;&lt;word&gt;`;
  const scrubbed = scrubSecrets(text, [secret, '']);
  expect(scrubbed).toBe('raw [REDACTED] json [REDACTED] xml [REDACTED]');
  expect(scrubSecrets('no secrets here', [])).toBe('no secrets here');
});
