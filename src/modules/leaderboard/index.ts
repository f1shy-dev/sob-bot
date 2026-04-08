import type { Module } from "../../core/module";
import {
  emojiLeaderboardSlashCommand,
  handleEmojiLeaderboardPrefixCommand,
  handleEmojiLeaderboardSlashCommand,
} from "./commands";

export const leaderboardModule: Module = {
  name: "leaderboard",
  slashCommands: [emojiLeaderboardSlashCommand],
  prefixCommands: [
    {
      aliases: ["emojileaderboard", "elb"],
      description: "Show the leaderboard for an emoji",
      execute: handleEmojiLeaderboardPrefixCommand,
    },
  ],
  handleSlashCommand: handleEmojiLeaderboardSlashCommand,
};
