import { test, expect } from '@playwright/test';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify } from 'yaml';
import { parseYaml } from '../../framework/yaml/parser.js';
import { validateScenario, validateUniqueIds } from '../../framework/yaml/validator.js';
import { discoverYamlFiles, loadScenarios } from '../../framework/yaml/loader.js';
import type { ActionParameters } from '../../framework/types/scenario.js';

const target = { testId: 'field' };
const actionExamples = {
  'data.create': { resource: 'test-users', body: { email: 'qa@example.test' }, saveAs: 'user' },
  'ui.navigate': { path: '/login' },
  'ui.click': { target },
  'ui.fill': { target, value: '' },
  'ui.select': { target, value: ['one', 'two'] },
  'ui.check': { target },
  'ui.uncheck': { target },
  'ui.press': { target, key: 'Enter' },
  'assert.visible': { target },
  'assert.hidden': { target },
  'assert.text': { target, contains: 'Hello' },
  'assert.url': { equals: '/dashboard' },
  'assert.enabled': { target },
  'assert.disabled': { target },
  'assert.count': { target, equals: 0 },
  'api.request': {
    method: 'POST',
    path: '/api/users',
    headers: { Accept: 'application/json' },
    query: { limit: 1, active: true },
    body: { email: '${generated.email}', enabled: true, count: 2, extra: null },
    auth: 'test-user',
    saveAs: 'created',
    timeout: 1000,
  },
  'assert.status': { from: 'created', equals: 201 },
  'assert.json': { from: 'created', path: '$.users[0].email', equals: 'qa@example.test' },
  'assert.header': { from: 'created', header: 'content-type', equals: 'application/json' },
  'assert.responseTime': { from: 'created', lessThan: 2000 },
  'mock.api': {
    method: 'GET',
    url: '/api/users',
    status: 200,
    body: [],
    headers: { 'content-type': 'application/json' },
    delay: 10,
  },
  'data.generate': { kind: 'email', saveAs: 'email', prefix: 'qa' },
  'assert.contract': { from: 'profile', schema: 'user-profile-v1' },
} satisfies ActionParameters;

for (const [action, parameters] of Object.entries(actionExamples)) {
  test(`accept typed parameters for ${action}`, () => {
    expect(() =>
      validateScenario(
        {
          ...valid(),
          type: 'frontend',
          modes: ['frontend-mocked'],
          setup: [{ action: 'data.generate', kind: 'uuid', saveAs: 'id' }],
          steps: [{ action, ...parameters }],
          teardown: [],
          testData: { active: true },
        },
        'actions.yaml',
      ),
    ).not.toThrow();
  });
}

const valid = () => ({
  schemaVersion: 1,
  id: 'API-001',
  title: 'Read profile',
  type: 'backend',
  tags: ['smoke'],
  steps: [{ action: 'api.request', method: 'GET', path: '/api/me', saveAs: 'profile' }],
});

test('valid YAML becomes a typed scenario', () => {
  const value = valid();
  expect(validateScenario(parseYaml(stringify(value), 'valid.yaml'), 'valid.yaml')).toEqual(value);
});

