import { loadScenarios } from '../framework/yaml/loader.js';

try {
  const scenarios = loadScenarios(process.argv[2] ?? 'tests/yaml');
  console.log(`Validated ${scenarios.length} YAML scenario(s); all IDs are unique.`);
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Test definition validation failed');
  process.exitCode = 1;
}
