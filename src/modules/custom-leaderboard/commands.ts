import {
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  type Message,
} from "discord.js";
import type { BotClient } from "../../client";
import { getGuildLeaderboards, getGuildPrefix } from "../../core/router";
import { baseEmbed, errorEmbed, successEmbed } from "../../utils/embeds";
import { extractEmoji } from "../../utils/emoji";
import { isAdmin } from "../../utils/permissions";
import { generateAliases } from "../../utils/words";
import { registerGuildLeaderboardCommands } from "./sync";

export const defineLeaderboardSlashCommand = new SlashCommandBuilder()
  .setName("define-leaderboard")
  .setDescription("Define a custom emoji leaderboard for this server")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) =>
    opt.setName("word").setDescription("Word used to generate aliases").setRequired(true),
  )
  .addStringOption((opt) =>
    opt.setName("emoji").setDescription("The emoji to track").setRequired(true),
  );

export const removeLeaderboardSlashCommand = new SlashCommandBuilder()
  .setName("remove-leaderboard")
  .setDescription("Remove a custom leaderboard")
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addStringOption((opt) => opt.setName("word").setDescription("Word to remove").setRequired(true));

export const listLeaderboardsSlashCommand = new SlashCommandBuilder()
  .setName("list-leaderboards")
  .setDescription("Show all custom leaderboards in this server");

interface GuildLeaderboardRecord {
  word: string;
  emoji: string;
}

