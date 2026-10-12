import { test, expect } from '../../../../framework/fixtures/test-fixtures.js';
import { targetEnvironment } from '../../environment.js';
test.use({ targetEnvironment });
test('native journey uses browser and real API', async ({ page, scenarioContext }) => {
  expect(() =>
    scenarioContext.browserPolicy.addMock({ method: 'GET', url: '/api/value', status: 200 }),
  ).toThrow('Mocks require');
  await page.goto(targetEnvironment.frontendBaseURL);
  await page.getByRole('button', { name: 'Load' }).click();
  await expect(page.locator('output')).toHaveText('live');
  expect((await scenarioContext.api.send({ method: 'GET', path: '/api/value' })).status).toBe(200);
});
