import { test, expect } from '../../../../framework/fixtures/test-fixtures.js';
import { targetEnvironment } from '../../environment.js';
// A browser launch would fail. This proves the API fixture has no browser dependency.
test.use({ targetEnvironment, launchOptions: { executablePath: 'intentionally-missing-browser' } });
test('native backend needs no browser', async ({ scenarioContext }) => {
  expect((await scenarioContext.api.send({ method: 'GET', path: '/api/value' })).body).toEqual({
    value: 'live',
  });
});
