#!/usr/bin/env bun
import { Command } from 'commander';
import { serveCommand } from './commands/serve.js';
import { initCommand } from './commands/init.js';
import { configCommand } from './commands/config.js';
import { serviceCommand } from './commands/service.js';
import { listCommand } from './commands/list.js';
import { mcpCommand } from './commands/mcp.js';

const program = new Command();

program
  .name('promptty')
  .description('Slack/Teams to Claude Code bridge')
  .version('0.3.0');

program.addCommand(serveCommand);
program.addCommand(initCommand);
program.addCommand(listCommand);
program.addCommand(configCommand);
program.addCommand(serviceCommand);
program.addCommand(mcpCommand);

program.parse();
