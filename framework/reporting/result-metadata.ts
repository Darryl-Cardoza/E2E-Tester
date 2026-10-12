import { execFileSync } from 'node:child_process';

export interface RunMetadata {
  environment: string;
  appBuildId: string;
  gitCommit: string;
  startedAt: string;
}

/** CI supplies the commit through GITHUB_SHA; local runs fall back to the Git checkout. */
export function resolveGitCommit(
  env: Readonly<Record<string, string | undefined>> = process.env,
): string {
  if (env.GITHUB_SHA) return env.GITHUB_SHA;
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return 'unavailable';
  }
}

/** Run-level metadata written into every Playwright report. */
export function runMetadata(
  environment: string,
  appBuildId: string,
  env: Readonly<Record<string, string | undefined>> = process.env,
): RunMetadata {
  return {
    environment,
    appBuildId,
    gitCommit: resolveGitCommit(env),
    startedAt: new Date().toISOString(),
  };
}
