import {
  Events,
  SlashCommandBuilder,
  type RESTPostAPIApplicationCommandsJSONBody,
} from "discord.js";
import type { BotClient } from "../../client";
import type { Module } from "../../core/module";

interface GuildLeaderboardRow {
  name: string;
  emoji: string;
  aliases: string;
}

function buildDynamicLeaderboardCommand(
  alias: string,
  emoji: string,
): RESTPostAPIApplicationCommandsJSONBody {
  return new SlashCommandBuilder()
    .setName(alias)
    .setDescription(`Show the ${emoji} leaderboard`)
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
): Array<{ name: string; emoji: string; aliases: string[] }> {
  const rows = client.db
    .query<GuildLeaderboardRow, [string]>(
      `SELECT name, emoji, aliases
       FROM guild_leaderboards
       WHERE guild_id = ?
       ORDER BY name ASC`,
    )
    .all(guildId);

  return rows.map((row) => ({
    name: row.name,
    emoji: row.emoji,
    aliases: JSON.parse(row.aliases) as string[],
  }));
}

export async function registerGuildLeaderboardCommands(
  client: BotClient,
  guildId: string,
): Promise<void> {
  if (!client.application) return;

  const commands = getGuildLeaderboardsForSync(client, guildId).flatMap((leaderboard) =>
    leaderboard.aliases.map((alias) => buildDynamicLeaderboardCommand(alias, leaderboard.emoji)),
  );

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
