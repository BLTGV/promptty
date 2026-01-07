# Fish completion for promptty
# Install: copy to ~/.config/fish/completions/promptty.fish
#   cp /path/to/promptty/completions/promptty.fish ~/.config/fish/completions/

# Helper function to list instances
function __promptty_instances
    set -l instances_dir "$HOME/.promptty/instances"
    if test -d "$instances_dir"
        for dir in $instances_dir/*/
            basename $dir
        end
    end
end

# Helper to check if we're completing a specific command
function __promptty_needs_command
    set -l cmd (commandline -opc)
    test (count $cmd) -eq 1
end

function __promptty_using_command
    set -l cmd (commandline -opc)
    test (count $cmd) -ge 2; and test "$cmd[2]" = "$argv[1]"
end

function __promptty_using_subcommand
    set -l cmd (commandline -opc)
    test (count $cmd) -ge 3; and test "$cmd[2]" = "$argv[1]"; and test "$cmd[3]" = "$argv[2]"
end

function __promptty_needs_subcommand
    set -l cmd (commandline -opc)
    test (count $cmd) -eq 2
end

function __promptty_needs_instance
    set -l cmd (commandline -opc)
    test (count $cmd) -eq 3
end

# Disable file completions for promptty
complete -c promptty -f

# Main commands
complete -c promptty -n __promptty_needs_command -a serve -d "Start the Promptty server for an instance"
complete -c promptty -n __promptty_needs_command -a init -d "Initialize a new Promptty instance"
complete -c promptty -n __promptty_needs_command -a list -d "List all Promptty instances"
complete -c promptty -n __promptty_needs_command -a config -d "Manage instance configuration"
complete -c promptty -n __promptty_needs_command -a service -d "Manage systemd service for an instance"
complete -c promptty -n __promptty_needs_command -a mcp -d "Manage MCP server for an instance"
complete -c promptty -n __promptty_needs_command -a completions -d "Install or show shell completions"
complete -c promptty -n __promptty_needs_command -a help -d "Display help information"

# serve <instance>
complete -c promptty -n "__promptty_using_command serve; and __promptty_needs_subcommand" -a "(__promptty_instances)" -d "Instance"

# init <name>
complete -c promptty -n "__promptty_using_command init; and __promptty_needs_subcommand" -a "(__promptty_instances)" -d "Instance"

# config subcommands
complete -c promptty -n "__promptty_using_command config; and __promptty_needs_subcommand" -a show -d "Show instance configuration"
complete -c promptty -n "__promptty_using_command config; and __promptty_needs_subcommand" -a channel -d "Manage channel configuration"
complete -c promptty -n "__promptty_using_command config; and __promptty_needs_subcommand" -a credential -d "Manage credentials"

# config <subcommand> <instance>
complete -c promptty -n "__promptty_using_subcommand config show; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"
complete -c promptty -n "__promptty_using_subcommand config channel; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"
complete -c promptty -n "__promptty_using_subcommand config credential; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"

# service subcommands
complete -c promptty -n "__promptty_using_command service; and __promptty_needs_subcommand" -a install -d "Install systemd service"
complete -c promptty -n "__promptty_using_command service; and __promptty_needs_subcommand" -a uninstall -d "Uninstall systemd service"
complete -c promptty -n "__promptty_using_command service; and __promptty_needs_subcommand" -a enable -d "Enable service auto-start"
complete -c promptty -n "__promptty_using_command service; and __promptty_needs_subcommand" -a disable -d "Disable service auto-start"
complete -c promptty -n "__promptty_using_command service; and __promptty_needs_subcommand" -a start -d "Start the service"
complete -c promptty -n "__promptty_using_command service; and __promptty_needs_subcommand" -a stop -d "Stop the service"
complete -c promptty -n "__promptty_using_command service; and __promptty_needs_subcommand" -a restart -d "Restart the service"
complete -c promptty -n "__promptty_using_command service; and __promptty_needs_subcommand" -a status -d "Show service status"
complete -c promptty -n "__promptty_using_command service; and __promptty_needs_subcommand" -a logs -d "View service logs"
complete -c promptty -n "__promptty_using_command service; and __promptty_needs_subcommand" -a list -d "List all promptty services"

# service <subcommand> <instance>
complete -c promptty -n "__promptty_using_subcommand service install; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"
complete -c promptty -n "__promptty_using_subcommand service uninstall; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"
complete -c promptty -n "__promptty_using_subcommand service enable; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"
complete -c promptty -n "__promptty_using_subcommand service disable; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"
complete -c promptty -n "__promptty_using_subcommand service start; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"
complete -c promptty -n "__promptty_using_subcommand service stop; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"
complete -c promptty -n "__promptty_using_subcommand service restart; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"
complete -c promptty -n "__promptty_using_subcommand service status; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"
complete -c promptty -n "__promptty_using_subcommand service logs; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"

# mcp subcommands
complete -c promptty -n "__promptty_using_command mcp; and __promptty_needs_subcommand" -a install -d "Install MCP server to working directories"
complete -c promptty -n "__promptty_using_command mcp; and __promptty_needs_subcommand" -a status -d "Check MCP server installation status"
complete -c promptty -n "__promptty_using_command mcp; and __promptty_needs_subcommand" -a uninstall -d "Remove MCP server from working directories"

# mcp <subcommand> <instance>
complete -c promptty -n "__promptty_using_subcommand mcp install; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"
complete -c promptty -n "__promptty_using_subcommand mcp status; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"
complete -c promptty -n "__promptty_using_subcommand mcp uninstall; and __promptty_needs_instance" -a "(__promptty_instances)" -d "Instance"

# completions options
complete -c promptty -n "__promptty_using_command completions" -l bash -d "Use bash completions"
complete -c promptty -n "__promptty_using_command completions" -l zsh -d "Use zsh completions"
complete -c promptty -n "__promptty_using_command completions" -l fish -d "Use fish completions"
complete -c promptty -n "__promptty_using_command completions" -l print -d "Print completion script to stdout"
complete -c promptty -n "__promptty_using_command completions" -l install -d "Install completions to shell config"
