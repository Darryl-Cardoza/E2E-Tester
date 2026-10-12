import type { ActionName, ActionParameters, Step } from '../types/scenario.js';
import type { ScenarioContext } from '../runtime/scenario-context.js';
import { validateStep } from '../yaml/validator.js';
import { CategorizedError } from '../reporting/failure-category.js';

export type ActionHandler<K extends ActionName> = (
  parameters: ActionParameters[K],
  context: ScenarioContext,
) => Promise<void>;
export class ActionRegistry {
  private readonly handlers = new Map<
    ActionName,
    (step: Step, context: ScenarioContext) => Promise<void>
  >();
  register<K extends ActionName>(name: K, handler: ActionHandler<K>): this {
    if (this.handlers.has(name)) throw new Error('Action is already registered');
    // Dispatch uses the same validated action key as registration.
    this.handlers.set(name, (step, context) =>
      handler(step as unknown as ActionParameters[K], context),
    );
    return this;
  }
  async execute(value: unknown, context: ScenarioContext): Promise<void> {
    validateStep(value);
    const handler = this.handlers.get(value.action);
    if (!handler)
      throw new CategorizedError('invalid-definition', 'Action handler is not registered');
    await handler(value, context);
  }
}
