import type { Message } from "discord.js";
import type { BotClient } from "../client";
import { config } from "../config";
import { handleDynamicLeaderboardPrefixCommand } from "../modules/leaderboard/commands";
import { errorEmbed } from "../utils/embeds";

interface GuildLeaderboardRow {
  name: string;
  emoji: string;
  aliases: string;
}

export function getGuildPrefix(client: BotClient, guildId: string): string {
  const row = client.db
    .query<{ prefix: string }, [string]>(
      "SELECT prefix FROM guild_settings WHERE guild_id = ?",
    )
    .get(guildId);
  return row?.prefix ?? config.defaultPrefix;
}

export function getGuildLeaderboardAliases(
  client: BotClient,
  guildId: string,
): Array<{ name: string; emoji: string; aliases: string[] }> {
  const rows = client.db
    .query<GuildLeaderboardRow, [string]>(
      `SELECT name, emoji, aliases
       FROM guild_leaderboards
       WHERE guild_id = ?`,
    )
    .all(guildId);

  return rows.map((row) => {
    let aliases: string[] = [];

    try {
      const parsed = JSON.parse(row.aliases);
      if (Array.isArray(parsed)) {
        aliases = parsed
          .filter((alias): alias is string => typeof alias === "string")
          .map((alias) => alias.toLowerCase());
      }
    } catch {
      aliases = [];
    }

    return {
      name: row.name,
      emoji: row.emoji,
      aliases,
    };
  });
}

export function getDynamicLeaderboardByAlias(
  client: BotClient,
  guildId: string,
  alias: string,
): { name: string; emoji: string; aliases: string[] } | null {
  return (
    getGuildLeaderboardAliases(client, guildId).find((leaderboard) =>
      leaderboard.aliases.includes(alias.toLowerCase()),
    ) ?? null
  );
}

export async function handlePrefixCommand(
  client: BotClient,
  message: Message,
): Promise<void> {
  if (message.author.bot || !message.guild) return;

  const prefix = getGuildPrefix(client, message.guild.id);
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;

  const command = client.prefixCommands.get(commandName);
  const dynamicLeaderboard = command
    ? null
    : getDynamicLeaderboardByAlias(client, message.guild.id, commandName);

  if (!command && !dynamicLeaderboard) return;

  if (command?.adminOnly && !message.member?.permissions.has("Administrator")) {
    await message
      .reply({ embeds: [errorEmbed("You need Administrator permission to use this command.")] })
      .catch(() => {});
    return;
  }

  try {
    if (command) {
      await command.execute(message, args, client);
      return;
    }

    if (dynamicLeaderboard) {
      await handleDynamicLeaderboardPrefixCommand(message, args, client, dynamicLeaderboard);
    }
  } catch (error) {
    console.error(`Prefix command error [${commandName}]:`, error);
    await message
      .reply({ embeds: [errorEmbed("Something went wrong executing that command.")] })
      .catch(() => {});
  }
}
