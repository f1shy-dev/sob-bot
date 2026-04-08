import type { Module } from "../../core/module";
import {
  handleAdminSlashCommand,
  handleSettingsPrefixCommand,
  settingsSlashCommand,
} from "./commands";

export const adminModule: Module = {
  name: "admin",
  slashCommands: [settingsSlashCommand],
  prefixCommands: [
    {
      aliases: ["settings"],
      description: "Manage server settings",
      adminOnly: true,
      execute: handleSettingsPrefixCommand,
    },
  ],
  handleSlashCommand: handleAdminSlashCommand,
};
