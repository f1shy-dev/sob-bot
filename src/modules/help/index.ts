import type { Module } from "../../core/module";
import { handleHelpPrefixCommand, handleHelpSlashCommand, helpSlashCommand } from "./commands";

export const helpModule: Module = {
  name: "help",
  slashCommands: [helpSlashCommand],
  prefixCommands: [
    {
      aliases: ["help"],
      description: "Show all available commands",
      execute: handleHelpPrefixCommand,
    },
  ],
  handleSlashCommand: handleHelpSlashCommand,
};
