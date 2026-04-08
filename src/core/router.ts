import type { Message } from "discord.js";
import type { BotClient } from "../client";
import { config } from "../config";
import {
  handleDynamicLeaderboardPrefixCommand,
  handleDynamicMostReactedPrefixCommand,
} from "../modules/leaderboard/commands";
import { errorEmbed } from "../utils/embeds";
import { isAdmin } from "../utils/permissions";
import { generateAliases } from "../utils/words";

interface GuildLeaderboardRow {
  word: string;
  emoji: string;
}

export type DynamicMatch =
  | { type: "leaderboard"; emoji: string; word: string }
  | { type: "mostReacted"; emoji: string; word: string };

export function getGuildPrefix(client: BotClient, guildId: string): string {
  const row = client.db
    .query<{ prefix: string }, [string]>("SELECT prefix FROM guild_settings WHERE guild_id = ?")
    .get(guildId);
  return row?.prefix ?? config.defaultPrefix;
}

export function getGuildLeaderboards(
  client: BotClient,
  guildId: string,
): Array<{ word: string; emoji: string }> {
  return client.db
    .query<GuildLeaderboardRow, [string]>(
      `SELECT word, emoji
       FROM guild_leaderboards
       WHERE guild_id = ?
       ORDER BY word ASC`,
    )
    .all(guildId);
}

export function getDynamicCommandByAlias(
  client: BotClient,
  guildId: string,
  alias: string,
): DynamicMatch | null {
  const normalized = alias.toLowerCase();

  for (const leaderboard of getGuildLeaderboards(client, guildId)) {
    const aliases = generateAliases(leaderboard.word);
    if (aliases.leaderboard.includes(normalized)) {
      return { type: "leaderboard", emoji: leaderboard.emoji, word: leaderboard.word };
    }
    if (aliases.mostReacted.includes(normalized)) {
      return { type: "mostReacted", emoji: leaderboard.emoji, word: leaderboard.word };
    }
  }

  return null;
}

export async function handlePrefixCommand(client: BotClient, message: Message): Promise<void> {
  if (message.author.bot || !message.guild) return;

  const prefix = getGuildPrefix(client, message.guild.id);
  if (!message.content.startsWith(prefix)) return;

  const args = message.content.slice(prefix.length).trim().split(/\s+/);
  const commandName = args.shift()?.toLowerCase();
  if (!commandName) return;

  const command = client.prefixCommands.get(commandName);
  const dynamicMatch = command
    ? null
    : getDynamicCommandByAlias(client, message.guild.id, commandName);

  if (!command && !dynamicMatch) {
    await message
      .reply({
        embeds: [
          errorEmbed(
            `Unknown command \`${prefix}${commandName}\`. Use \`${prefix}help\` to see available commands.`,
          ),
        ],
      })
      .catch(() => {});
    return;
  }

  if (command?.adminOnly && !isAdmin(message.author.id, message.member)) {
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

    if (dynamicMatch?.type === "leaderboard") {
      await handleDynamicLeaderboardPrefixCommand(message, args, client, dynamicMatch);
      return;
    }

    if (dynamicMatch?.type === "mostReacted") {
      await handleDynamicMostReactedPrefixCommand(message, args, client, dynamicMatch);
    }
  } catch (error) {
    console.error(`Prefix command error [${commandName}]:`, error);
    await message
      .reply({ embeds: [errorEmbed("Something went wrong executing that command.")] })
      .catch(() => {});
  }
}
