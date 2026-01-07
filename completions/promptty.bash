# Bash completion for promptty
# Install: source this file or add to ~/.bashrc
#   source /path/to/promptty/completions/promptty.bash
# Or copy to /etc/bash_completion.d/promptty

_promptty_instances() {
    local instances_dir="${HOME}/.promptty/instances"
    if [[ -d "$instances_dir" ]]; then
        find "$instances_dir" -mindepth 1 -maxdepth 1 -type d -printf '%f\n' 2>/dev/null
    fi
}

_promptty() {
    local cur prev words cword
    _init_completion || return

    local commands="serve init list config service mcp help"
    local config_subcommands="show channel credential"
    local service_subcommands="install uninstall enable disable start stop restart status logs list"
    local mcp_subcommands="install status uninstall"

    case "${cword}" in
        1)
            COMPREPLY=($(compgen -W "${commands}" -- "${cur}"))
            ;;
        2)
            case "${prev}" in
                serve|init)
                    COMPREPLY=($(compgen -W "$(_promptty_instances)" -- "${cur}"))
                    ;;
                config)
                    COMPREPLY=($(compgen -W "${config_subcommands}" -- "${cur}"))
                    ;;
                service)
                    COMPREPLY=($(compgen -W "${service_subcommands}" -- "${cur}"))
                    ;;
                mcp)
                    COMPREPLY=($(compgen -W "${mcp_subcommands}" -- "${cur}"))
                    ;;
                list|help)
                    COMPREPLY=()
                    ;;
                *)
                    COMPREPLY=()
                    ;;
            esac
            ;;
        3)
            local cmd="${words[1]}"
            local subcmd="${words[2]}"
            case "${cmd}" in
                config)
                    case "${subcmd}" in
                        show|channel|credential)
                            COMPREPLY=($(compgen -W "$(_promptty_instances)" -- "${cur}"))
                            ;;
                    esac
                    ;;
                service)
                    case "${subcmd}" in
                        install|uninstall|enable|disable|start|stop|restart|status|logs)
                            COMPREPLY=($(compgen -W "$(_promptty_instances)" -- "${cur}"))
                            ;;
                    esac
                    ;;
                mcp)
                    case "${subcmd}" in
                        install|status|uninstall)
                            COMPREPLY=($(compgen -W "$(_promptty_instances)" -- "${cur}"))
                            ;;
                    esac
                    ;;
            esac
            ;;
    esac
}

complete -F _promptty promptty