const invalid: [string, (value: Record<string, unknown>) => void][] = [
  [
    'missing required field',
    (value) => {
      delete value.title;
    },
  ],
  [
    'unsupported action',
    (value) => {
      value.steps = [{ action: 'shell.exec', command: 'whoami' }];
    },
  ],
  [
    'incorrect parameter type',
    (value) => {
      value.steps = [{ action: 'api.request', method: 'GET', path: 2 }];
    },
  ],
  [
    'unsupported version',
    (value) => {
      value.schemaVersion = 2;
    },
  ],
  [
    'unexpected root property',
    (value) => {
      value.extra = true;
    },
  ],
  [
    'unexpected step property',
    (value) => {
      value.steps = [{ action: 'api.request', method: 'GET', path: '/', extra: true }];
    },
  ],
  [
    'empty steps',
    (value) => {
      value.steps = [];
    },
  ],
  [
    'frontend needs modes',
    (value) => {
      value.type = 'frontend';
    },
  ],
  [
    'backend forbids modes',
    (value) => {
      value.modes = ['frontend-live'];
    },
  ],
  [
    'unsupported HTTP method',
    (value) => {
      value.steps = [{ action: 'api.request', method: 'TRACE', path: '/' }];
    },
  ],
  [
    'absolute URL',
    (value) => {
      value.steps = [{ action: 'api.request', method: 'GET', path: 'https://other.test' }];
    },
  ],
  [
    'unsafe JSONPath expression',
    (value) => {
      value.steps = [
        { action: 'assert.json', from: 'profile', path: '$[?(@.secret)]', equals: true },
      ];
    },
  ],
  [
    'mock in journey',
    (value) => {
      value.type = 'journeys';
      value.steps = [{ action: 'mock.api', method: 'GET', url: '/api/me', status: 200 }];
    },
  ],
  [
    'browser action in backend',
    (value) => {
      value.steps = [{ action: 'ui.click', target: { testId: 'button' } }];
    },
  ],
  [
    'ambiguous target',
    (value) => {
      value.type = 'frontend';
      value.modes = ['frontend-live'];
      value.steps = [{ action: 'ui.click', target: { testId: 'button', text: 'Submit' } }];
    },
  ],
  [
    'ambiguous assertion',
    (value) => {
      value.type = 'frontend';
      value.modes = ['frontend-live'];
      value.steps = [{ action: 'assert.url', equals: '/', contains: '/' }];
    },
  ],
];
for (const [name, mutate] of invalid) {
  test(`reject ${name}`, () => {
    const value: Record<string, unknown> = valid();
    mutate(value);
    expect(() => validateScenario(value, 'invalid.yaml')).toThrow(
      /invalid.yaml.*|invalid test definition/,
    );
  });
}

for (const [name, source] of [
  ['malformed', 'steps: ['],
  ['duplicate keys', 'id: one\nid: two'],
  ['multiple documents', 'id: one\n---\nid: two'],
  ['alias', 'one: &a hello\ntwo: *a'],
  ['custom tag', 'value: !execute hello'],
] as const) {
  test(`reject ${name} YAML`, () => {
    expect(() => parseYaml(source, 'broken.yaml')).toThrow('broken.yaml');
  });
}

test('diagnostics include property paths without instance values', () => {
  const value = {
    ...valid(),
    steps: [{ action: 'api.request', method: 'SECRET-METHOD', path: '/' }],
  };
  try {
    validateScenario(value, 'secret.yaml');
    throw new Error('expected rejection');
  } catch (error) {
    expect(String(error)).toContain('/steps/0/method');
    expect(String(error)).not.toContain('SECRET-METHOD');
  }
  expect(() => parseYaml('password: [TOP-SECRET', 'secret.yaml')).toThrow('YAML');
  try {
    parseYaml('password: [TOP-SECRET', 'secret.yaml');
  } catch (error) {
    expect(String(error)).not.toContain('TOP-SECRET');
  }
});

test('duplicate IDs identify both originating files', () => {
  const scenario = validateScenario(valid(), 'first.yaml');
  expect(() =>
    validateUniqueIds([
      { filePath: 'first.yaml', scenario },
      { filePath: 'second.yaml', scenario },
    ]),
  ).toThrow('second.yaml: /id: duplicate test ID; first defined in first.yaml');
});

test('recursive discovery is deterministic and validation spans directories', () => {
  const root = mkdtempSync(join(tmpdir(), 'e2e-yaml-'));
  try {
    mkdirSync(join(root, 'nested'));
    writeFileSync(join(root, 'z.yml'), stringify(valid()));
    writeFileSync(join(root, 'nested', 'a.yaml'), stringify({ ...valid(), id: 'API-002' }));
    writeFileSync(join(root, 'ignored.txt'), 'not YAML');
    expect(discoverYamlFiles(root)).toEqual([join(root, 'nested', 'a.yaml'), join(root, 'z.yml')]);
    expect(loadScenarios(root)).toHaveLength(2);
    writeFileSync(join(root, 'nested', 'a.yaml'), stringify(valid()));
    expect(() => loadScenarios(root)).toThrow('duplicate test ID');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('empty discovery fails instead of claiming validation success', () => {
  const root = mkdtempSync(join(tmpdir(), 'e2e-empty-'));
  try {
    expect(() => loadScenarios(root)).toThrow('no YAML');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('size and nesting limits reject excessive input', () => {
  expect(() => parseYaml('a'.repeat(1_048_577), 'large.yaml')).toThrow('1 MiB');
  expect(() => parseYaml('['.repeat(70) + '0' + ']'.repeat(70), 'deep.yaml')).toThrow('nesting');
});
