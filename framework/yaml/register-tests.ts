import { resolve } from 'node:path';
import type { TestInfo } from '@playwright/test';
import { test } from '../fixtures/test-fixtures.js';
import { loadScenarios } from './loader.js';
import { executeScenario } from './interpreter.js';
import type { Scenario } from '../types/scenario.js';
import type { ScenarioContext } from '../runtime/scenario-context.js';

export function registerYamlTests(category: Scenario['type'], root = resolve('tests/yaml')): void {
  // Load the entire collection before category filtering, so duplicates cannot hide across projects.
  for (const { scenario, filePath } of loadScenarios(root).filter(
    (item) => item.scenario.type === category,
  )) {
    const title = `[${scenario.id}] ${scenario.title}`;
    const tag = [
      ...scenario.tags.map((value) => `@${value}`),
      ...(scenario.type === 'frontend' ? scenario.modes.map((mode) => `@${mode}`) : []),
    ];
    const run = async (context: ScenarioContext, info: TestInfo): Promise<void> => {
      if (scenario.timeout) info.setTimeout(scenario.timeout);
      Object.assign(context.variables.data, structuredClone(scenario.testData ?? {}));
      info.annotations.push(
        { type: 'test-id', description: scenario.id },
        { type: 'authoring', description: 'yaml' },
        { type: 'source', description: filePath },
        { type: 'category', description: scenario.type },
      );
      await executeScenario(scenario, context, filePath);
    };
    if (category === 'backend') {
      test(title, { tag }, async ({ scenarioContext }, info) => {
        await run(scenarioContext, info);
      });
    } else {
      test(title, { tag }, async ({ scenarioContext, page, authentication }, info) => {
        await scenarioContext.attachPage(page);
        if (scenario.browserAuth)
          await authentication.applyToBrowser(scenario.browserAuth, page.context());
        await run(scenarioContext, info);
      });
    }
  }
}
