import { registerYamlTests } from '../../../../framework/yaml/register-tests.js';
import { test } from '../../../../framework/fixtures/test-fixtures.js';
import { targetEnvironment } from '../../environment.js';
test.use({ targetEnvironment });
registerYamlTests('journeys', 'tests/mode-integration/yaml');
