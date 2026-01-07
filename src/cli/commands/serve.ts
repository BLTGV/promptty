import { Command } from 'commander';
import { resolveServerPaths, listInstances } from '../utils/instance.js';
import { startServer, setupShutdownHandlers } from '../../server.js';

export const serveCommand = new Command('serve')
  .description('Start the Promptty server')
  .argument('[instance]', 'Instance name or directory path')
  .option('--instance-dir <path>', 'Override instance directory')
  .option('-p, --port <number>', 'Override callback port', parseInt)
  .option('-l, --log-level <level>', 'Override log level')
  .option('--list', 'List available instances')
  .action(async (instance?: string, options?: {
    instanceDir?: string;
    port?: number;
    logLevel?: string;
    list?: boolean;
  }) => {
    // List instances mode
    if (options?.list) {
      const instances = listInstances();
      if (instances.length === 0) {
        console.log('No instances configured.');
        console.log('Run "promptty init <name>" to create a new instance.');
      } else {
        console.log('Available instances:');
        for (const name of instances) {
          console.log(`  - ${name}`);
        }
      }
      return;
    }

    try {
      // Use instance-dir if provided, otherwise use instance argument
      const target = options?.instanceDir || instance;
      const paths = resolveServerPaths(target);

      // Setup shutdown handlers
      setupShutdownHandlers();

      // Start the server
      await startServer({
        configPath: paths.configPath,
        dataDir: paths.dataDir,
        envFile: paths.envFile,
        instanceName: paths.instanceName,
        callbackPort: options?.port,
        logLevel: options?.logLevel,
      });
    } catch (error) {
      console.error('Failed to start server:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });
