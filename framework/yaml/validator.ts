import { readFileSync } from 'node:fs';
import { Ajv } from 'ajv';
import type { ErrorObject } from 'ajv';
import type { Scenario, LoadedScenario } from '../types/scenario.js';

const schema: object = JSON.parse(
  readFileSync(new URL('../../schemas/test-case.v1.schema.json', import.meta.url), 'utf8'),
) as object;
const ajv = new Ajv({ allErrors: true, strict: true, discriminator: true });
const validate = ajv.compile<Scenario>(schema);
const validateStepSchema = ajv.compile<import('../types/scenario.js').Step>({
  $ref: 'https://example.test/schemas/test-case.v1.schema.json#/$defs/step',
});

export function validateStep(value: unknown): asserts value is import('../types/scenario.js').Step {
  if (!validateStepSchema(value)) {
    throw new Error(
      `Invalid action parameters: ${(validateStepSchema.errors ?? []).map(describe).join('; ')}`,
    );
  }
}

function describe(error: ErrorObject): string {
  // Do not interpolate instance values or enum/const contents into diagnostics.
  return `${error.instancePath || '/'}: ${error.keyword} ${error.message ?? 'validation failed'}`;
}

export function validateScenario(value: unknown, filePath: string): Scenario {
  if (!validate(value)) {
    throw new Error(
      `${filePath}: invalid test definition\n${(validate.errors ?? []).map(describe).join('\n')}`,
    );
  }
  if (
    value.tags.some((tag) =>
      ['frontend-mocked', 'frontend-live', 'backend', 'journeys'].includes(tag),
    )
  ) {
    throw new Error(
      `${filePath}: /tags: execution-mode tags are reserved; use modes for frontend eligibility`,
    );
  }
  if (
    value.browserAuth &&
    (value.type === 'backend' ||
      (value.type === 'frontend' && value.modes.includes('frontend-mocked')))
  ) {
    throw new Error(
      `${filePath}: /browserAuth: browser authentication requires live frontend or journey execution`,
    );
  }
  for (const section of ['setup', 'steps', 'teardown'] as const) {
    for (const [index, step] of (value[section] ?? []).entries()) {
      if (
        step.action === 'mock.api' &&
        (value.type !== 'frontend' || value.modes.some((mode) => mode !== 'frontend-mocked'))
      ) {
        throw new Error(
          `${filePath}: /${section}/${index}/action: mock.api requires exclusively frontend-mocked eligibility`,
        );
      }
      if (
        value.type === 'backend' &&
        (step.action.startsWith('ui.') || 'target' in step || step.action === 'assert.url')
      ) {
        throw new Error(
          `${filePath}: /${section}/${index}/action: backend scenarios cannot use browser actions`,
        );
      }
    }
  }
  return value;
}

export function validateUniqueIds(scenarios: readonly LoadedScenario[]): void {
  const seen = new Map<string, string>();
  for (const { filePath, scenario } of scenarios) {
    const previous = seen.get(scenario.id);
    if (previous)
      throw new Error(`${filePath}: /id: duplicate test ID; first defined in ${previous}`);
    seen.set(scenario.id, filePath);
  }
}
