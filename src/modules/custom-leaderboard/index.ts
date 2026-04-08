import type { Module } from "../../core/module";
import {
  defineLeaderboardSlashCommand,
  handleCustomLeaderboardSlashCommand,
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
  events: customLeaderboardSyncEvents,
  onReady: syncAllGuildLeaderboardCommands,
  handleSlashCommand: handleCustomLeaderboardSlashCommand,
};
