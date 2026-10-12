import { readdirSync, readFileSync, lstatSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { parseYaml, MAX_YAML_BYTES } from './parser.js';
import { validateScenario, validateUniqueIds } from './validator.js';
import type { LoadedScenario } from '../types/scenario.js';

export function discoverYamlFiles(root: string): string[] {
  const directory = resolve(root);
  if (!lstatSync(directory).isDirectory())
    throw new Error(`${directory}: expected a real directory`);
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`${path}: symbolic links are unsupported`);
    if (entry.isDirectory()) files.push(...discoverYamlFiles(path));
    else if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) files.push(path);
  }
  return files.sort();
}

export function loadScenarios(root: string): LoadedScenario[] {
  const files = discoverYamlFiles(root);
  if (!files.length) throw new Error(`${resolve(root)}: no YAML test definitions found`);
  const scenarios = files.map((filePath) => {
    if (lstatSync(filePath).size > MAX_YAML_BYTES)
      throw new Error(`${filePath}: /: YAML exceeds the 1 MiB limit`);
    return {
      filePath,
      scenario: validateScenario(parseYaml(readFileSync(filePath, 'utf8'), filePath), filePath),
    };
  });
  validateUniqueIds(scenarios);
  return scenarios;
}
