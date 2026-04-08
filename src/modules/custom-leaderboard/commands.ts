import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
} from "discord.js";
import type { BotClient } from "../../client";
import { getGuildLeaderboardAliases } from "../../core/router";
import { baseEmbed, errorEmbed, successEmbed } from "../../utils/embeds";
import { extractEmoji } from "../../utils/emoji";
import { isAdmin } from "../../utils/permissions";
import { registerGuildLeaderboardCommands } from "./sync";

export const defineLeaderboardSlashCommand = new SlashCommandBuilder()
  .setName("define-leaderboard")
  .setDescription("Define a custom emoji leaderboard for this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt.setName("name").setDescription("Leaderboard name (e.g., sob)").setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName("emoji").setDescription("The emoji to track").setRequired(true),
  )
  .addStringOption((opt) =>
    opt
      .setName("aliases")
      .setDescription("Comma-separated command aliases (e.g., soblb,sobleaderboard,sobs)")
      .setRequired(true),
  );

export const removeLeaderboardSlashCommand = new SlashCommandBuilder()
  .setName("remove-leaderboard")
  .setDescription("Remove a custom leaderboard")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt.setName("name").setDescription("Leaderboard name to remove").setRequired(true),
  );

export const listLeaderboardsSlashCommand = new SlashCommandBuilder()
  .setName("list-leaderboards")
  .setDescription("Show all custom leaderboards in this server");

interface GuildLeaderboardRecord {
  id: number;
  name: string;
  emoji: string;
  aliases: string;
}

function parseSingleEmoji(input: string): string | null {
  const trimmed = input.trim();
  const matches = [...extractEmoji(trimmed)];
  if (matches.length !== 1) return null;
  return matches[0] === trimmed ? matches[0] : null;
}

function parseAliases(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(",")
        .map((alias) => alias.trim().toLowerCase())
        .filter((alias) => /^[\w-]{1,32}$/.test(alias)),
    ),
  ];
}

function getGlobalCommandNames(client: BotClient): Set<string> {
  const names = new Set<string>(client.prefixCommands.map((_, key) => key.toLowerCase()));

  for (const module of client.modules.values()) {
    for (const command of module.slashCommands ?? []) {
      names.add(command.name.toLowerCase());
    }
  }

  return names;
}

async function handleDefineLeaderboard(
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

  const name = interaction.options.getString("name", true).trim().toLowerCase();
  const emoji = parseSingleEmoji(interaction.options.getString("emoji", true));
  const aliases = parseAliases(interaction.options.getString("aliases", true));

  if (!/^[\w-]{1,32}$/.test(name)) {
    await interaction.reply({
      embeds: [
        errorEmbed("Leaderboard name must be 1-32 characters using letters, numbers, `_`, or `-`."),
      ],
      ephemeral: true,
    });
    return;
  }

  if (!emoji) {
    await interaction.reply({
      embeds: [errorEmbed("Please provide a single valid emoji.")],
      ephemeral: true,
    });
    return;
  }

  if (aliases.length === 0) {
    await interaction.reply({
      embeds: [errorEmbed("Provide at least one valid alias using letters, numbers, `_`, or `-`.")],
      ephemeral: true,
    });
    return;
  }

  const globalCommandNames = getGlobalCommandNames(client);
  const guildLeaderboards = getGuildLeaderboardAliases(client, interaction.guildId);
  const takenAliases = new Set(
    guildLeaderboards.flatMap((leaderboard) =>
      leaderboard.aliases.map((alias) => alias.toLowerCase()),
    ),
  );

  for (const alias of aliases) {
    if (globalCommandNames.has(alias)) {
      await interaction.reply({
        embeds: [errorEmbed(`Alias \`${alias}\` conflicts with an existing bot command.`)],
        ephemeral: true,
      });
      return;
    }

    if (takenAliases.has(alias)) {
      await interaction.reply({
        embeds: [
          errorEmbed(
            `Alias \`${alias}\` is already used by another custom leaderboard in this server.`,
          ),
        ],
        ephemeral: true,
      });
      return;
    }
  }

  const existing = client.db
    .query<{ id: number }, [string, string]>(
      `SELECT id FROM guild_leaderboards
       WHERE guild_id = ? AND name = ?`,
    )
    .get(interaction.guildId, name);

  if (existing) {
    await interaction.reply({
      embeds: [errorEmbed(`A leaderboard named \`${name}\` already exists in this server.`)],
      ephemeral: true,
    });
    return;
  }

  client.db
    .prepare(
      `INSERT INTO guild_leaderboards (guild_id, name, emoji, aliases, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(
      interaction.guildId,
      name,
      emoji,
      JSON.stringify(aliases),
      interaction.user.id,
      Math.floor(Date.now() / 1000),
    );

  await registerGuildLeaderboardCommands(client, interaction.guildId);

  await interaction.reply({
    embeds: [
      successEmbed(`Created leaderboard \`${name}\` for ${emoji}.`).addFields(
        { name: "Emoji", value: emoji, inline: true },
        { name: "Aliases", value: aliases.map((alias) => `/${alias}`).join(", "), inline: false },
      ),
    ],
  });
}

