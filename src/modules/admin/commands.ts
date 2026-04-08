import {
  ApplicationCommandType,
  ContextMenuCommandBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  type Message,
  type MessageContextMenuCommandInteraction,
} from "discord.js";
import type { BotClient } from "../../client";
import { getGuildPrefix } from "../../core/router";
import { baseEmbed, errorEmbed, successEmbed } from "../../utils/embeds";
import { isAdmin } from "../../utils/permissions";
import { getGuildSelfReactPenalty } from "../emoji-tracker/queries";

const DEBUG_MESSAGE_COMMAND_NAME = "Debug Message";
const DEBUG_FIELD_LIMIT = 1024;
const DEBUG_TOTAL_LIMIT = 5500;

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
  .addSubcommand((sub) =>
    sub
      .setName("fmbot")
      .setDescription("Set the fmbot user ID for this server")
      .addUserOption((opt) =>
        opt.setName("bot").setDescription("The fmbot bot user (mention or ID)").setRequired(true),
      ),
  )
  .addSubcommand((sub) =>
    sub
      .setName("fmbot-prefix")
      .setDescription("Set the fmbot command prefix for this server")
      .addStringOption((opt) =>
        opt.setName("prefix").setDescription("The fmbot prefix (e.g., .)").setRequired(true),
      ),
  )
  .addSubcommand((sub) => sub.setName("info").setDescription("Show current bot settings"));

export const debugMessageContextMenu = new ContextMenuCommandBuilder()
  .setName(DEBUG_MESSAGE_COMMAND_NAME)
  .setType(ApplicationCommandType.Message);

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

function upsertFmbotUser(client: BotClient, guildId: string, botId: string): void {
  client.db
    .prepare(
      `INSERT INTO guild_settings (guild_id, fmbot_user_id)
       VALUES (?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET fmbot_user_id = excluded.fmbot_user_id`,
    )
    .run(guildId, botId);
}

function upsertFmbotPrefix(client: BotClient, guildId: string, prefix: string): void {
  client.db
    .prepare(
      `INSERT INTO guild_settings (guild_id, fmbot_prefix)
       VALUES (?, ?)
       ON CONFLICT(guild_id) DO UPDATE SET fmbot_prefix = excluded.fmbot_prefix`,
    )
    .run(guildId, prefix);
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 3)}...`;
}

function escapeInlineCode(value: string): string {
  return value.replaceAll("`", "ˋ");
}

