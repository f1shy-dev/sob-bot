import type { Module } from "../../core/module";
import {
  emojiLeaderboardSlashCommand,
  emojiMostReactedSlashCommand,
  handleEmojiLeaderboardPrefixCommand,
  handleEmojiLeaderboardSlashCommand,
  handleEmojiMostReactedPrefixCommand,
  handleEmojiMostReactedSlashCommand,
} from "./commands";

export const leaderboardModule: Module = {
  name: "leaderboard",
  slashCommands: [emojiLeaderboardSlashCommand, emojiMostReactedSlashCommand],
  prefixCommands: [
    {
      aliases: ["emojileaderboard", "elb"],
      description: "Show the leaderboard for an emoji",
      execute: handleEmojiLeaderboardPrefixCommand,
    },
    {
      aliases: ["emojimosreacted", "emr"],
      description: "Show the most reacted messages for an emoji",
      execute: handleEmojiMostReactedPrefixCommand,
    },
  ],
  handleSlashCommand: async (interaction, client) => {
    if (await handleEmojiLeaderboardSlashCommand(interaction, client)) return true;
    return handleEmojiMostReactedSlashCommand(interaction, client);
  },
};
