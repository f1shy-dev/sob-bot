import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type Message,
} from "discord.js";
import type { BotClient } from "../../client";
import { errorEmbed } from "../../utils/embeds";
import { extractEmoji } from "../../utils/emoji";
import { parsePeriod, type Period } from "../../utils/time";
import { getEmojiLeaderboard, getEmojiLeaderboardCount } from "../emoji-tracker/queries";
import { buildLeaderboardEmbed } from "./embeds";
import { attachLeaderboardPagination, buildPaginationRow } from "./pagination";

const PAGE_SIZE = 10;

export const emojiLeaderboardSlashCommand = new SlashCommandBuilder()
  .setName("emojileaderboard")
  .setDescription("Show the leaderboard for any emoji")
  .addStringOption((opt) =>
    opt
      .setName("emoji")
      .setDescription("The emoji to show the leaderboard for")
      .setRequired(true),
  )
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
  );

function parseSingleEmoji(input: string): string | null {
  const trimmed = input.trim();
  const matches = [...extractEmoji(trimmed)];
  if (matches.length !== 1) return null;
  return matches[0] === trimmed ? matches[0] : null;
}

async function renderLeaderboardReply(
  client: BotClient,
  context: {
    guildId: string;
    userId: string;
    emoji: string;
    period: Period;
  },
  send: (payload: {
    embeds: ReturnType<typeof buildLeaderboardEmbed>[];
    components: ReturnType<typeof buildPaginationRow>[];
  }) => Promise<Message>,
): Promise<void> {
  const entries = getEmojiLeaderboard(
    client.db,
    context.guildId,
    context.emoji,
    context.period,
    PAGE_SIZE,
    0,
  );
  const totalUsers = getEmojiLeaderboardCount(
    client.db,
    context.guildId,
    context.emoji,
    context.period,
  );
  const totalPages = Math.max(1, Math.ceil(totalUsers / PAGE_SIZE));

  const replyMessage = await send({
    embeds: [buildLeaderboardEmbed(context.emoji, context.period, entries, 0, totalUsers, PAGE_SIZE)],
    components: totalPages > 1 ? [buildPaginationRow(0, totalPages)] : [],
  });

  await attachLeaderboardPagination(replyMessage, client, {
    guildId: context.guildId,
    emoji: context.emoji,
    period: context.period,
    pageSize: PAGE_SIZE,
    totalUsers,
    userId: context.userId,
  });
}

export async function handleEmojiLeaderboardSlashCommand(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
): Promise<boolean> {
  if (interaction.commandName !== "emojileaderboard" || !interaction.guildId) {
    return false;
  }

  const emoji = parseSingleEmoji(interaction.options.getString("emoji", true));
  if (!emoji) {
    await interaction.reply({ embeds: [errorEmbed("Please provide a single valid emoji.")], ephemeral: true });
    return true;
  }

  const period = parsePeriod(interaction.options.getString("period") ?? undefined);
  await interaction.deferReply();

  await renderLeaderboardReply(
    client,
    {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      emoji,
      period,
    },
    async (payload) => {
      await interaction.editReply(payload);
      return interaction.fetchReply() as Promise<Message>;
    },
  );

  return true;
}

export async function handleEmojiLeaderboardPrefixCommand(
  message: Message,
  args: string[],
  client: BotClient,
): Promise<void> {
  if (!message.guild) return;

  const emoji = parseSingleEmoji(args[0] ?? "");
  if (!emoji) {
    await message.reply({ embeds: [errorEmbed("Usage: `emojileaderboard <emoji> [period]`.")] });
    return;
  }

  const period = parsePeriod(args[1]);
  await renderLeaderboardReply(
    client,
    {
      guildId: message.guild.id,
      userId: message.author.id,
      emoji,
      period,
    },
    async (payload) => message.reply(payload),
  );
}

export async function handleDynamicLeaderboardPrefixCommand(
  message: Message,
  args: string[],
  client: BotClient,
  dynamic: { emoji: string },
): Promise<void> {
  if (!message.guild) return;

  const period = parsePeriod(args[0]);
  await renderLeaderboardReply(
    client,
    {
      guildId: message.guild.id,
      userId: message.author.id,
      emoji: dynamic.emoji,
      period,
    },
    async (payload) => message.reply(payload),
  );
}

export async function handleDynamicLeaderboardSlashCommand(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  dynamic: { emoji: string },
): Promise<void> {
  if (!interaction.guildId) return;

  const period = parsePeriod(interaction.options.getString("period") ?? undefined);
  await interaction.deferReply();

  await renderLeaderboardReply(
    client,
    {
      guildId: interaction.guildId,
      userId: interaction.user.id,
      emoji: dynamic.emoji,
      period,
    },
    async (payload) => {
      await interaction.editReply(payload);
      return interaction.fetchReply() as Promise<Message>;
    },
  );
}
