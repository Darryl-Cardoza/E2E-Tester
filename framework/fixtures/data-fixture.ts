import { randomUUID } from 'node:crypto';
import type { ApiClient } from '../clients/api-client.js';
import type { JsonValue } from '../types/scenario.js';
import { dataResources } from '../../config/data-resources.js';
import { CategorizedError } from '../reporting/failure-category.js';

export class TestData {
  readonly owner = `e2e-${randomUUID()}`;
  private readonly records: { path: string; id: string; auth?: string }[] = [];
  constructor(
    private readonly api: ApiClient,
    private readonly resources = dataResources,
  ) {}

  generate(kind: 'uuid' | 'email' | 'string', prefix = 'qa'): string {
    if (!/^[A-Za-z0-9_-]{0,64}$/.test(prefix)) throw new Error('Invalid synthetic data prefix');
    const id = randomUUID();
    return kind === 'uuid' ? id : `${prefix}-${id}${kind === 'email' ? '@example.test' : ''}`;
  }

  async create(
    resource: string,
    body: Record<string, JsonValue>,
    auth?: string,
  ): Promise<JsonValue> {
    if (!Object.hasOwn(this.resources, resource))
      throw new Error('Test-data resource is not configured');
    const configuration = this.resources[resource];
    if (!configuration) throw new Error('Test-data resource is not configured');
    const response = await this.api.send({
      method: 'POST',
      path: configuration.path,
      body: { ...body, testOwner: this.owner },
      ...(auth ? { auth } : {}),
    });
    if (response.status < 200 || response.status >= 300)
      throw new Error('Test-data setup failed: create request was not successful');
    const result = response.body;
    if (
      !result ||
      Array.isArray(result) ||
      typeof result !== 'object' ||
      typeof result.id !== 'string' ||
      !/^[A-Za-z0-9_-]+$/.test(result.id)
    ) {
      throw new Error(
        'Test-data setup returned no safe record ID; manual ownership-based reconciliation may be required',
      );
    }
    this.records.push({ path: configuration.path, id: result.id, ...(auth ? { auth } : {}) });
    if (result.testOwner !== this.owner)
      throw new Error('Created record did not confirm scenario ownership');
    return structuredClone(result);
  }

  async cleanup(): Promise<void> {
    const errors: Error[] = [];
    for (const record of [...this.records].reverse()) {
      try {
        const path = `${record.path}/${record.id}`;
        const auth = record.auth ? { auth: record.auth } : {};
        const current = await this.api.send({ method: 'GET', path, ...auth });
        if (current.status !== 404) {
          const body = current.body;
          if (
            current.status !== 200 ||
            !body ||
            Array.isArray(body) ||
            typeof body !== 'object' ||
            body.id !== record.id ||
            body.testOwner !== this.owner
          )
            throw new Error('ownership check failed');
          const result = await this.api.send({
            method: 'DELETE',
            path,
            headers: { 'X-Test-Owner': this.owner },
            ...auth,
          });
          if (![200, 204, 404].includes(result.status)) throw new Error('delete failed');
          if ((await this.api.send({ method: 'GET', path, ...auth })).status !== 404)
            throw new Error('deletion was not confirmed');
        }
        this.records.splice(this.records.indexOf(record), 1);
      } catch {
        errors.push(
          new CategorizedError(
            'setup-cleanup',
            `Owned-record cleanup failed for ${record.path}/${record.id}; verify service availability and testOwner before retrying`,
          ),
        );
      }
    }
    if (errors.length)
      throw new AggregateError(errors, errors.map((error) => error.message).join('\n'));
  }
}
