import type { Module } from "../../core/module";
import {
  debugMessageContextMenu,
  handleAdminSlashCommand,
  handleDebugMessageContextMenu,
  handleSettingsPrefixCommand,
  handleSqlPrefixCommand,
  settingsSlashCommand,
  sqlSlashCommand,
} from "./commands";

export const adminModule: Module = {
  name: "admin",
  slashCommands: [settingsSlashCommand, sqlSlashCommand, debugMessageContextMenu],
  prefixCommands: [
    {
      aliases: ["settings"],
      description: "Manage server settings",
      adminOnly: true,
      execute: handleSettingsPrefixCommand,
    },
    {
      aliases: ["sql"],
      description: "Execute SQL against the bot database",
      execute: handleSqlPrefixCommand,
    },
  ],
  handleSlashCommand: handleAdminSlashCommand,
  handleContextMenuCommand: handleDebugMessageContextMenu,
};
