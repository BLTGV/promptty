import { Command } from 'commander';
import { listInstances, resolveInstance, instanceExists, INSTANCES_DIR } from '../utils/instance.js';
import { getServiceStatus } from '../utils/systemd.js';
import { existsSync } from 'fs';

export const listCommand = new Command('list')
  .description('List all Promptty instances')
  .option('-v, --verbose', 'Show detailed information')
  .action((options) => {
    const instances = listInstances();

    if (instances.length === 0) {
      console.log('No instances found.');
      console.log(`\nCreate one with: promptty init <name>`);
      console.log(`Instances are stored in: ${INSTANCES_DIR}`);
      return;
    }

    if (options.verbose) {
      console.log(`Found ${instances.length} instance(s):\n`);

      for (const name of instances) {
        const paths = resolveInstance(name);
        const service = getServiceStatus(name);
        const hasEnv = existsSync(paths.env);

        console.log(`  ${name}`);
        console.log(`    Path:    ${paths.root}`);
        console.log(`    Config:  ${existsSync(paths.config) ? '✓' : '✗'}`);
        console.log(`    .env:    ${hasEnv ? '✓' : '✗ (not configured)'}`);
        console.log(`    Service: ${service.installed ? (service.running ? '● running' : '○ stopped') : '- not installed'}`);
        console.log();
      }
    } else {
      console.log('Instances:');
      for (const name of instances) {
        const service = getServiceStatus(name);
        const status = service.installed
          ? (service.running ? ' (running)' : ' (stopped)')
          : '';
        console.log(`  ${name}${status}`);
      }
    }
  });
