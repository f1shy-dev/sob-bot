import type { Message } from "discord.js";
import type { BotClient } from "../client";
import { config } from "../config";

export function getGuildPrefix(client: BotClient, guildId: string): string {
  const row = client.db
    .query<{ prefix: string }, [string]>(
      "SELECT prefix FROM guild_settings WHERE guild_id = ?",
    )
    .get(guildId);
  return row?.prefix ?? config.defaultPrefix;
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
  if (!command) return;

  if (command.adminOnly && !message.member?.permissions.has("Administrator")) {
    await message.reply("You need Administrator permission to use this command.");
    return;
  }

  try {
    await command.execute(message, args, client);
  } catch (error) {
    console.error(`Prefix command error [${commandName}]:`, error);
    await message
      .reply("Something went wrong executing that command.")
      .catch(() => {});
  }
}
