import { describe, test, expect } from 'bun:test';
import { homedir } from 'os';
import {
  getServiceName,
  getServicePath,
  generateServiceFile,
} from './systemd.js';

describe('getServiceName', () => {
  test('generates correct service name', () => {
    expect(getServiceName('my-instance')).toBe('promptty-my-instance.service');
  });

  test('generates correct service name for simple instance', () => {
    expect(getServiceName('test')).toBe('promptty-test.service');
  });

  test('generates correct service name for complex instance', () => {
    expect(getServiceName('acme-corp-2024')).toBe('promptty-acme-corp-2024.service');
  });
});

describe('getServicePath', () => {
  test('generates path in user systemd directory', () => {
    const path = getServicePath('my-instance');
    expect(path).toContain(homedir());
    expect(path).toContain('.config/systemd/user');
    expect(path).toContain('promptty-my-instance.service');
  });

  test('generates correct full path', () => {
    const path = getServicePath('test');
    expect(path).toBe(`${homedir()}/.config/systemd/user/promptty-test.service`);
  });
});

describe('generateServiceFile', () => {
  const content = generateServiceFile('test-instance');

  test('generates valid systemd unit file with [Unit] section', () => {
    expect(content).toContain('[Unit]');
  });

  test('generates valid systemd unit file with [Service] section', () => {
    expect(content).toContain('[Service]');
  });

  test('generates valid systemd unit file with [Install] section', () => {
    expect(content).toContain('[Install]');
  });

  test('includes instance name in description', () => {
    expect(content).toContain('Description=Promptty - test-instance instance');
  });

  test('sets service type to simple', () => {
    expect(content).toContain('Type=simple');
  });

  test('contains serve command with instance', () => {
    expect(content).toContain('serve test-instance');
  });

  test('sets restart policy to on-failure', () => {
    expect(content).toContain('Restart=on-failure');
  });

  test('includes correct working directory', () => {
    expect(content).toContain(`WorkingDirectory=${homedir()}/.promptty/instances/test-instance`);
  });

  test('includes ReadWritePaths for instance directory', () => {
    expect(content).toContain(`ReadWritePaths=${homedir()}/.promptty/instances/test-instance`);
  });

  test('includes hardening options', () => {
    expect(content).toContain('NoNewPrivileges=true');
    expect(content).toContain('ProtectSystem=strict');
    expect(content).toContain('ProtectHome=read-only');
  });

  test('includes network dependency', () => {
    expect(content).toContain('After=network-online.target');
    expect(content).toContain('Wants=network-online.target');
  });

  test('includes install target', () => {
    expect(content).toContain('WantedBy=default.target');
  });

  test('includes PATH environment', () => {
    expect(content).toContain('Environment="PATH=');
  });

  test('includes HOME environment', () => {
    expect(content).toContain(`Environment="HOME=${homedir()}"`);
  });

  test('uses bun to run CLI', () => {
    expect(content).toMatch(/ExecStart=.*bun.*serve test-instance/);
  });

  test('outputs to journal', () => {
    expect(content).toContain('StandardOutput=journal');
    expect(content).toContain('StandardError=journal');
  });
});

describe('generateServiceFile with different instances', () => {
  test('generates different service file for each instance', () => {
    const content1 = generateServiceFile('instance-a');
    const content2 = generateServiceFile('instance-b');

    expect(content1).toContain('instance-a');
    expect(content1).not.toContain('instance-b');

    expect(content2).toContain('instance-b');
    expect(content2).not.toContain('instance-a');
  });

  test('working directory changes per instance', () => {
    const content1 = generateServiceFile('acme');
    const content2 = generateServiceFile('bigco');

    expect(content1).toContain('/instances/acme');
    expect(content2).toContain('/instances/bigco');
  });
});
