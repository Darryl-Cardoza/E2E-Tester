import type { JsonValue } from '../types/scenario.js';

const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
export const allowedEnvironmentVariables = [
  'TEST_EMAIL',
  'TEST_PASSWORD',
  'TEST_USER_TOKEN',
] as const;
export type VariableStore = Record<string, JsonValue>;

export function readJsonPath(value: unknown, path: string): unknown {
  if (!/^\$(?:(?:\.[A-Za-z_][A-Za-z0-9_-]*)|(?:\[(?:0|[1-9][0-9]*)\]))*$/.test(path)) {
    throw new Error('Unsupported JSON path');
  }
  let current = value;
  for (const token of path.slice(1).match(/[A-Za-z_][A-Za-z0-9_-]*|\d+/g) ?? []) {
    if (
      forbidden.has(token) ||
      current === null ||
      typeof current !== 'object' ||
      !Object.hasOwn(current, token)
    ) {
      throw new Error('JSON path does not exist');
    }
    current = (current as Record<string, unknown>)[token];
  }
  return current;
}

export class VariableResolver {
  readonly generated: VariableStore = {};
  readonly responses: VariableStore = {};
  readonly data: VariableStore;
  private readonly environment: VariableStore = {};

  constructor(
    env: Readonly<Record<string, string | undefined>> = process.env,
    data: VariableStore = {},
  ) {
    this.data = structuredClone(data);
    for (const key of allowedEnvironmentVariables)
      if (env[key] !== undefined) this.environment[key] = env[key];
  }

  resolve(value: JsonValue, depth = 0, stack: readonly string[] = []): JsonValue {
    if (depth > 32) throw new Error('Variable resolution depth exceeded');
    if (Array.isArray(value)) return value.map((item) => this.resolve(item, depth + 1, stack));
    if (value !== null && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value).map(([key, item]) => {
          if (forbidden.has(key) || key.includes('${'))
            throw new Error('Unsafe variable object key');
          return [key, this.resolve(item, depth + 1, stack)];
        }),
      );
    }
    if (typeof value !== 'string') return value;
    const lookup = (name: string): JsonValue => {
      if (!/^[A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_-]*|\[\d+\])*$/.test(name))
        throw new Error('Invalid variable syntax');
      if (stack.includes(name)) throw new Error('Recursive variable reference');
      let found: unknown;
      const dot = name.indexOf('.');
      if (dot < 0)
        found = Object.hasOwn(this.environment, name) ? this.environment[name] : undefined;
      else {
        const namespace = name.slice(0, dot);
        const stores: Record<string, VariableStore> = {
          generated: this.generated,
          responses: this.responses,
          data: this.data,
        };
        if (!Object.hasOwn(stores, namespace)) throw new Error('Invalid variable namespace');
        found = readJsonPath(stores[namespace], '$.' + name.slice(dot + 1));
      }
      if (found === undefined) throw new Error('Unresolved or non-allowlisted variable');
      return this.resolve(found as JsonValue, depth + 1, [...stack, name]);
    };
    const full = /^\$\{([^{}]+)\}$/.exec(value);
    if (full?.[1]) return structuredClone(lookup(full[1]));
    const result = value.replace(/\$\{([^{}]+)\}/g, (_match: string, name: string) => {
      const found = lookup(name);
      if (found !== null && typeof found === 'object')
        throw new Error('Structured variables require a whole-value reference');
      return String(found);
    });
    if (result.includes('${')) throw new Error('Malformed variable reference');
    return result;
  }
}
