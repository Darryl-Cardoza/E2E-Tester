import { test, expect } from '@playwright/test';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { CategorizedError, categorizeFailure } from '../../framework/reporting/failure-category.js';
import { resolveGitCommit, runMetadata } from '../../framework/reporting/result-metadata.js';
import { loadContract } from '../../framework/runtime/contracts.js';

test('failures are categorized as product, definition, environment or cleanup problems', () => {
  expect(categorizeFailure({ matcherResult: { pass: false } })).toBe('assertion');
  expect(categorizeFailure(new Error('ECONNREFUSED 127.0.0.1:4173'))).toBe('infrastructure');
  expect(categorizeFailure(new CategorizedError('setup-cleanup', 'x'))).toBe('setup-cleanup');
  const error = new CategorizedError('invalid-definition', 'bad variable');
  expect(error.message).toBe('[invalid-definition] bad variable');
});

test('run metadata uses the CI commit when supplied and records the environment', () => {
  expect(resolveGitCommit({ GITHUB_SHA: 'abc123' })).toBe('abc123');
  const metadata = runMetadata('development', 'build-7', { GITHUB_SHA: 'abc123' });
  expect(metadata).toMatchObject({
    environment: 'development',
    appBuildId: 'build-7',
    gitCommit: 'abc123',
  });
  expect(Number.isNaN(Date.parse(metadata.startedAt))).toBe(false);
});

test('contracts load only from the contract folder with validated names', () => {
  const root = mkdtempSync(join(tmpdir(), 'contracts-'));
  writeFileSync(
    join(root, 'profile-v1.json'),
    JSON.stringify({ type: 'object', required: ['id'], properties: { id: { type: 'string' } } }),
  );
  const validate = loadContract('profile-v1', root);
  expect(validate({ id: 'u1' })).toBe(true);
  expect(validate({ name: 'missing id' })).toBe(false);
  expect(() => loadContract('../secrets', root)).toThrow('Invalid contract name');
  expect(() => loadContract('missing-v1', root)).toThrow('not configured');
});

test('the shipped user profile contract accepts the public profile shape only', () => {
  const validate = loadContract('user-profile-v1');
  expect(validate({ id: 'u1', email: 'qa@example.test' })).toBe(true);
  expect(validate({ id: 'u1', email: 'qa@example.test', password: 'leak' })).toBe(false);
});
