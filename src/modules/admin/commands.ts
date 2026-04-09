import {
  AttachmentBuilder,
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
import { config } from "../../config";
import { getGuildPrefix } from "../../core/router";
import { baseEmbed, errorEmbed, successEmbed } from "../../utils/embeds";
import { isAdmin } from "../../utils/permissions";
import { getGuildSelfReactPenalty } from "../emoji-tracker/queries";

const DEBUG_MESSAGE_COMMAND_NAME = "Debug Message";
const DEBUG_FIELD_LIMIT = 1024;
const DEBUG_TOTAL_LIMIT = 5500;
const SQL_CODE_BLOCK_LIMIT = 1990;

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

export const sqlSlashCommand = new SlashCommandBuilder()
  .setName("sql")
  .setDescription("Execute SQL against the bot database")
  .addStringOption((opt) =>
    opt.setName("query").setDescription("SQL to execute").setRequired(true),
  );

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

function isGlobalAdmin(userId: string): boolean {
  return config.globalAdmins.includes(userId);
}

function formatSqlValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Uint8Array) return `[blob ${value.byteLength} bytes]`;
  return value;
}

function normalizeSqlRows(rows: unknown[]): Array<Record<string, unknown>> {
  return rows.map((row, index) => {
    if (!row || typeof row !== "object") {
      return { value: formatSqlValue(row), row_index: index };
    }

    return Object.fromEntries(
      Object.entries(row).map(([key, value]) => [key, formatSqlValue(value)]),
    );
  });
}

function formatSqlRowsJson(rows: Array<Record<string, unknown>>): string {
  return JSON.stringify(rows, null, 2);
}

function formatSqlRowsTable(rows: Array<Record<string, unknown>>): string {
  if (rows.length === 0) return "(no rows)";

  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  const stringRows = rows.map((row) =>
    Object.fromEntries(columns.map((column) => [column, String(row[column] ?? "NULL")])),
  );

  const widths = columns.map((column) => {
    const cellWidth = Math.max(...stringRows.map((row) => row[column].length));
    return Math.min(Math.max(column.length, cellWidth), 40);
  });

  const formatCell = (value: string, width: number): string => truncate(value, width).padEnd(width, " ");
  const header = columns.map((column, index) => formatCell(column, widths[index])).join(" | ");
  const divider = widths.map((width) => "-".repeat(width)).join("-+-");
  const body = stringRows.map((row) =>
    columns.map((column, index) => formatCell(row[column], widths[index])).join(" | "),
  );

  return [header, divider, ...body].join("\n");
}

async function replySqlResult(
  respond: (payload: {
    content?: string;
    embeds?: ReturnType<typeof baseEmbed>[];
    files?: AttachmentBuilder[];
    ephemeral?: boolean;
  }) => Promise<void>,
  sql: string,
  client: BotClient,
  ephemeral = false,
): Promise<void> {
  const startedAt = performance.now();
  const statement = client.db.prepare(sql);

  if (statement.columnNames.length > 0) {
    const rawRows = statement.all();
    const rows = normalizeSqlRows(rawRows);
    const elapsedMs = Math.round((performance.now() - startedAt) * 100) / 100;
    const formattedTable = formatSqlRowsTable(rows);
    const codeBlock = `\`\`\`\n${formattedTable}\n\`\`\``;

    if (codeBlock.length <= SQL_CODE_BLOCK_LIMIT) {
      await respond({ content: codeBlock, ephemeral });
      return;
    }

    const formattedJson = formatSqlRowsJson(rows);
    const attachment = new AttachmentBuilder(Buffer.from(formattedJson, "utf-8"), {
      name: "sql-result.json",
    });
    await respond({
      embeds: [
        baseEmbed().setTitle("SQL Result").setDescription(
          [
            `Returned \`${rows.length}\` row(s) in \`${elapsedMs}ms\`.`,
            `Table was too large for a code block, so the full result is attached as \`sql-result.json\`.`,
          ].join("\n"),
        ),
      ],
      files: [attachment],
      ephemeral,
    });
    return;
  }

  const result = statement.run();
  const elapsedMs = Math.round((performance.now() - startedAt) * 100) / 100;
  await respond({
    embeds: [
      successEmbed("SQL executed successfully.").addFields(
        { name: "Changes", value: `\`${result.changes}\``, inline: true },
        { name: "Last Insert Rowid", value: `\`${result.lastInsertRowid}\``, inline: true },
        { name: "Time", value: `\`${elapsedMs}ms\``, inline: true },
      ),
    ],
    ephemeral,
  });
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
      .setDescription("Current values and available settings commands.")
      .addFields(
        {
          name: "Current Values",
          value: [
            `**Prefix:** \`${prefix}\``,
            `**Self-react penalty:** \`${selfReactPenalty ? "on" : "off"}\``,
            `**fmbot user:** ${fmbotRow?.fmbot_user_id ? `<@${fmbotRow.fmbot_user_id}> (\`${fmbotRow.fmbot_user_id}\`)` : "Not configured"}`,
            `**fmbot prefix:** ${fmbotRow?.fmbot_prefix ? `\`${fmbotRow.fmbot_prefix}\`` : "Not configured"}`,
            `**Custom leaderboards:** \`${leaderboardCount}\``,
            `**Reaction events tracked:** \`${eventCount}\``,
          ].join("\n"),
        },
        {
          name: "Commands",
          value: [
            `\`${prefix}settings prefix <new-prefix>\``,
            `\`${prefix}settings selfreact <on|off>\``,
            `\`${prefix}settings fmbot <@bot-or-id>\``,
            `\`${prefix}settings fmbot-prefix <prefix>\``,
            `\`${prefix}settings info\``,
          ].join("\n"),
        },
        {
          name: "Examples",
          value: [
            `\`${prefix}settings prefix ?\``,
            `\`${prefix}settings selfreact off\``,
            `\`${prefix}settings fmbot @.fmbot\``,
            `\`${prefix}settings fmbot-prefix .\``,
          ].join("\n"),
        },
      ),
  );
}

