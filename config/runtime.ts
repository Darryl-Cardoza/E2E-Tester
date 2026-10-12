import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import type { EnvironmentInput } from './environments.js';

export function loadLocalEnvironment(): void {
  if (existsSync('.env')) loadEnvFile('.env');
}

function integer(env: EnvironmentInput, key: string, fallback: number, min: number): number {
  const raw = env[key];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!/^\d+$/.test(raw) || !Number.isSafeInteger(value) || value < min) {
    throw new Error(`${key} must be an integer >= ${min}`);
  }
  return value;
}

export function readRuntime(env: EnvironmentInput = process.env) {
  const ci = env.CI === 'true' || env.CI === '1';
  const browser = env.BROWSER ?? 'chromium';
  if (browser !== 'chromium' && browser !== 'firefox' && browser !== 'webkit') {
    throw new Error('BROWSER must be chromium, firefox or webkit');
  }
  return {
    ci,
    browser,
    workers: integer(env, 'WORKERS', ci ? 2 : 4, 1),
    retries: integer(env, 'RETRIES', ci ? 2 : 0, 0),
    testTimeout: integer(env, 'TEST_TIMEOUT_MS', 30_000, 1),
    requestTimeout: integer(env, 'REQUEST_TIMEOUT_MS', 15_000, 1),
  } as const;
}