function parseSingleEmoji(input: string): string | null {
  const trimmed = input.trim();
  const matches = [...extractEmoji(trimmed)];
  if (matches.length !== 1) return null;
  return matches[0] === trimmed ? matches[0] : null;
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

function usageEmbed(prefix: string, syntax: string, argumentsValue: string, examplesValue: string) {
  return baseEmbed()
    .setTitle("Command Usage")
    .setDescription(`\`${prefix}${syntax}\``)
    .addFields(
      { name: "Arguments", value: argumentsValue },
      { name: "Examples", value: examplesValue },
    );
}

function leaderboardAliasFields(word: string) {
  const aliases = generateAliases(word);
  return [
    { name: "Leaderboard aliases", value: aliases.leaderboard.join(", "), inline: false },
    { name: "Most-reacted aliases", value: aliases.mostReacted.join(", "), inline: false },
  ];
}

async function createLeaderboard(
  client: BotClient,
  guildId: string,
  wordInput: string,
  emojiInput: string,
  createdBy: string,
): Promise<{ ok: true; word: string; emoji: string } | { ok: false; message: string }> {
  const word = wordInput.trim().toLowerCase();
  const emoji = parseSingleEmoji(emojiInput);

  if (!/^[a-z]{1,20}$/.test(word)) {
    return { ok: false, message: "Word must match `/^[a-z]{1,20}$/`." };
  }

  if (!emoji) {
    return { ok: false, message: "Please provide a single valid emoji." };
  }

  const generated = generateAliases(word);
  const globalCommandNames = getGlobalCommandNames(client);
  const takenAliases = new Set<string>();

  for (const leaderboard of getGuildLeaderboards(client, guildId)) {
    const aliases = generateAliases(leaderboard.word);
    for (const alias of [...aliases.leaderboard, ...aliases.mostReacted]) {
      takenAliases.add(alias);
    }
  }

  for (const alias of [...generated.leaderboard, ...generated.mostReacted]) {
    if (globalCommandNames.has(alias)) {
      return { ok: false, message: `Alias \`${alias}\` conflicts with an existing bot command.` };
    }
    if (takenAliases.has(alias)) {
      return {
        ok: false,
        message: `Alias \`${alias}\` is already used by another custom leaderboard in this server.`,
      };
    }
  }

  const existing = client.db
    .query<{ word: string }, [string, string]>(
      `SELECT word FROM guild_leaderboards WHERE guild_id = ? AND word = ?`,
    )
    .get(guildId, word);

  if (existing) {
    return { ok: false, message: `A leaderboard for \`${word}\` already exists in this server.` };
  }

  client.db
    .prepare(
      `INSERT INTO guild_leaderboards (guild_id, word, emoji, created_by, created_at)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .run(guildId, word, emoji, createdBy, Math.floor(Date.now() / 1000));

  await registerGuildLeaderboardCommands(client, guildId);
  return { ok: true, word, emoji };
}

async function removeLeaderboard(client: BotClient, guildId: string, wordInput: string) {
  const word = wordInput.trim().toLowerCase();
  if (!/^[a-z]{1,20}$/.test(word)) {
    return { ok: false as const, message: "Word must match `/^[a-z]{1,20}$/`." };
  }

  const record = client.db
    .query<GuildLeaderboardRecord, [string, string]>(
      `SELECT word, emoji FROM guild_leaderboards WHERE guild_id = ? AND word = ?`,
    )
    .get(guildId, word);

  if (!record) {
    return {
      ok: false as const,
      message: `No custom leaderboard for \`${word}\` exists in this server.`,
    };
  }

  client.db
    .prepare(`DELETE FROM guild_leaderboards WHERE guild_id = ? AND word = ?`)
    .run(guildId, word);

  await registerGuildLeaderboardCommands(client, guildId);
  return { ok: true as const, record };
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

  const result = await createLeaderboard(
    client,
    interaction.guildId,
    interaction.options.getString("word", true),
    interaction.options.getString("emoji", true),
    interaction.user.id,
  );

  if (!result.ok) {
    await interaction.reply({ embeds: [errorEmbed(result.message)], ephemeral: true });
    return;
  }

  await interaction.reply({
    embeds: [
      successEmbed(`Created leaderboard for \`${result.word}\` (${result.emoji}).`).addFields(
        { name: "Word", value: result.word, inline: true },
        { name: "Emoji", value: result.emoji, inline: true },
        ...leaderboardAliasFields(result.word),
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

  const result = await removeLeaderboard(
    client,
    interaction.guildId,
    interaction.options.getString("word", true),
  );
  if (!result.ok) {
    await interaction.reply({ embeds: [errorEmbed(result.message)], ephemeral: true });
    return;
  }

  await interaction.reply({
    embeds: [
      successEmbed(`Removed leaderboard for \`${result.record.word}\`.`).addFields(
        { name: "Emoji", value: result.record.emoji, inline: true },
        ...leaderboardAliasFields(result.record.word),
      ),
    ],
  });
}

async function sendListLeaderboards(
  guildId: string,
  client: BotClient,
  respond: (payload: { embeds: ReturnType<typeof baseEmbed>[] }) => Promise<void>,
): Promise<void> {
  const leaderboards = getGuildLeaderboards(client, guildId);
  if (leaderboards.length === 0) {
    await respond({
      embeds: [
        baseEmbed()
          .setTitle("Custom Leaderboards")
          .setDescription("No custom leaderboards are defined for this server."),
      ],
    });
    return;
  }

  await respond({
    embeds: [
      baseEmbed()
        .setTitle("Custom Leaderboards")
        .setDescription(
          leaderboards
            .map((leaderboard) => {
              const aliases = generateAliases(leaderboard.word);
              return `**${leaderboard.word}** — ${leaderboard.emoji}\nLeaderboard: ${aliases.leaderboard.join(", ")}\nMost-reacted: ${aliases.mostReacted.join(", ")}`;
            })
            .join("\n\n"),
        ),
    ],
  });
}

export async function handleDefineLeaderboardPrefixCommand(
  message: Message,
  args: string[],
  client: BotClient,
): Promise<void> {
  if (!message.guild) return;
  const prefix = getGuildPrefix(client, message.guild.id);

  if (args.length !== 2) {
    await message.reply({
      embeds: [
        usageEmbed(
          prefix,
          "define-leaderboard <word> <emoji>",
          "`word` — Lowercase letters only, 1-20 chars\n`emoji` — A single emoji",
          `\`${prefix}define-leaderboard sob 😭\`\n\`${prefix}deflb sob 😭\``,
        ),
      ],
    });
    return;
  }

  const result = await createLeaderboard(
    client,
    message.guild.id,
    args[0],
    args[1],
    message.author.id,
  );
  if (!result.ok) {
    await message.reply({ embeds: [errorEmbed(result.message)] });
    return;
  }

  await message.reply({
    embeds: [
      successEmbed(`Created leaderboard for \`${result.word}\` (${result.emoji}).`).addFields(
        ...leaderboardAliasFields(result.word),
      ),
    ],
  });
}

export async function handleRemoveLeaderboardPrefixCommand(
  message: Message,
  args: string[],
  client: BotClient,
): Promise<void> {
  if (!message.guild) return;
  const prefix = getGuildPrefix(client, message.guild.id);

  if (args.length !== 1) {
    await message.reply({
      embeds: [
        usageEmbed(
          prefix,
          "remove-leaderboard <word>",
          "`word` — Lowercase letters only, 1-20 chars",
          `\`${prefix}remove-leaderboard sob\`\n\`${prefix}rmlb sob\``,
        ),
      ],
    });
    return;
  }

  const result = await removeLeaderboard(client, message.guild.id, args[0]);
  if (!result.ok) {
    await message.reply({ embeds: [errorEmbed(result.message)] });
    return;
  }

  await message.reply({
    embeds: [successEmbed(`Removed leaderboard for \`${result.record.word}\`.`)],
  });
}

export async function handleListLeaderboardsPrefixCommand(
  message: Message,
  args: string[],
  client: BotClient,
): Promise<void> {
  if (!message.guild) return;
  const prefix = getGuildPrefix(client, message.guild.id);

  if (args.length !== 0) {
    await message.reply({
      embeds: [
        usageEmbed(
          prefix,
          "list-leaderboards",
          "This command takes no arguments.",
          `\`${prefix}list-leaderboards\`\n\`${prefix}listlb\``,
        ),
      ],
    });
    return;
  }

  await sendListLeaderboards(message.guild.id, client, async (payload) => {
    await message.reply(payload);
  });
}

export async function handleCustomLeaderboardSlashCommand(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
): Promise<boolean> {
  if (!interaction.guildId) {
    if (
      ["define-leaderboard", "remove-leaderboard", "list-leaderboards"].includes(
        interaction.commandName,
      )
    ) {
      await interaction.reply({
        embeds: [errorEmbed("This command can only be used in a server.")],
        ephemeral: true,
      });
      return true;
    }
    return false;
  }

  switch (interaction.commandName) {
    case "define-leaderboard":
      await handleDefineLeaderboard(interaction, client);
      return true;
    case "remove-leaderboard":
      await handleRemoveLeaderboard(interaction, client);
      return true;
    case "list-leaderboards":
      await sendListLeaderboards(interaction.guildId, client, async (payload) => {
        await interaction.reply(payload);
      });
      return true;
    default:
      return false;
  }
}
