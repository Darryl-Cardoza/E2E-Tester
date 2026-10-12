import type { ActionRegistry } from './registry.js';
import type { JsonValue } from '../types/scenario.js';

export function registerApiActions(registry: ActionRegistry): void {
  registry.register('api.request', async (p, c) => {
    if (c.mode === 'frontend-mocked')
      throw new Error('Direct API calls are forbidden in mocked frontend mode');
    const response = await c.api.send(p);
    if (p.saveAs) {
      c.responses.set(p.saveAs, response);
      c.variables.responses[p.saveAs] = response as unknown as JsonValue;
    }
  });
}
