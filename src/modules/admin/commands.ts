import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Message,
} from "discord.js";
import type { BotClient } from "../../client";
import { getGuildPrefix } from "../../core/router";
import { baseEmbed, errorEmbed, successEmbed } from "../../utils/embeds";

export const settingsSlashCommand = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Bot settings for this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("prefix")
      .setDescription("Set the prefix for this server")
      .addStringOption((opt) =>
        opt
          .setName("prefix")
          .setDescription("New prefix (e.g., !, ?, .)")
          .setRequired(true),
      ),
  )
  .addSubcommand((sub) => sub.setName("info").setDescription("Show current bot settings"));

function isValidPrefix(prefix: string): boolean {
  return prefix.length >= 1 && prefix.length <= 5 && !/\s/.test(prefix);
}

async function replySettingsInfo(
  guildId: string,
  client: BotClient,
  respond: (embed: ReturnType<typeof baseEmbed>) => Promise<void>,
): Promise<void> {
  const prefix = getGuildPrefix(client, guildId);
  const leaderboardCount = client.db
    .query<{ count: number }, [string]>(
      `SELECT COUNT(*) as count
       FROM guild_leaderboards
       WHERE guild_id = ?`,
    )
    .get(guildId)?.count ?? 0;
  const eventCount = client.db
    .query<{ count: number }, [string]>(
      `SELECT COUNT(*) as count
       FROM emoji_events
       WHERE guild_id = ?`,
    )
    .get(guildId)?.count ?? 0;

  await respond(
    baseEmbed()
      .setTitle("Server Settings")
      .addFields(
        { name: "Prefix", value: `\`${prefix}\``, inline: true },
        { name: "Custom Leaderboards", value: `${leaderboardCount}`, inline: true },
        { name: "Emoji Events Tracked", value: `${eventCount}`, inline: true },
      ),
  );
}

async function handleSettingsSlashCommandInner(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ embeds: [errorEmbed("This command can only be used in a server.")], ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  if (subcommand === "prefix") {
    const prefix = interaction.options.getString("prefix", true).trim();
    if (!isValidPrefix(prefix)) {
      await interaction.reply({ embeds: [errorEmbed("Prefix must be 1-5 non-space characters.")], ephemeral: true });
      return;
    }

    client.db
      .prepare(
        `INSERT INTO guild_settings (guild_id, prefix)
         VALUES (?, ?)
         ON CONFLICT(guild_id) DO UPDATE SET prefix = excluded.prefix`,
      )
      .run(interaction.guildId, prefix);

    await interaction.reply({ embeds: [successEmbed(`Server prefix updated to \`${prefix}\`.`)] });
    return;
  }

  await replySettingsInfo(interaction.guildId, client, async (embed) => {
    await interaction.reply({ embeds: [embed] });
  });
}

export async function handleSettingsPrefixCommand(
  message: Message,
  args: string[],
  client: BotClient,
): Promise<void> {
  if (!message.guild) return;

  const subcommand = args[0]?.toLowerCase() ?? "info";
  if (subcommand === "prefix") {
    const prefix = args[1]?.trim();
    if (!prefix || !isValidPrefix(prefix)) {
      await message.reply({ embeds: [errorEmbed("Usage: `settings prefix <new-prefix>` with 1-5 non-space characters.")] });
      return;
    }

    client.db
      .prepare(
        `INSERT INTO guild_settings (guild_id, prefix)
         VALUES (?, ?)
         ON CONFLICT(guild_id) DO UPDATE SET prefix = excluded.prefix`,
      )
      .run(message.guild.id, prefix);

    await message.reply({ embeds: [successEmbed(`Server prefix updated to \`${prefix}\`.`)] });
    return;
  }

  await replySettingsInfo(message.guild.id, client, async (embed) => {
    await message.reply({ embeds: [embed] });
  });
}

export async function handleAdminSlashCommand(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
): Promise<boolean> {
  if (interaction.commandName !== "settings") {
    return false;
  }

  await handleSettingsSlashCommandInner(interaction, client);
  return true;
}
