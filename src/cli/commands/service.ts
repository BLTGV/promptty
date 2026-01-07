import { Command } from 'commander';
import { instanceExists, listInstances } from '../utils/instance.js';
import {
  installService,
  uninstallService,
  serviceAction,
  getServiceStatus,
  viewServiceLogs,
  listServices,
  getServiceName,
  getServicePath,
} from '../utils/systemd.js';

export const serviceCommand = new Command('service')
  .description('Manage systemd services for Promptty instances');

serviceCommand
  .command('install')
  .description('Install systemd service for an instance')
  .argument('<instance>', 'Instance name')
  .action((instance: string) => {
    validateInstance(instance);

    console.log(`Installing service for instance: ${instance}`);
    installService(instance);
    console.log(`Service installed: ${getServiceName(instance)}`);
    console.log(`Service file: ${getServicePath(instance)}`);
    console.log('');
    console.log('Next steps:');
    console.log(`  Enable auto-start: promptty service enable ${instance}`);
    console.log(`  Start now:         promptty service start ${instance}`);
  });

serviceCommand
  .command('uninstall')
  .description('Remove systemd service for an instance')
  .argument('<instance>', 'Instance name')
  .action((instance: string) => {
    console.log(`Uninstalling service for instance: ${instance}`);
    uninstallService(instance);
    console.log('Service uninstalled');
  });

serviceCommand
  .command('enable')
  .description('Enable auto-start on boot')
  .argument('<instance>', 'Instance name')
  .action((instance: string) => {
    const result = serviceAction(instance, 'enable');
    if (!result.success) {
      console.error('Failed to enable service');
      process.exit(1);
    }
    console.log(`Service enabled: ${getServiceName(instance)}`);
  });

serviceCommand
  .command('disable')
  .description('Disable auto-start on boot')
  .argument('<instance>', 'Instance name')
  .action((instance: string) => {
    const result = serviceAction(instance, 'disable');
    if (!result.success) {
      console.error('Failed to disable service');
      process.exit(1);
    }
    console.log(`Service disabled: ${getServiceName(instance)}`);
  });

serviceCommand
  .command('start')
  .description('Start the service')
  .argument('<instance>', 'Instance name')
  .action((instance: string) => {
    console.log(`Starting ${getServiceName(instance)}...`);
    const result = serviceAction(instance, 'start');
    if (!result.success) {
      console.error('Failed to start service');
      process.exit(1);
    }
    console.log('Service started');
  });

serviceCommand
  .command('stop')
  .description('Stop the service')
  .argument('<instance>', 'Instance name')
  .action((instance: string) => {
    console.log(`Stopping ${getServiceName(instance)}...`);
    const result = serviceAction(instance, 'stop');
    if (!result.success) {
      console.error('Failed to stop service');
      process.exit(1);
    }
    console.log('Service stopped');
  });

serviceCommand
  .command('restart')
  .description('Restart the service')
  .argument('<instance>', 'Instance name')
  .action((instance: string) => {
    console.log(`Restarting ${getServiceName(instance)}...`);
    const result = serviceAction(instance, 'restart');
    if (!result.success) {
      console.error('Failed to restart service');
      process.exit(1);
    }
    console.log('Service restarted');
  });

serviceCommand
  .command('status')
  .description('Show service status')
  .argument('<instance>', 'Instance name')
  .action((instance: string) => {
    const status = getServiceStatus(instance);

    console.log(`Service: ${getServiceName(instance)}`);
    console.log(`Installed: ${status.installed ? 'yes' : 'no'}`);
    if (status.installed) {
      console.log(`Enabled: ${status.enabled ? 'yes' : 'no'}`);
      console.log(`Status: ${status.status}`);
    }

    // Also show detailed systemctl status
    if (status.installed) {
      console.log('');
      serviceAction(instance, 'status');
    }
  });

serviceCommand
  .command('logs')
  .description('View service logs')
  .argument('<instance>', 'Instance name')
  .option('-f, --follow', 'Follow log output')
  .option('-n, --lines <number>', 'Number of lines to show', '50')
  .action((instance: string, options: { follow?: boolean; lines?: string }) => {
    const lines = parseInt(options.lines || '50', 10);
    viewServiceLogs(instance, options.follow || false, lines);
  });

serviceCommand
  .command('list')
  .description('List all Promptty services')
  .action(() => {
    const services = listServices();

    if (services.length === 0) {
      console.log('No Promptty services installed.');
      console.log('');
      console.log('Available instances:');
      const instances = listInstances();
      if (instances.length === 0) {
        console.log('  (none)');
        console.log('');
        console.log('Create an instance with: promptty init <name>');
      } else {
        for (const inst of instances) {
          console.log(`  - ${inst}`);
        }
        console.log('');
        console.log('Install a service with: promptty service install <instance>');
      }
      return;
    }

    console.log('Installed Promptty services:');
    console.log('');

    for (const { instance, status } of services) {
      const statusIcon = status.running ? '\x1b[32m●\x1b[0m' : '\x1b[90m○\x1b[0m';
      const enabledText = status.enabled ? 'enabled' : 'disabled';
      console.log(`${statusIcon} ${instance}`);
      console.log(`    Status: ${status.status}, ${enabledText}`);
    }
  });

function validateInstance(instance: string): void {
  if (!instanceExists(instance)) {
    console.error(`Instance '${instance}' not found.`);
    const instances = listInstances();
    if (instances.length > 0) {
      console.log('Available instances:', instances.join(', '));
    }
    process.exit(1);
  }
}
