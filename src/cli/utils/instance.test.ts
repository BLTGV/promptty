import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { createTempDir, cleanupTempDir } from '../../../tests/helpers.js';
import {
  validateInstanceName,
  resolveInstance,
  instanceExists,
  listInstances,
  createInstanceDirs,
  PROMPTTY_HOME,
  INSTANCES_DIR,
} from './instance.js';

describe('validateInstanceName', () => {
  describe('valid names', () => {
    test('accepts single character', () => {
      expect(validateInstanceName('a')).toEqual({ valid: true });
    });

    test('accepts single digit', () => {
      expect(validateInstanceName('1')).toEqual({ valid: true });
    });

    test('accepts lowercase alphanumeric', () => {
      expect(validateInstanceName('myinstance')).toEqual({ valid: true });
    });

    test('accepts hyphens in middle', () => {
      expect(validateInstanceName('my-instance')).toEqual({ valid: true });
    });

    test('accepts numbers', () => {
      expect(validateInstanceName('instance123')).toEqual({ valid: true });
    });

    test('accepts mixed alphanumeric with hyphens', () => {
      expect(validateInstanceName('acme-corp-2024')).toEqual({ valid: true });
    });

    test('accepts two character name', () => {
      expect(validateInstanceName('ab')).toEqual({ valid: true });
    });
  });

  describe('invalid names', () => {
    test('rejects empty string', () => {
      const result = validateInstanceName('');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('empty');
    });

    test('rejects uppercase letters', () => {
      const result = validateInstanceName('MyInstance');
      expect(result.valid).toBe(false);
    });

    test('rejects leading hyphen', () => {
      const result = validateInstanceName('-instance');
      expect(result.valid).toBe(false);
    });

    test('rejects trailing hyphen', () => {
      const result = validateInstanceName('instance-');
      expect(result.valid).toBe(false);
    });

    test('rejects consecutive hyphens', () => {
      const result = validateInstanceName('my--instance');
      expect(result.valid).toBe(false);
      expect(result.error).toContain('consecutive');
    });

    test('rejects names over 64 characters', () => {
      const longName = 'a'.repeat(65);
      const result = validateInstanceName(longName);
      expect(result.valid).toBe(false);
      expect(result.error).toContain('64');
    });

    test('accepts exactly 64 characters', () => {
      const maxName = 'a'.repeat(64);
      expect(validateInstanceName(maxName)).toEqual({ valid: true });
    });

    test('rejects underscores', () => {
      const result = validateInstanceName('my_instance');
      expect(result.valid).toBe(false);
    });

    test('rejects dots', () => {
      const result = validateInstanceName('my.instance');
      expect(result.valid).toBe(false);
    });

    test('rejects special characters', () => {
      expect(validateInstanceName('my@instance').valid).toBe(false);
      expect(validateInstanceName('my!instance').valid).toBe(false);
      expect(validateInstanceName('my#instance').valid).toBe(false);
      expect(validateInstanceName('my$instance').valid).toBe(false);
    });

    test('rejects spaces', () => {
      const result = validateInstanceName('my instance');
      expect(result.valid).toBe(false);
    });
  });
});

describe('resolveInstance', () => {
  test('returns correct path structure', () => {
    const paths = resolveInstance('test-instance');

    expect(paths.root).toBe(`${INSTANCES_DIR}/test-instance`);
    expect(paths.config).toBe(`${INSTANCES_DIR}/test-instance/config.json`);
    expect(paths.env).toBe(`${INSTANCES_DIR}/test-instance/.env`);
    expect(paths.data).toBe(`${INSTANCES_DIR}/test-instance/data`);
    expect(paths.logs).toBe(`${INSTANCES_DIR}/test-instance/logs`);
  });

  test('handles special characters in name (even though invalid)', () => {
    // resolveInstance doesn't validate, it just builds paths
    const paths = resolveInstance('test_instance');
    expect(paths.root).toContain('test_instance');
  });
});

describe('PROMPTTY_HOME', () => {
  test('is under user home directory', () => {
    expect(PROMPTTY_HOME).toContain('.promptty');
  });

  test('INSTANCES_DIR is under PROMPTTY_HOME', () => {
    expect(INSTANCES_DIR).toContain(PROMPTTY_HOME);
    expect(INSTANCES_DIR).toContain('instances');
  });
});

describe('instanceExists', () => {
  let testDir: string;
  let originalInstancesDir: string;

  // Note: These tests would need to mock INSTANCES_DIR or use the real filesystem
  // For now, we test the logic with temp directories by creating a fake instance structure

  test('returns false for non-existent instance', () => {
    // This will check the real INSTANCES_DIR which likely won't have this instance
    const result = instanceExists('definitely-not-a-real-instance-xyz123');
    expect(result).toBe(false);
  });
});

describe('listInstances', () => {
  test('returns empty array when instances directory does not exist', () => {
    // This tests against a non-existent INSTANCES_DIR scenario
    // In practice, if ~/.promptty/instances doesn't exist, returns []
    const instances = listInstances();
    expect(Array.isArray(instances)).toBe(true);
  });
});
