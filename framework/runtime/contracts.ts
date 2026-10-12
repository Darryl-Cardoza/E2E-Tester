import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { Ajv, type ValidateFunction } from 'ajv';
import { CategorizedError } from '../reporting/failure-category.js';

const contractName = /^[a-z0-9][a-z0-9-]{0,62}$/;
const cache = new Map<string, ValidateFunction>();

/** Loads schemas/contracts/<name>.json. Names are restricted so YAML cannot choose a path. */
export function loadContract(name: string, root = resolve('schemas/contracts')): ValidateFunction {
  if (!contractName.test(name))
    throw new CategorizedError('invalid-definition', 'Invalid contract name');
  const cached = cache.get(name);
  if (cached) return cached;
  let schema: unknown;
  try {
    schema = JSON.parse(readFileSync(join(root, `${name}.json`), 'utf8'));
  } catch {
    throw new CategorizedError(
      'invalid-definition',
      'Contract schema is not configured or is unreadable',
    );
  }
  const validate = new Ajv({ allErrors: false, strict: true }).compile(schema as object);
  cache.set(name, validate);
  return validate;
}
