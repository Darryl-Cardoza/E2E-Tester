import type { ActionRegistry } from './registry.js';

export function registerDataActions(registry: ActionRegistry): void {
  registry.register('data.generate', (p, c) => {
    c.variables.generated[p.saveAs] = c.data.generate(p.kind, p.prefix);
    return Promise.resolve();
  });
  registry.register('data.create', async (p, c) => {
    if (c.mode === 'frontend-mocked')
      throw new Error('Live test-data setup is forbidden in mocked mode');
    c.variables.generated[p.saveAs] = await c.data.create(p.resource, p.body, p.auth);
  });
}
