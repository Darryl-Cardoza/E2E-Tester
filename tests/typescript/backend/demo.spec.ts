import { test, expect } from '../../../framework/fixtures/test-fixtures.js';

test('[TS-API-BOUNDARY] normal users cannot create test identities', async ({
  scenarioContext,
}) => {
  const response = await scenarioContext.api.send({
    method: 'POST',
    path: '/api/test-users',
    auth: 'test-user',
    body: {},
  });
  expect(response.status).toBe(403);
});
test('[TS-API-ERROR] controlled server failure is observable', async ({ scenarioContext }) => {
  const response = await scenarioContext.api.send({ method: 'GET', path: '/api/error' });
  expect(response.status).toBe(500);
  expect(response.headers['content-type']).toContain('application/json');
});
