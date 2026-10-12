export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
export type Target =
  { testId: string } | { role: string; name: string } | { label: string } | { text: string };
export interface ActionParameters {
  'data.create': {
    resource: string;
    body: Record<string, JsonValue>;
    saveAs: string;
    auth?: string;
  };
  'ui.navigate': { path: string };
  'ui.click': { target: Target };
  'ui.fill': { target: Target; value: string };
  'ui.select': { target: Target; value: string | string[] };
  'ui.check': { target: Target };
  'ui.uncheck': { target: Target };
  'ui.press': { target: Target; key: string };
  'assert.visible': { target: Target };
  'assert.hidden': { target: Target };
  'assert.text': { target: Target } & (
    { equals: string; contains?: never } | { contains: string; equals?: never }
  );
  'assert.url': { equals: string; contains?: never } | { contains: string; equals?: never };
  'assert.enabled': { target: Target };
  'assert.disabled': { target: Target };
  'assert.count': { target: Target; equals: number };
  'api.request': {
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    path: string;
    headers?: Record<string, string>;
    query?: Record<string, string | number | boolean>;
    body?: JsonValue;
    auth?: string;
    saveAs?: string;
    timeout?: number;
  };
  'assert.status': { from: string; equals: number };
  'assert.json': { from: string; path: string; equals: JsonValue };
  'assert.contract': { from: string; schema: string };
  'assert.header': { from: string; header: string; equals: string };
  'assert.responseTime': { from: string; lessThan: number };
  'mock.api': {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
    status: number;
    body?: JsonValue;
    headers?: Record<string, string>;
    delay?: number;
  };
  'data.generate': { kind: 'uuid' | 'email' | 'string'; saveAs: string; prefix?: string };
}
export type ActionName = keyof ActionParameters;
export type Step = {
  [K in ActionName]: { action: K; name?: string } & ActionParameters[K];
}[ActionName];
interface ScenarioBase {
  browserAuth?: string;
  schemaVersion: 1;
  id: string;
  title: string;
  description?: string;
  tags: string[];
  prerequisites?: string[];
  timeout?: number;
  testData?: Record<string, JsonValue>;
  setup?: Step[];
  steps: Step[];
  teardown?: Step[];
}
export type Scenario = ScenarioBase &
  (
    | { type: 'frontend'; modes: ('frontend-mocked' | 'frontend-live')[] }
    | { type: 'backend' | 'journeys'; modes?: never }
  );
export interface LoadedScenario {
  filePath: string;
  scenario: Scenario;
}
