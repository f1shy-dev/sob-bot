import { SlashCommandBuilder, type ChatInputCommandInteraction, type Message } from "discord.js";
import type { BotClient } from "../../client";
import { getGuildPrefix } from "../../core/router";
import { baseEmbed, errorEmbed } from "../../utils/embeds";
import { extractEmoji } from "../../utils/emoji";
import { parsePeriod, type Period } from "../../utils/time";
import {
  getCollectedLeaderboard,
  getCollectedLeaderboardCount,
  getGuildSelfReactPenalty,
  getMostReactedMessages,
  getMostReactedMessagesCount,
} from "../emoji-tracker/queries";
import { buildLeaderboardEmbed, buildMostReactedEmbed } from "./embeds";
import { attachPagination, buildPaginationRow } from "./pagination";

const PAGE_SIZE = 10;
const MAX_MOST_REACTED_OFFSET = 200;

export const emojiLeaderboardSlashCommand = new SlashCommandBuilder()
  .setName("emojileaderboard")
  .setDescription("Show the leaderboard for any emoji")
  .addStringOption((opt) =>
    opt.setName("emoji").setDescription("The emoji to show the leaderboard for").setRequired(true),
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

export const emojiMostReactedSlashCommand = new SlashCommandBuilder()
  .setName("emojimosreacted")
  .setDescription("Show the most reacted messages for any emoji")
  .addStringOption((opt) =>
    opt
      .setName("emoji")
      .setDescription("The emoji to show the most reacted messages for")
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

function buildUsageEmbed(
  title: string,
  description: string,
  argumentsValue: string,
  examplesValue: string,
) {
  return baseEmbed()
    .setTitle(title)
    .setDescription(description)
    .addFields(
      { name: "Arguments", value: argumentsValue },
      { name: "Examples", value: examplesValue },
    );
}

function getTotalPages(totalItems: number): number {
  return Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
}

function parseOptionalPeriodArg(input: string | undefined): Period | null {
  if (!input) return "weekly";

  const normalized = input.toLowerCase();
  const validInputs = new Set([
    "daily",
    "day",
    "today",
    "d",
    "weekly",
    "week",
    "w",
    "monthly",
    "month",
    "m",
    "alltime",
    "all",
    "a",
    "all-time",
  ]);

  if (!validInputs.has(normalized)) return null;
  return parsePeriod(normalized);
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
  const selfReactPenalty = getGuildSelfReactPenalty(client.db, context.guildId);

  const fetchPage = (page: number) => {
    const totalUsers = getCollectedLeaderboardCount(
      client.db,
      context.guildId,
      context.emoji,
      context.period,
      selfReactPenalty,
    );
    const totalPages = getTotalPages(totalUsers);
    const safePage = Math.min(page, totalPages - 1);
    const entries = getCollectedLeaderboard(
      client.db,
      context.guildId,
      context.emoji,
      context.period,
      selfReactPenalty,
      PAGE_SIZE,
      safePage * PAGE_SIZE,
    );

    return {
      embeds: [
        buildLeaderboardEmbed(
          context.emoji,
          context.period,
          entries,
          safePage,
          totalUsers,
          PAGE_SIZE,
        ),
      ],
      components: totalPages > 1 ? [buildPaginationRow(safePage, totalPages)] : [],
    };
  };

  const initial = fetchPage(0);
  const replyMessage = await send(initial);
  await attachPagination(replyMessage, {
    userId: context.userId,
    totalPages: getTotalPages(
      getCollectedLeaderboardCount(
        client.db,
        context.guildId,
        context.emoji,
        context.period,
        selfReactPenalty,
      ),
    ),
    fetchPage,
  });
}

async function renderMostReactedReply(
  client: BotClient,
  context: {
    guildId: string;
    userId: string;
    emoji: string;
    period: Period;
  },
  send: (payload: {
    embeds: ReturnType<typeof buildMostReactedEmbed>[];
    components: ReturnType<typeof buildPaginationRow>[];
  }) => Promise<Message>,
): Promise<void> {
  const selfReactPenalty = getGuildSelfReactPenalty(client.db, context.guildId);

  const fetchPage = (page: number) => {
    const totalMessages = Math.min(
      getMostReactedMessagesCount(
        client.db,
        context.guildId,
        context.emoji,
        context.period,
        selfReactPenalty,
      ),
      MAX_MOST_REACTED_OFFSET,
    );
    const totalPages = getTotalPages(totalMessages);
    const safePage = Math.min(page, totalPages - 1);
    const safeOffset = Math.min(safePage * PAGE_SIZE, MAX_MOST_REACTED_OFFSET);
    const entries = getMostReactedMessages(
      client.db,
      context.guildId,
      context.emoji,
      context.period,
      selfReactPenalty,
      PAGE_SIZE,
      safeOffset,
    );

    return {
      embeds: [
        buildMostReactedEmbed(
          context.emoji,
          context.guildId,
          context.period,
          entries,
          safePage,
          totalMessages,
          PAGE_SIZE,
        ),
      ],
      components: totalPages > 1 ? [buildPaginationRow(safePage, totalPages)] : [],
    };
  };

  const initial = fetchPage(0);
  const replyMessage = await send(initial);
  await attachPagination(replyMessage, {
    userId: context.userId,
    totalPages: getTotalPages(
      Math.min(
        getMostReactedMessagesCount(
          client.db,
          context.guildId,
          context.emoji,
          context.period,
          selfReactPenalty,
        ),
        MAX_MOST_REACTED_OFFSET,
      ),
    ),
    fetchPage,
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
    await interaction.reply({
      embeds: [errorEmbed("Please provide a single valid emoji.")],
      ephemeral: true,
    });
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

export async function handleEmojiMostReactedSlashCommand(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
): Promise<boolean> {
  if (interaction.commandName !== "emojimosreacted" || !interaction.guildId) {
    return false;
  }

  const emoji = parseSingleEmoji(interaction.options.getString("emoji", true));
  if (!emoji) {
    await interaction.reply({
      embeds: [errorEmbed("Please provide a single valid emoji.")],
      ephemeral: true,
    });
    return true;
  }

  const period = parsePeriod(interaction.options.getString("period") ?? undefined);
  await interaction.deferReply();

  await renderMostReactedReply(
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

  const prefix = getGuildPrefix(client, message.guild.id);
  const emoji = parseSingleEmoji(args[0] ?? "");
  if (!emoji) {
    await message.reply({
      embeds: [
        buildUsageEmbed(
          "Command Usage",
          `\`${prefix}emojileaderboard <emoji> [period]\``,
          "`emoji` — The emoji to show\n`period` — daily, weekly, monthly, alltime (default: weekly)",
          `\`${prefix}emojileaderboard 😭\`\n\`${prefix}elb 😭 monthly\``,
        ),
      ],
    });
    return;
  }

  const period = parseOptionalPeriodArg(args[1]);
  if (period === null || args.length > 2) {
    await message.reply({
      embeds: [
        buildUsageEmbed(
          "Command Usage",
          `\`${prefix}emojileaderboard <emoji> [period]\``,
          "`emoji` — The emoji to show\n`period` — daily, weekly, monthly, alltime (default: weekly)",
          `\`${prefix}emojileaderboard 😭\`\n\`${prefix}elb 😭 monthly\``,
        ),
      ],
    });
    return;
  }

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

export async function handleEmojiMostReactedPrefixCommand(
  message: Message,
  args: string[],
  client: BotClient,
): Promise<void> {
  if (!message.guild) return;

  const prefix = getGuildPrefix(client, message.guild.id);
  const emoji = parseSingleEmoji(args[0] ?? "");
  if (!emoji) {
    await message.reply({
      embeds: [
        buildUsageEmbed(
          "Command Usage",
          `\`${prefix}emojimosreacted <emoji> [period]\``,
          "`emoji` — The emoji to show\n`period` — daily, weekly, monthly, alltime (default: weekly)",
          `\`${prefix}emojimosreacted 😭\`\n\`${prefix}emr 😭 monthly\``,
        ),
      ],
    });
    return;
  }

  const period = parseOptionalPeriodArg(args[1]);
  if (period === null || args.length > 2) {
    await message.reply({
      embeds: [
        buildUsageEmbed(
          "Command Usage",
          `\`${prefix}emojimosreacted <emoji> [period]\``,
          "`emoji` — The emoji to show\n`period` — daily, weekly, monthly, alltime (default: weekly)",
          `\`${prefix}emojimosreacted 😭\`\n\`${prefix}emr 😭 monthly\``,
        ),
      ],
    });
    return;
  }

  await renderMostReactedReply(
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

  const period = parseOptionalPeriodArg(args[0]);
  if (period === null || args.length > 1) {
    await message.reply({
      embeds: [
        errorEmbed("Usage: `[dynamic] [period]`. Valid periods: daily, weekly, monthly, alltime."),
      ],
    });
    return;
  }

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

export async function handleDynamicMostReactedPrefixCommand(
  message: Message,
  args: string[],
  client: BotClient,
  dynamic: { emoji: string },
): Promise<void> {
  if (!message.guild) return;

  const period = parseOptionalPeriodArg(args[0]);
  if (period === null || args.length > 1) {
    await message.reply({
      embeds: [
        errorEmbed("Usage: `[dynamic] [period]`. Valid periods: daily, weekly, monthly, alltime."),
      ],
    });
    return;
  }

  await renderMostReactedReply(
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

export async function handleDynamicMostReactedSlashCommand(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
  dynamic: { emoji: string },
): Promise<void> {
  if (!interaction.guildId) return;

  const period = parsePeriod(interaction.options.getString("period") ?? undefined);
  await interaction.deferReply();

  await renderMostReactedReply(
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
