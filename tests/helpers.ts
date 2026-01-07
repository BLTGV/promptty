import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';

/**
 * Create a temporary directory for testing
 */
export async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'promptty-test-'));
}

/**
 * Clean up a temporary directory after testing
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/**
 * Run a function with isolated environment variables
 */
export function withEnv<T>(
  overrides: Record<string, string | undefined>,
  fn: () => T
): T {
  const original: Record<string, string | undefined> = {};

  // Save original values and apply overrides
  for (const key of Object.keys(overrides)) {
    original[key] = process.env[key];
    if (overrides[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = overrides[key];
    }
  }

  try {
    return fn();
  } finally {
    // Restore original values
    for (const key of Object.keys(original)) {
      if (original[key] === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = original[key];
      }
    }
  }
}
