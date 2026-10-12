import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { validateScenario } from '../../framework/yaml/validator.js';

interface Suite {
  suites?: Suite[];
  specs?: { title: string; tests: { projectName: string }[] }[];
}
function discover(config: string): { title: string; project: string }[] {
  const cli = createRequire(import.meta.url).resolve('@playwright/test/cli');
  const report = JSON.parse(
    execFileSync(process.execPath, [cli, 'test', '--config', config, '--list', '--reporter=json'], {
      encoding: 'utf8',
      timeout: 15000,
      env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_FILE: '', PLAYWRIGHT_JSON_OUTPUT_NAME: '' },
    }),
  ) as Suite;
  const walk = (suite: Suite): { title: string; project: string }[] => [
    ...(suite.specs ?? []).flatMap((spec) =>
      spec.tests.map((item) => ({ title: spec.title, project: item.projectName })),
    ),
    ...(suite.suites ?? []).flatMap(walk),
  ];
  return walk(report);
}

test('real discovery selects exact modes for YAML and native tests without duplicate categories', () => {
  test.setTimeout(20000);
  const tests = discover('playwright.modes.config.ts');
  expect(tests).toHaveLength(15);
  expect(tests.filter((item) => item.project === 'frontend-mocked')).toHaveLength(5);
  expect(tests.filter((item) => item.project === 'frontend-live')).toHaveLength(4);
  expect(tests.filter((item) => item.project === 'backend')).toHaveLength(4);
  expect(tests.filter((item) => item.project === 'journeys')).toHaveLength(2);
  expect(tests.some((item) => item.title.includes('not eligible'))).toBe(false);
  expect(
    tests.filter((item) => item.title.includes('MODE-MOCK')).map((item) => item.project),
  ).toEqual(['frontend-mocked']);
  expect(
    tests.filter((item) => item.title.includes('MODE-LIVE')).map((item) => item.project),
  ).toEqual(['frontend-live']);
  expect(
    tests
      .filter((item) => item.title.includes('MODE-BOTH'))
      .map((item) => item.project)
      .sort(),
  ).toEqual(['frontend-live', 'frontend-mocked']);
});

test('application discovery excludes internal mode harness tests', () => {
  test.setTimeout(20000);
  const tests = discover('playwright.config.ts');
  expect(tests).toContainEqual({
    title: '[API-USERS-001] Retrieve authenticated user',
    project: 'backend',
  });
  expect(
    tests.some((item) => item.title.includes('MODE-') || item.title.startsWith('native ')),
  ).toBe(false);
  for (const project of ['frontend-mocked', 'frontend-live', 'backend', 'journeys'])
    expect(tests.some((item) => item.project === project)).toBe(true);
});

test('YAML tags cannot override frontend mode eligibility', () => {
  expect(() =>
    validateScenario(
      {
        schemaVersion: 1,
        id: 'TAG-1',
        title: 'Tag guard',
        type: 'frontend',
        modes: ['frontend-live'],
        tags: ['frontend-mocked'],
        steps: [{ action: 'ui.navigate', path: '/' }],
      },
      'tags.yaml',
    ),
  ).toThrow('reserved');
});
