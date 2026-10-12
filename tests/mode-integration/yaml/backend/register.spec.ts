import { registerYamlTests } from '../../../../framework/yaml/register-tests.js';
import { test } from '../../../../framework/fixtures/test-fixtures.js';
import { targetEnvironment } from '../../environment.js';
test.use({ targetEnvironment, launchOptions: { executablePath: 'intentionally-missing-browser' } });
registerYamlTests('backend', 'tests/mode-integration/yaml');
