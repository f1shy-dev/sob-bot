import {
  Events,
  SlashCommandBuilder,
  type RESTPostAPIApplicationCommandsJSONBody,
} from "discord.js";
import type { BotClient } from "../../client";
import type { Module } from "../../core/module";
import { generateAliases } from "../../utils/words";

interface GuildLeaderboardRow {
  word: string;
  emoji: string;
}

function buildDynamicCommand(
  alias: string,
  emoji: string,
  type: "leaderboard" | "mostReacted",
): RESTPostAPIApplicationCommandsJSONBody {
  return new SlashCommandBuilder()
    .setName(alias)
    .setDescription(
      type === "leaderboard"
        ? `Show the ${emoji} collected leaderboard`
        : `Show the most reacted ${emoji} messages`,
    )
    .addStringOption((opt) =>
      opt
        .setName("period")
        .setDescription("Time period")
        .setRequired(false)
        .addChoices(
          { name: "Today", value: "daily" },
          { name: "This Week", value: "weekly" },
          { name: "This Month", value: "monthly" },
          { name: "All Time", value: "alltime" },
        ),
    )
    .toJSON();
}

export function getGuildLeaderboardsForSync(
  client: BotClient,
  guildId: string,
): Array<{ word: string; emoji: string }> {
  return client.db
    .query<GuildLeaderboardRow, [string]>(
      `SELECT word, emoji FROM guild_leaderboards WHERE guild_id = ? ORDER BY word ASC`,
    )
    .all(guildId);
}

export async function registerGuildLeaderboardCommands(
  client: BotClient,
  guildId: string,
): Promise<void> {
  if (!client.application) return;

  const commands = getGuildLeaderboardsForSync(client, guildId).flatMap((leaderboard) => {
    const aliases = generateAliases(leaderboard.word);
    return [
      ...aliases.leaderboard.map((alias) =>
        buildDynamicCommand(alias, leaderboard.emoji, "leaderboard"),
      ),
      ...aliases.mostReacted.map((alias) =>
        buildDynamicCommand(alias, leaderboard.emoji, "mostReacted"),
      ),
    ];
  });

  await client.application.commands.set(commands, guildId);
}

async function handleGuildCreate(client: BotClient, guild: { id: string }): Promise<void> {
  await registerGuildLeaderboardCommands(client, guild.id);
}

export async function syncAllGuildLeaderboardCommands(client: BotClient): Promise<void> {
  for (const guild of client.guilds.cache.values()) {
    await registerGuildLeaderboardCommands(client, guild.id);
  }
}

export const customLeaderboardSyncEvents: Module["events"] = [
  { event: Events.GuildCreate, handler: handleGuildCreate },
];
