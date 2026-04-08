import type { Module } from "../../core/module";
import {
  defineLeaderboardSlashCommand,
  handleCustomLeaderboardSlashCommand,
  handleDefineLeaderboardPrefixCommand,
  handleListLeaderboardsPrefixCommand,
  handleRemoveLeaderboardPrefixCommand,
  listLeaderboardsSlashCommand,
  removeLeaderboardSlashCommand,
} from "./commands";
import { customLeaderboardSyncEvents, syncAllGuildLeaderboardCommands } from "./sync";

export const customLeaderboardModule: Module = {
  name: "custom-leaderboard",
  slashCommands: [
    defineLeaderboardSlashCommand,
    removeLeaderboardSlashCommand,
    listLeaderboardsSlashCommand,
  ],
  prefixCommands: [
    {
      aliases: ["define-leaderboard", "deflb"],
      description: "Create a custom leaderboard",
      adminOnly: true,
      execute: handleDefineLeaderboardPrefixCommand,
    },
    {
      aliases: ["remove-leaderboard", "rmlb"],
      description: "Remove a custom leaderboard",
      adminOnly: true,
      execute: handleRemoveLeaderboardPrefixCommand,
    },
    {
      aliases: ["list-leaderboards", "listlb"],
      description: "List custom leaderboards",
      execute: handleListLeaderboardsPrefixCommand,
    },
  ],
  events: customLeaderboardSyncEvents,
  onReady: syncAllGuildLeaderboardCommands,
  handleSlashCommand: handleCustomLeaderboardSlashCommand,
};