async function handleRemoveLeaderboard(
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

  const name = interaction.options.getString("name", true).trim().toLowerCase();
  const record = client.db
    .query<GuildLeaderboardRecord, [string, string]>(
      `SELECT id, name, emoji, aliases
       FROM guild_leaderboards
       WHERE guild_id = ? AND name = ?`,
    )
    .get(interaction.guildId, name);

  if (!record) {
    await interaction.reply({
      embeds: [errorEmbed(`No custom leaderboard named \`${name}\` exists in this server.`)],
      ephemeral: true,
    });
    return;
  }

  client.db
    .prepare(
      `DELETE FROM guild_leaderboards
       WHERE guild_id = ? AND name = ?`,
    )
    .run(interaction.guildId, name);

  await registerGuildLeaderboardCommands(client, interaction.guildId);

  const aliases = JSON.parse(record.aliases) as string[];
  await interaction.reply({
    embeds: [
      successEmbed(`Removed leaderboard \`${record.name}\`.`).addFields(
        { name: "Emoji", value: record.emoji, inline: true },
        { name: "Aliases", value: aliases.join(", ") || "None", inline: false },
      ),
    ],
  });
}

async function handleListLeaderboards(
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

  const leaderboards = client.db
    .query<GuildLeaderboardRecord, [string]>(
      `SELECT id, name, emoji, aliases
       FROM guild_leaderboards
       WHERE guild_id = ?
       ORDER BY name ASC`,
    )
    .all(interaction.guildId);

  if (leaderboards.length === 0) {
    await interaction.reply({
      embeds: [
        baseEmbed()
          .setTitle("Custom Leaderboards")
          .setDescription("No custom leaderboards are defined for this server."),
      ],
    });
    return;
  }

  await interaction.reply({
    embeds: [
      baseEmbed()
        .setTitle("Custom Leaderboards")
        .setDescription(
          leaderboards
            .map((leaderboard) => {
              const aliases = (JSON.parse(leaderboard.aliases) as string[])
                .map((alias) => `/${alias}`)
                .join(", ");
              return `**${leaderboard.name}** — ${leaderboard.emoji}\nAliases: ${aliases || "None"}`;
            })
            .join("\n\n"),
        ),
    ],
  });
}

export async function handleCustomLeaderboardSlashCommand(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
): Promise<boolean> {
  switch (interaction.commandName) {
    case "define-leaderboard":
      await handleDefineLeaderboard(interaction, client);
      return true;
    case "remove-leaderboard":
      await handleRemoveLeaderboard(interaction, client);
      return true;
    case "list-leaderboards":
      await handleListLeaderboards(interaction, client);
      return true;
    default:
      return false;
  }
}
