import { test, expect } from '../../../../framework/fixtures/test-fixtures.js';
import { targetEnvironment } from '../../environment.js';
test.use({ targetEnvironment });

test('native mock', { tag: '@frontend-mocked' }, async ({ page, scenarioContext }) => {
  scenarioContext.browserPolicy.addMock({
    method: 'GET',
    url: '/api/value',
    status: 200,
    body: { value: 'mocked' },
  });
  await page.goto(targetEnvironment.frontendBaseURL);
  await page.getByRole('button', { name: 'Load' }).click();
  await expect(page.locator('output')).toHaveText('mocked');
  await expect(scenarioContext.api.send({ method: 'GET', path: '/api/value' })).rejects.toThrow(
    'forbidden',
  );
});
test('native live', { tag: '@frontend-live' }, async ({ page, scenarioContext }) => {
  expect(() =>
    scenarioContext.browserPolicy.addMock({ method: 'GET', url: '/api/value', status: 200 }),
  ).toThrow('Mocks require');
  await page.goto(targetEnvironment.frontendBaseURL);
  await page.getByRole('button', { name: 'Load' }).click();
  await expect(page.locator('output')).toHaveText('live');
});
test('native compatible', { tag: ['@frontend-live', '@frontend-mocked'] }, async ({ page }) => {
  await page.goto(targetEnvironment.frontendBaseURL);
  await expect(page.getByRole('heading')).toHaveText('Harness');
});
test('not eligible', { tag: '@frontend-live-extra' }, () => {
  throw new Error('Incorrect project filtering');
});

test(
  'unhandled API traffic fails even when the UI catches it',
  { tag: '@frontend-mocked' },
  async ({ page }) => {
    test.fail(true, 'Expected fixture failure for a missing mock handler');
    await page.goto(targetEnvironment.frontendBaseURL);
    await page.getByRole('button', { name: 'Load' }).click();
    await expect(page.locator('output')).toHaveText('failed');
  },
);
