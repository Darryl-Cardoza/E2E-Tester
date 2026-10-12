import { resolve } from 'node:path';
import { loadScenarios } from '../framework/yaml/loader.js';

// Lists YAML scenarios for QA review. Playwright's own listing is `npm run test:list`.
const rows = loadScenarios(resolve('tests/yaml'))
  .map(({ scenario, filePath }) => ({
    id: scenario.id,
    type: scenario.type,
    tags: scenario.tags.join(','),
    title: scenario.title,
    file: filePath,
  }))
  .sort((a, b) => a.id.localeCompare(b.id));

for (const row of rows)
  console.log(`${row.id}\t${row.type}\t${row.tags}\t${row.title}\t${row.file}`);
console.log(`${rows.length} YAML scenario(s)`);