function buildSettingsUsageEmbed(prefix: string) {
  return baseEmbed()
    .setTitle("Settings Commands")
    .setDescription("Update server settings with one of the commands below.")
    .addFields(
      {
        name: "Commands",
        value: [
          `\`${prefix}settings prefix <new-prefix>\` — Set prefix`,
          `\`${prefix}settings selfreact <on|off>\` — Toggle self-react penalty`,
          `\`${prefix}settings fmbot <@bot or ID>\` — Set fmbot bot user`,
          `\`${prefix}settings fmbot-prefix <prefix>\` — Set fmbot command prefix`,
          `\`${prefix}settings info\` — Show current settings`,
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

export async function handleSqlPrefixCommand(
  message: Message,
  args: string[],
  client: BotClient,
): Promise<void> {
  if (!isGlobalAdmin(message.author.id)) {
    await message.reply({ embeds: [errorEmbed("You are not allowed to use this command.")] });
    return;
  }

  const sql = args.join(" ").trim();
  if (!sql) {
    const prefix = message.guild ? getGuildPrefix(client, message.guild.id) : "!";
    await message.reply({ embeds: [errorEmbed(`Usage: \`${prefix}sql <query>\``)] });
    return;
  }

  await replySqlResult(async (payload) => {
    await message.reply(payload);
  }, sql, client);
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
  const rawData = {
    messageId: msg.id,
    channelId: msg.channelId,
    guildId: msg.guildId,
    author: {
      id: msg.author.id,
      username: msg.author.username,
      displayName: msg.author.displayName,
      tag: msg.author.tag,
      bot: msg.author.bot,
    },
    interactionMetadata: interactionUser
      ? {
          userId: interactionUser.id,
          username: interactionUser.username,
          tag: interactionUser.tag,
        }
      : null,
    content: msg.content || null,
    embeds: msg.embeds.map((e) => ({
      title: e.title ?? null,
      author: e.author
        ? { name: e.author.name, url: e.author.url, iconURL: e.author.iconURL }
        : null,
      description: e.description ?? null,
      fields: e.fields.map((f) => ({ name: f.name, value: f.value, inline: f.inline })),
      footer: e.footer ? { text: e.footer.text, iconURL: e.footer.iconURL } : null,
      color: e.color !== null ? `#${e.color.toString(16).padStart(6, "0")}` : null,
      url: e.url ?? null,
      image: e.image?.url ?? null,
      thumbnail: e.thumbnail?.url ?? null,
    })),
    components: msg.components.map((row) => ({
      type: row.type,
      components: "components" in row ? row.components.map((c) => c.toJSON()) : [],
    })),
    attachments: msg.attachments.map((a) => ({
      id: a.id,
      name: a.name,
      url: a.url,
      contentType: a.contentType,
      size: a.size,
    })),
    stickers: msg.stickers.map((s) => ({
      id: s.id,
      name: s.name,
    })),
    createdTimestamp: msg.createdTimestamp,
  };
  const jsonBuffer = Buffer.from(JSON.stringify(rawData, null, 2), "utf-8");
  const attachment = new AttachmentBuilder(jsonBuffer, { name: `debug-${msg.id}.json` });
  await interaction.reply({ embeds: [embed], files: [attachment], ephemeral: true });
  return true;
}

export async function handleAdminSlashCommand(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
): Promise<boolean> {
  if (interaction.commandName === "settings") {
    await handleSettingsSlashCommandInner(interaction, client);
    return true;
  }

  if (interaction.commandName === "sql") {
    if (!isGlobalAdmin(interaction.user.id)) {
      await interaction.reply({
        embeds: [errorEmbed("You are not allowed to use this command.")],
        ephemeral: true,
      });
      return true;
    }

    const sql = interaction.options.getString("query", true).trim();
    await replySqlResult(async (payload) => {
      await interaction.reply(payload);
    }, sql, client, true);
    return true;
  }

  return false;
}
