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
import {
  buildLeaderboardEmbed,
  buildMostReactedEmbed,
  type MostReactedPreview,
} from "./embeds";
import { attachPagination, buildPaginationRow } from "./pagination";

const PAGE_SIZE = 10;
const MOST_REACTED_PAGE_SIZE = 1;
const MAX_MOST_REACTED_MESSAGES = 5;

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
  .setName("emojimostreacted")
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

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  if (maxLength <= 3) return value.slice(0, maxLength);
  return `${value.slice(0, maxLength - 3)}...`;
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

async function buildMostReactedPreview(
  client: BotClient,
  entry: { channel_id: string; message_id: string },
): Promise<MostReactedPreview | undefined> {
  try {
    const channel = await client.channels.fetch(entry.channel_id);
    if (!channel?.isTextBased() || !("messages" in channel)) return undefined;

    const message = await channel.messages.fetch(entry.message_id);
    const text = message.content.trim();
    if (text) {
      return {
        author: `<@${message.author.id}>`,
        text: truncate(text.replace(/\s+/g, " "), 280),
      };
    }

    const embedText = message.embeds
      .flatMap((embed) => [embed.title, embed.description, ...embed.fields.map((field) => field.value)])
      .filter((value): value is string => Boolean(value))
      .join(" — ")
      .trim();
    if (embedText) {
      return {
        author: `<@${message.author.id}>`,
        text: truncate(embedText.replace(/\s+/g, " "), 280),
      };
    }

    if (message.attachments.size > 0) {
      return { author: `<@${message.author.id}>`, text: "[attachment]" };
    }

    return { author: `<@${message.author.id}>`, text: "[no preview available]" };
  } catch {
    return undefined;
  }
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

  const fetchPage = async (page: number) => {
    const totalMessages = Math.min(
      getMostReactedMessagesCount(
        client.db,
        context.guildId,
        context.emoji,
        context.period,
        selfReactPenalty,
      ),
      MAX_MOST_REACTED_MESSAGES,
    );
    const totalPages = Math.max(1, totalMessages);
    const safePage = Math.min(page, totalPages - 1);
    const entries = getMostReactedMessages(
      client.db,
      context.guildId,
      context.emoji,
      context.period,
      selfReactPenalty,
      MOST_REACTED_PAGE_SIZE,
      safePage,
    );
    const entry = entries[0] ?? null;
    const preview = entry ? await buildMostReactedPreview(client, entry) : undefined;

    return {
      embeds: [
        buildMostReactedEmbed(
          context.emoji,
          context.guildId,
          context.period,
          entry,
          safePage,
          totalMessages,
          preview,
        ),
      ],
      components: totalPages > 1 ? [buildPaginationRow(safePage, totalPages)] : [],
    };
  };

  const initial = await fetchPage(0);
  const replyMessage = await send(initial);
  await attachPagination(replyMessage, {
    userId: context.userId,
    totalPages: Math.max(
      1,
      Math.min(
        getMostReactedMessagesCount(
          client.db,
          context.guildId,
          context.emoji,
          context.period,
          selfReactPenalty,
        ),
        MAX_MOST_REACTED_MESSAGES,
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
  if (interaction.commandName !== "emojimostreacted" || !interaction.guildId) {
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
          `\`${prefix}emojimostreacted <emoji> [period]\``,
          "`emoji` — The emoji to show\n`period` — daily, weekly, monthly, alltime (default: weekly)",
          `\`${prefix}emojimostreacted 😭\`\n\`${prefix}emr 😭 monthly\``,
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
          `\`${prefix}emojimostreacted <emoji> [period]\``,
          "`emoji` — The emoji to show\n`period` — daily, weekly, monthly, alltime (default: weekly)",
          `\`${prefix}emojimostreacted 😭\`\n\`${prefix}emr 😭 monthly\``,
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
