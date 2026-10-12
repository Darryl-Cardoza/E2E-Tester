import type { ActionRegistry } from './registry.js';

export function registerMockActions(registry: ActionRegistry): void {
  registry.register('mock.api', (p, c) => {
    if (c.mode !== 'frontend-mocked') throw new Error('Mocks require frontend-mocked mode');
    c.browserPolicy.addMock(p);
    return Promise.resolve();
  });
}
