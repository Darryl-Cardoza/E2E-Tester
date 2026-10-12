import { test } from '@playwright/test';
import type { Scenario, Step } from '../types/scenario.js';
import type { ScenarioContext } from '../runtime/scenario-context.js';
import { createActionRegistry } from '../actions/default-registry.js';
import type { ActionRegistry } from '../actions/registry.js';
import { CategorizedError, categorizeFailure } from '../reporting/failure-category.js';

export type StepRunner = (title: string, body: () => Promise<void>) => Promise<void>;

export async function executeScenario(
  scenario: Scenario,
  context: ScenarioContext,
  filePath: string,
  registry: ActionRegistry = createActionRegistry(),
  runStep: StepRunner = (title, body) => test.step(title, body),
): Promise<void> {
  if (
    scenario.type === 'frontend'
      ? !scenario.modes.includes(context.mode as 'frontend-mocked' | 'frontend-live')
      : scenario.type !== context.mode
  ) {
    throw new Error('Scenario is not eligible for this execution mode');
  }
  const errors: Error[] = [];
  const execute = async (step: Step, section: string, index: number): Promise<void> => {
    // Names and values are deliberately excluded from generated titles.
    const location = `${filePath}: /${section}/${index} (${step.action})`;
    await runStep(location, async () => {
      let resolved;
      try {
        resolved = context.variables.resolve(step);
      } catch {
        throw new CategorizedError(
          'invalid-definition',
          `${location}: variable could not be resolved`,
        );
      }
      try {
        await registry.execute(resolved, context);
      } catch (error) {
        const category = categorizeFailure(error);
        const kind = step.action.startsWith('assert.') ? 'assertion' : 'action';
        throw new CategorizedError(
          category,
          `${location}: ${kind} failed; check parameters, variables, target state and connectivity`,
        );
      }
    });
  };
  try {
    for (const [index, step] of (scenario.setup ?? []).entries())
      await execute(step, 'setup', index);
    for (const [index, step] of scenario.steps.entries()) await execute(step, 'steps', index);
  } catch (error) {
    errors.push(error instanceof Error ? error : new Error('Scenario failed'));
  } finally {
    for (const [index, step] of (scenario.teardown ?? []).entries()) {
      try {
        await execute(step, 'teardown', index);
      } catch {
        errors.push(
          new CategorizedError(
            'setup-cleanup',
            `${filePath}: /teardown/${index}: cleanup action failed`,
          ),
        );
      }
    }
  }
  if (errors.length)
    test.info().annotations.push({
      type: 'failure-category',
      description: [...new Set(errors.map((error) => categorizeFailure(error)))].join(','),
    });
  if (errors.length === 1 && errors[0]) throw errors[0];
  if (errors.length)
    throw new AggregateError(errors, errors.map((error) => error.message).join('\n'));
}
