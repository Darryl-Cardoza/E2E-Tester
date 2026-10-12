import { ActionRegistry } from './registry.js';
import { registerUiActions } from './ui-actions.js';
import { registerApiActions } from './api-actions.js';
import { registerAssertionActions } from './assertion-actions.js';
import { registerMockActions } from './mock-actions.js';
import { registerDataActions } from './data-actions.js';

export function createActionRegistry(): ActionRegistry {
  const registry = new ActionRegistry();
  registerUiActions(registry);
  registerApiActions(registry);
  registerAssertionActions(registry);
  registerMockActions(registry);
  registerDataActions(registry);
  return registry;
}
