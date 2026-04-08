import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type Message,
} from "discord.js";
import type { BotClient } from "../../client";
import type { Period } from "../../utils/time";
import { getEmojiLeaderboard, getEmojiLeaderboardCount } from "../emoji-tracker/queries";
import { buildLeaderboardEmbed } from "./embeds";

export function buildPaginationRow(
  page: number,
  totalPages: number,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("lb_prev")
      .setLabel("◀ Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId("lb_next")
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

export async function attachLeaderboardPagination(
  replyMessage: Message,
  client: BotClient,
  options: {
    guildId: string;
    emoji: string;
    period: Period;
    pageSize?: number;
    totalUsers: number;
    userId: string;
  },
): Promise<void> {
  const pageSize = options.pageSize ?? 10;
  const totalPages = Math.max(1, Math.ceil(options.totalUsers / pageSize));

  if (totalPages <= 1) return;

  let page = 0;
  const collector = replyMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120_000,
    filter: (interaction) => interaction.user.id === options.userId,
  });

  collector.on("collect", async (interaction) => {
    page += interaction.customId === "lb_prev" ? -1 : 1;
    page = Math.min(Math.max(page, 0), totalPages - 1);

    const offset = page * pageSize;
    const entries = getEmojiLeaderboard(
      client.db,
      options.guildId,
      options.emoji,
      options.period,
      pageSize,
      offset,
    );
    const totalUsers = getEmojiLeaderboardCount(
      client.db,
      options.guildId,
      options.emoji,
      options.period,
    );
    const updatedTotalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
    if (page > updatedTotalPages - 1) {
      page = Math.max(0, updatedTotalPages - 1);
    }

    await interaction.update({
      embeds: [buildLeaderboardEmbed(options.emoji, options.period, entries, page, totalUsers, pageSize)],
      components: updatedTotalPages > 1 ? [buildPaginationRow(page, updatedTotalPages)] : [],
    });
  });

  collector.on("end", async () => {
    try {
      const currentTotalUsers = getEmojiLeaderboardCount(
        client.db,
        options.guildId,
        options.emoji,
        options.period,
      );
      const currentTotalPages = Math.max(1, Math.ceil(currentTotalUsers / pageSize));
      await replyMessage.edit({
        components: [
          new ActionRowBuilder<ButtonBuilder>().addComponents(
            ButtonBuilder.from(buildPaginationRow(page, currentTotalPages).components[0]).setDisabled(true),
            ButtonBuilder.from(buildPaginationRow(page, currentTotalPages).components[1]).setDisabled(true),
          ),
        ],
      });
    } catch {
    }
  });
}
