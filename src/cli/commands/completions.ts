import { Command } from 'commander';
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { execSync } from 'child_process';

// Get the promptty installation directory
function getPrompttyPath(): string {
  const currentFile = new URL(import.meta.url).pathname;
  return dirname(dirname(dirname(dirname(currentFile))));
}

// Detect the current shell
function detectShell(): 'bash' | 'zsh' | 'fish' | 'unknown' {
  // Check SHELL environment variable
  const shell = process.env.SHELL ?? '';

  if (shell.endsWith('/bash')) return 'bash';
  if (shell.endsWith('/zsh')) return 'zsh';
  if (shell.endsWith('/fish')) return 'fish';

  // Fallback: check parent process
  try {
    const ppid = process.ppid;
    const parentCmd = execSync(`ps -p ${ppid} -o comm=`, { encoding: 'utf-8' }).trim();
    if (parentCmd.includes('bash')) return 'bash';
    if (parentCmd.includes('zsh')) return 'zsh';
    if (parentCmd.includes('fish')) return 'fish';
  } catch {
    // Ignore errors
  }

  return 'unknown';
}

function getCompletionScript(shell: 'bash' | 'zsh' | 'fish'): string {
  const prompttyPath = getPrompttyPath();
  const completionFile = join(prompttyPath, 'completions', `promptty.${shell}`);

  if (!existsSync(completionFile)) {
    throw new Error(`Completion file not found: ${completionFile}`);
  }

  return readFileSync(completionFile, 'utf-8');
}

function getShellConfigFile(shell: 'bash' | 'zsh' | 'fish'): string {
  const home = process.env.HOME ?? '';

  switch (shell) {
    case 'bash':
      // Prefer .bashrc, fall back to .bash_profile
      if (existsSync(join(home, '.bashrc'))) {
        return join(home, '.bashrc');
      }
      return join(home, '.bash_profile');
    case 'zsh':
      return join(home, '.zshrc');
    case 'fish':
      return join(home, '.config', 'fish', 'completions', 'promptty.fish');
  }
}

function isAlreadyInstalled(shell: 'bash' | 'zsh' | 'fish'): boolean {
  const configFile = getShellConfigFile(shell);

  if (shell === 'fish') {
    // For fish, check if the completion file exists
    return existsSync(configFile);
  }

  // For bash/zsh, check if the source line is in the config
  if (!existsSync(configFile)) {
    return false;
  }

  const content = readFileSync(configFile, 'utf-8');
  return content.includes('promptty.bash') || content.includes('promptty.zsh');
}

export const completionsCommand = new Command('completions')
  .description('Install or show shell completions')
  .option('--bash', 'Use bash completions')
  .option('--zsh', 'Use zsh completions')
  .option('--fish', 'Use fish completions')
  .option('--print', 'Print completion script to stdout (for manual installation)')
  .option('--install', 'Install completions to shell config file')
  .action((options: { bash?: boolean; zsh?: boolean; fish?: boolean; print?: boolean; install?: boolean }) => {
    // Determine which shell to use
    let shell: 'bash' | 'zsh' | 'fish' | 'unknown';

    if (options.bash) {
      shell = 'bash';
    } else if (options.zsh) {
      shell = 'zsh';
    } else if (options.fish) {
      shell = 'fish';
    } else {
      shell = detectShell();
    }

    if (shell === 'unknown') {
      console.error('Could not detect shell. Please specify --bash, --zsh, or --fish');
      process.exit(1);
    }

    const prompttyPath = getPrompttyPath();
    const completionFile = join(prompttyPath, 'completions', `promptty.${shell}`);

    // Print mode: output the script
    if (options.print) {
      try {
        const script = getCompletionScript(shell);
        console.log(script);
      } catch (error) {
        console.error(error instanceof Error ? error.message : 'Failed to read completion script');
        process.exit(1);
      }
      return;
    }

    // Install mode: add to shell config
    if (options.install) {
      const configFile = getShellConfigFile(shell);

      if (isAlreadyInstalled(shell)) {
        console.log(`Completions already installed for ${shell}.`);
        console.log(`Config file: ${configFile}`);
        return;
      }

      try {
        if (shell === 'fish') {
          // For fish, copy the completion file directly
          const fishDir = dirname(configFile);
          if (!existsSync(fishDir)) {
            mkdirSync(fishDir, { recursive: true });
          }
          const script = getCompletionScript(shell);
          writeFileSync(configFile, script);
          console.log(`Installed fish completions to: ${configFile}`);
        } else {
          // For bash/zsh, add source line to config
          const sourceLine = `\n# Promptty shell completions\nsource "${completionFile}"\n`;
          appendFileSync(configFile, sourceLine);
          console.log(`Added completions to: ${configFile}`);
        }

        console.log(`\nRestart your shell or run:`);
        if (shell === 'fish') {
          console.log(`  source ${configFile}`);
        } else {
          console.log(`  source ${configFile}`);
        }
      } catch (error) {
        console.error(`Failed to install: ${error instanceof Error ? error.message : error}`);
        process.exit(1);
      }
      return;
    }

    // Default: show instructions
    console.log(`Detected shell: ${shell}\n`);

    if (isAlreadyInstalled(shell)) {
      console.log(`✓ Completions appear to be already installed.`);
      console.log(`  Config: ${getShellConfigFile(shell)}\n`);
    }

    console.log(`To install completions for ${shell}:\n`);

    switch (shell) {
      case 'bash':
        console.log(`  Option 1: Auto-install (adds to ~/.bashrc)`);
        console.log(`    promptty completions --install\n`);
        console.log(`  Option 2: Manual - add to ~/.bashrc:`);
        console.log(`    source "${completionFile}"\n`);
        console.log(`  Option 3: System-wide (requires sudo):`);
        console.log(`    sudo cp "${completionFile}" /etc/bash_completion.d/promptty`);
        break;

      case 'zsh':
        console.log(`  Option 1: Auto-install (adds to ~/.zshrc)`);
        console.log(`    promptty completions --install\n`);
        console.log(`  Option 2: Manual - add to ~/.zshrc:`);
        console.log(`    source "${completionFile}"\n`);
        console.log(`  Option 3: Add to fpath (before compinit in ~/.zshrc):`);
        console.log(`    fpath=(${dirname(completionFile)} $fpath)`);
        break;

      case 'fish':
        console.log(`  Option 1: Auto-install`);
        console.log(`    promptty completions --install\n`);
        console.log(`  Option 2: Manual copy:`);
        console.log(`    cp "${completionFile}" ~/.config/fish/completions/`);
        break;
    }

    console.log(`\nTo print the completion script:`);
    console.log(`  promptty completions --print`);
  });
