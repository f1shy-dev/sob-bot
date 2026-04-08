import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  type Message,
} from "discord.js";
import type { BotClient } from "../../client";
import { getGuildPrefix } from "../../core/router";
import { baseEmbed, errorEmbed, successEmbed } from "../../utils/embeds";
import { isAdmin } from "../../utils/permissions";
import { getGuildSelfReactPenalty } from "../emoji-tracker/queries";

export const settingsSlashCommand = new SlashCommandBuilder()
  .setName("settings")
  .setDescription("Bot settings for this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((sub) =>
    sub
      .setName("prefix")
      .setDescription("Set the prefix for this server")
      .addStringOption((opt) =>
        opt.setName("prefix").setDescription("New prefix (e.g., !, ?, .)").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("selfreact")
      .setDescription("Toggle self-react penalty")
      .addStringOption((opt) =>
        opt
          .setName("mode")
          .setDescription("on or off")
          .setRequired(true)
          .addChoices(
            { name: "On (self-reacts count as -1)", value: "on" },
            { name: "Off (self-reacts ignored)", value: "off" },
          ),
      ),
  )
  .addSubcommand((sub) => sub.setName("info").setDescription("Show current bot settings"));

function isValidPrefix(prefix: string): boolean {
  return prefix.length >= 1 && prefix.length <= 5 && !/\s/.test(prefix);
}

function upsertPrefix(client: BotClient, guildId: string, prefix: string): void {
  client.db
    .prepare(
      `INSERT INTO guild_settings (guild_id, prefix)
       VALUES (?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET prefix = excluded.prefix`,
    )
    .run(guildId, prefix);
}

function upsertSelfReactPenalty(client: BotClient, guildId: string, enabled: boolean): void {
  client.db
    .prepare(
      `INSERT INTO guild_settings (guild_id, self_react_penalty)
       VALUES (?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET self_react_penalty = excluded.self_react_penalty`,
    )
    .run(guildId, enabled ? 1 : 0);
}

async function replySettingsInfo(
  guildId: string,
  client: BotClient,
  respond: (embed: ReturnType<typeof baseEmbed>) => Promise<void>,
): Promise<void> {
  const prefix = getGuildPrefix(client, guildId);
  const leaderboardCount =
    client.db
      .query<{ count: number }, [string]>(
        `SELECT COUNT(*) as count FROM guild_leaderboards WHERE guild_id = ?`,
      )
      .get(guildId)?.count ?? 0;
  const eventCount =
    client.db
      .query<{ count: number }, [string]>(
        `SELECT COUNT(*) as count FROM reaction_events WHERE guild_id = ?`,
      )
      .get(guildId)?.count ?? 0;
  const selfReactPenalty = getGuildSelfReactPenalty(client.db, guildId);

  await respond(
    baseEmbed()
      .setTitle("Server Settings")
      .addFields(
        { name: "Prefix", value: `\`${prefix}\``, inline: true },
        { name: "Custom Leaderboards", value: `${leaderboardCount}`, inline: true },
        { name: "Reaction Events Tracked", value: `${eventCount}`, inline: true },
        { name: "Self-React Penalty", value: selfReactPenalty ? "on" : "off", inline: true },
      ),
  );
}

function buildSettingsUsageEmbed(prefix: string) {
  return baseEmbed()
    .setTitle("Command Usage")
    .setDescription(`\`${prefix}settings <subcommand>\``)
    .addFields(
      {
        name: "Arguments",
        value:
          "`prefix <new-prefix>` — Set prefix\n`selfreact <on|off>` — Toggle self-react penalty\n`info` — Show current settings",
      },
      {
        name: "Examples",
        value: `\`${prefix}settings prefix ?\`\n\`${prefix}settings selfreact on\`\n\`${prefix}settings info\``,
      },
    );
}

async function handleSettingsSlashCommandInner(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({
      embeds: [errorEmbed("This command can only be used in a server.")],
      ephemeral: true,
    });
    return;
  }
  if (!isAdmin(interaction.user.id, interaction.member as GuildMember | null)) {
    await interaction.reply({
      embeds: [errorEmbed("You need Administrator permission to use this command.")],
      ephemeral: true,
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  if (subcommand === "prefix") {
    const prefix = interaction.options.getString("prefix", true).trim();
    if (!isValidPrefix(prefix)) {
      await interaction.reply({
        embeds: [errorEmbed("Prefix must be 1-5 non-space characters.")],
        ephemeral: true,
      });
      return;
    }

    upsertPrefix(client, interaction.guildId, prefix);
    await interaction.reply({ embeds: [successEmbed(`Server prefix updated to \`${prefix}\`.`)] });
    return;
  }

  if (subcommand === "selfreact") {
    const mode = interaction.options.getString("mode", true);
    upsertSelfReactPenalty(client, interaction.guildId, mode === "on");
    await interaction.reply({
      embeds: [successEmbed(`Self-react penalty ${mode === "on" ? "enabled" : "disabled"}.`)],
    });
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

  const prefix = getGuildPrefix(client, message.guild.id);
  const subcommand = args[0]?.toLowerCase() ?? "info";

  if (subcommand === "prefix") {
    const nextPrefix = args[1]?.trim();
    if (!nextPrefix || !isValidPrefix(nextPrefix) || args.length !== 2) {
      await message.reply({ embeds: [buildSettingsUsageEmbed(prefix)] });
      return;
    }

    upsertPrefix(client, message.guild.id, nextPrefix);
    await message.reply({ embeds: [successEmbed(`Server prefix updated to \`${nextPrefix}\`.`)] });
    return;
  }

  if (subcommand === "selfreact") {
    const mode = args[1]?.toLowerCase();
    if ((mode !== "on" && mode !== "off") || args.length !== 2) {
      await message.reply({ embeds: [buildSettingsUsageEmbed(prefix)] });
      return;
    }

    upsertSelfReactPenalty(client, message.guild.id, mode === "on");
    await message.reply({
      embeds: [successEmbed(`Self-react penalty ${mode === "on" ? "enabled" : "disabled"}.`)],
    });
    return;
  }

  if (subcommand !== "info" || args.length > 1) {
    await message.reply({ embeds: [buildSettingsUsageEmbed(prefix)] });
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
  if (interaction.commandName !== "settings") return false;
  await handleSettingsSlashCommandInner(interaction, client);
  return true;
}
