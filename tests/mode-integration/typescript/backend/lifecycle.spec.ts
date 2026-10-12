import { test as base, expect } from '../../../../framework/fixtures/test-fixtures.js';
import { startLifecycleServer } from '../../../support/lifecycle-server.js';
import { executeScenario } from '../../../../framework/yaml/interpreter.js';

const test = base.extend({
  // Playwright requires destructuring to infer this fixture's empty dependency list.
  // eslint-disable-next-line no-empty-pattern
  targetEnvironment: async ({}, use) => {
    const server = await startLifecycleServer();
    try {
      await use(server.environment);
      expect(server.records.size).toBe(0);
    } finally {
      await server.close();
    }
  },
});
test.use({ launchOptions: { executablePath: 'intentionally-missing-browser' } });

test('shared fixture automatically cleans successful native setup', async ({ scenarioContext }) => {
  const record = await scenarioContext.data.create('test-users', {
    email: scenarioContext.data.generate('email'),
  });
  expect(record).toHaveProperty('testOwner', scenarioContext.data.owner);
});

test('shared fixture automatically cleans after a YAML action failure', async ({
  scenarioContext,
}) => {
  await expect(
    executeScenario(
      {
        schemaVersion: 1,
        id: 'FIXTURE-CLEANUP',
        title: 'fixture cleanup',
        type: 'backend',
        tags: [],
        steps: [
          {
            action: 'data.create',
            resource: 'test-users',
            body: { email: 'qa@example.test' },
            saveAs: 'user',
          },
          { action: 'assert.status', from: 'missing-response', equals: 200 },
        ],
      },
      scenarioContext,
      'fixture-cleanup.yaml',
      undefined,
      (_title, body) => body(),
    ),
  ).rejects.toThrow('assertion failed');
});
