import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Reporter } from '@playwright/test/reporter';
import { scrubSecrets } from './secret-scrubber.js';

const textExtensions = ['.md', '.txt', '.json', '.xml', '.log', '.html'];

async function textFiles(directory: string): Promise<string[]> {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
    throw error;
  }
  const files: string[] = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await textFiles(path)));
    else if (textExtensions.some((extension) => entry.name.endsWith(extension))) files.push(path);
  }
  return files;
}

/**
 * Rewrites text reports and diagnostic files after the run so credential values never
 * persist in them. Binary artifacts (traces, screenshots) cannot be rewritten here.
 */
export default class ScrubReporter implements Reporter {
  constructor(
    private readonly options: { secrets: string[]; files: string[]; directories: string[] },
  ) {}

  async onEnd(): Promise<void> {
    const files = [...this.options.files];
    for (const directory of this.options.directories) files.push(...(await textFiles(directory)));
    for (const file of files) {
      try {
        const text = await readFile(file, 'utf8');
        await writeFile(file, scrubSecrets(text, this.options.secrets), 'utf8');
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
    }
  }
}