function addDebugField(
  fields: { name: string; value: string; inline?: boolean }[],
  name: string,
  value: string,
  inline = false,
): void {
  const normalizedValue = truncate(value, DEBUG_FIELD_LIMIT);
  const currentLength = fields.reduce(
    (sum, field) => sum + field.name.length + field.value.length,
    0,
  );
  if (currentLength + name.length + normalizedValue.length > DEBUG_TOTAL_LIMIT) return;
  fields.push({ name, value: normalizedValue, inline });
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
  const fmbotRow = client.db
    .query<{ fmbot_user_id: string | null; fmbot_prefix: string | null }, [string]>(
      `SELECT fmbot_user_id, fmbot_prefix FROM guild_settings WHERE guild_id = ?`,
    )
    .get(guildId);

  await respond(
    baseEmbed()
      .setTitle("Server Settings")
      .addFields(
        { name: "Prefix", value: `\`${prefix}\``, inline: true },
        { name: "Custom Leaderboards", value: `${leaderboardCount}`, inline: true },
        { name: "Reaction Events Tracked", value: `${eventCount}`, inline: true },
        { name: "Self-React Penalty", value: selfReactPenalty ? "on" : "off", inline: true },
        {
          name: "fmbot User",
          value: fmbotRow?.fmbot_user_id
            ? `<@${fmbotRow.fmbot_user_id}> (\`${fmbotRow.fmbot_user_id}\`)`
            : "Not configured",
          inline: true,
        },
        {
          name: "fmbot Prefix",
          value: fmbotRow?.fmbot_prefix
            ? `\`${fmbotRow.fmbot_prefix}\``
            : "Not configured (module off)",
          inline: true,
        },
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
        value: [
          "`prefix <new-prefix>` — Set prefix",
          "`selfreact <on|off>` — Toggle self-react penalty",
          "`fmbot <@bot or ID>` — Set fmbot bot user",
          "`fmbot-prefix <prefix>` — Set fmbot command prefix",
          "`info` — Show current settings",
        ].join("\n"),
      },
      {
        name: "Examples",
        value: `\`${prefix}settings prefix ?\`\n\`${prefix}settings fmbot @.fmbot\`\n\`${prefix}settings fmbot-prefix .\`\n\`${prefix}settings info\``,
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

  if (subcommand === "fmbot") {
    const bot = interaction.options.getUser("bot", true);
    if (!bot.bot) {
      await interaction.reply({
        embeds: [errorEmbed("That user is not a bot.")],
        ephemeral: true,
      });
      return;
    }

    upsertFmbotUser(client, interaction.guildId, bot.id);
    await interaction.reply({
      embeds: [successEmbed(`fmbot user set to ${bot.tag} (\`${bot.id}\`).`)],
    });
    return;
  }

  if (subcommand === "fmbot-prefix") {
    const fmPrefix = interaction.options.getString("prefix", true).trim();
    if (!isValidPrefix(fmPrefix)) {
      await interaction.reply({
        embeds: [errorEmbed("Prefix must be 1-5 non-space characters.")],
        ephemeral: true,
      });
      return;
    }

    upsertFmbotPrefix(client, interaction.guildId, fmPrefix);
    await interaction.reply({
      embeds: [successEmbed(`fmbot prefix set to \`${fmPrefix}\`.`)],
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

  if (subcommand === "fmbot") {
    const input = args[1]?.trim();
    if (!input || args.length !== 2) {
      await message.reply({ embeds: [buildSettingsUsageEmbed(prefix)] });
      return;
    }

    const match = input.match(/^<@!?(\d+)>$/) ?? input.match(/^(\d{17,20})$/);
    if (!match) {
      await message.reply({ embeds: [errorEmbed("Provide a bot mention or user ID.")] });
      return;
    }

    const botId = match[1];
    upsertFmbotUser(client, message.guild.id, botId);
    await message.reply({ embeds: [successEmbed(`fmbot user set to \`${botId}\`.`)] });
    return;
  }

  if (subcommand === "fmbot-prefix") {
    const fmPrefix = args[1]?.trim();
    if (!fmPrefix || args.length !== 2 || !isValidPrefix(fmPrefix)) {
      await message.reply({ embeds: [buildSettingsUsageEmbed(prefix)] });
      return;
    }

    upsertFmbotPrefix(client, message.guild.id, fmPrefix);
    await message.reply({ embeds: [successEmbed(`fmbot prefix set to \`${fmPrefix}\`.`)] });
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

export async function handleDebugMessageContextMenu(
  interaction: MessageContextMenuCommandInteraction,
  _client: BotClient,
): Promise<boolean> {
  if (interaction.commandName !== DEBUG_MESSAGE_COMMAND_NAME) return false;

  if (!isAdmin(interaction.user.id, interaction.member as GuildMember | null)) {
    await interaction.reply({
      embeds: [errorEmbed("You need Administrator permission to use this.")],
      ephemeral: true,
    });
    return true;
  }

  const msg = interaction.targetMessage;
  const fields: { name: string; value: string; inline?: boolean }[] = [];

  addDebugField(fields, "Message ID", `\`${msg.id}\``, true);
  addDebugField(fields, "Channel", `<#${msg.channelId}> (\`${msg.channelId}\`)`, true);
  addDebugField(
    fields,
    "Author",
    `${msg.author.tag} (\`${msg.author.id}\`)${msg.author.bot ? " **[BOT]**" : ""}`,
  );

  const interactionUser = msg.interactionMetadata?.user ?? msg.interaction?.user;
  if (interactionUser) {
    addDebugField(fields, "Slash Invoker", `${interactionUser.tag} (\`${interactionUser.id}\`)`);
  }

  if (msg.content) {
    addDebugField(fields, "Content", truncate(escapeInlineCode(msg.content), 300));
  }

  const embedSummaries = msg.embeds
    .map((embedded, index) => {
      const parts: string[] = [];
      if (embedded.title)
        parts.push(`**Title:** ${truncate(escapeInlineCode(embedded.title), 100)}`);
      if (embedded.author?.name) {
        parts.push(`**Author:** ${truncate(escapeInlineCode(embedded.author.name), 100)}`);
      }
      if (embedded.description) {
        parts.push(`**Desc:** ${truncate(escapeInlineCode(embedded.description), 200)}`);
      }
      if (embedded.fields.length > 0) parts.push(`**Fields:** ${embedded.fields.length}`);
      if (embedded.footer?.text) {
        parts.push(`**Footer:** ${truncate(escapeInlineCode(embedded.footer.text), 100)}`);
      }
      if (embedded.color !== null) {
        parts.push(`**Color:** \`#${embedded.color.toString(16).padStart(6, "0")}\``);
      }
      if (embedded.image?.url) parts.push("**Image:** yes");
      if (embedded.thumbnail?.url) parts.push("**Thumbnail:** yes");
      if (parts.length === 0) return "";
      return `**Embed ${index + 1}:**\n${parts.join("\n")}`;
    })
    .filter(Boolean);

  if (embedSummaries.length > 0) {
    addDebugField(fields, `Embeds (${msg.embeds.length})`, embedSummaries.join("\n\n"));
  }

  for (const [index, embedded] of msg.embeds.entries()) {
    if (embedded.fields.length === 0) continue;
    const fieldDump = embedded.fields
      .map(
        (field, fieldIndex) =>
          `\`${fieldIndex}\` **${truncate(escapeInlineCode(field.name), 50)}**: ${truncate(escapeInlineCode(field.value), 100)}`,
      )
      .join("\n");
    if (fieldDump) {
      addDebugField(fields, `Embed ${index + 1} Fields (${embedded.fields.length})`, fieldDump);
    }
  }

  if (msg.components.length > 0) {
    addDebugField(fields, "Components", `${msg.components.length} action row(s)`, true);
  }

  if (msg.attachments.size > 0) {
    addDebugField(fields, "Attachments", `${msg.attachments.size} file(s)`, true);
  }

  addDebugField(fields, "Created", `<t:${Math.floor(msg.createdTimestamp / 1000)}:F>`, true);

  const embed = baseEmbed().setTitle("🔍 Message Debug").addFields(fields);
  await interaction.reply({ embeds: [embed], ephemeral: true });
  return true;
}

export async function handleAdminSlashCommand(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
): Promise<boolean> {
  if (interaction.commandName !== "settings") return false;
  await handleSettingsSlashCommandInner(interaction, client);
  return true;
}
