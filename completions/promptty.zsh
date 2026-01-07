#compdef promptty
# Zsh completion for promptty
# Install: add to your fpath or source this file
#   fpath=(/path/to/promptty/completions $fpath)
#   autoload -Uz compinit && compinit
# Or copy to a directory in your fpath (e.g., ~/.zsh/completions/)

_promptty_instances() {
    local instances_dir="${HOME}/.promptty/instances"
    if [[ -d "$instances_dir" ]]; then
        local -a instances
        instances=(${instances_dir}/*(/:t))
        _describe 'instance' instances
    fi
}

_promptty() {
    local context state state_descr line
    typeset -A opt_args

    _arguments -C \
        '1: :->command' \
        '2: :->subcommand' \
        '3: :->argument' \
        '*::arg:->args'

    case "$state" in
        command)
            local -a commands
            commands=(
                'serve:Start the Promptty server for an instance'
                'init:Initialize a new Promptty instance'
                'list:List all Promptty instances'
                'config:Manage instance configuration'
                'service:Manage systemd service for an instance'
                'mcp:Manage MCP server for an instance'
                'completions:Install or show shell completions'
                'help:Display help information'
            )
            _describe 'command' commands
            ;;
        subcommand)
            case "${line[1]}" in
                serve|init)
                    _promptty_instances
                    ;;
                config)
                    local -a config_subcommands
                    config_subcommands=(
                        'show:Show instance configuration'
                        'channel:Manage channel configuration'
                        'credential:Manage credentials'
                    )
                    _describe 'subcommand' config_subcommands
                    ;;
                service)
                    local -a service_subcommands
                    service_subcommands=(
                        'install:Install systemd service'
                        'uninstall:Uninstall systemd service'
                        'enable:Enable service auto-start'
                        'disable:Disable service auto-start'
                        'start:Start the service'
                        'stop:Stop the service'
                        'restart:Restart the service'
                        'status:Show service status'
                        'logs:View service logs'
                        'list:List all promptty services'
                    )
                    _describe 'subcommand' service_subcommands
                    ;;
                mcp)
                    local -a mcp_subcommands
                    mcp_subcommands=(
                        'install:Install MCP server to working directories'
                        'status:Check MCP server installation status'
                        'uninstall:Remove MCP server from working directories'
                    )
                    _describe 'subcommand' mcp_subcommands
                    ;;
                completions)
                    local -a completions_options
                    completions_options=(
                        '--bash:Use bash completions'
                        '--zsh:Use zsh completions'
                        '--fish:Use fish completions'
                        '--print:Print completion script to stdout'
                        '--install:Install completions to shell config'
                    )
                    _describe 'option' completions_options
                    ;;
            esac
            ;;
        argument)
            case "${line[1]}" in
                config|service|mcp)
                    _promptty_instances
                    ;;
            esac
            ;;
    esac
}

_promptty "$@"
