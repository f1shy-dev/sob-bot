import type { Module } from "../../core/module";
import {
  debugMessageContextMenu,
  handleAdminSlashCommand,
  handleDebugMessageContextMenu,
  handleSettingsPrefixCommand,
  settingsSlashCommand,
} from "./commands";

export const adminModule: Module = {
  name: "admin",
  slashCommands: [settingsSlashCommand, debugMessageContextMenu],
  prefixCommands: [
    {
      aliases: ["settings"],
      description: "Manage server settings",
      adminOnly: true,
      execute: handleSettingsPrefixCommand,
    },
  ],
  handleSlashCommand: handleAdminSlashCommand,
  handleContextMenuCommand: handleDebugMessageContextMenu,
};
