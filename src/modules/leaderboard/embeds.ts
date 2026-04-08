import { EmbedBuilder } from "discord.js";
import { baseEmbed } from "../../utils/embeds";
import { PERIOD_LABELS, type Period } from "../../utils/time";
import type { LeaderboardEntry, MostReactedMessage } from "../emoji-tracker/queries";

const MEDALS = ["🥇", "🥈", "🥉"];

export function buildLeaderboardEmbed(
  emoji: string,
  period: Period,
  entries: LeaderboardEntry[],
  page: number,
  totalUsers: number,
  pageSize: number = 10,
): EmbedBuilder {
  const totalPages = Math.max(1, Math.ceil(totalUsers / pageSize));
  const offset = page * pageSize;

  const description =
    entries.length === 0
      ? "No data yet for this period."
      : entries
          .map((entry, i) => {
            const rank = offset + i + 1;
            const medal = rank <= 3 ? MEDALS[rank - 1] : `**${rank}.**`;
            return `${medal} <@${entry.user_id}> — **${entry.score}** collected`;
          })
          .join("\n");

  return baseEmbed()
    .setTitle(`${emoji} Leaderboard — ${PERIOD_LABELS[period]}`)
    .setDescription(description)
    .setFooter({ text: `Page ${page + 1}/${totalPages} • ${totalUsers} users tracked` });
}

export interface MostReactedPreview {
  author?: string;
  text?: string;
}

export function buildMostReactedEmbed(
  emoji: string,
  guildId: string,
  period: Period,
  entry: MostReactedMessage | null,
  page: number,
  totalMessages: number,
  preview?: MostReactedPreview,
): EmbedBuilder {
  const totalPages = Math.max(1, totalMessages);

  if (!entry) {
    return baseEmbed()
      .setTitle(`${emoji} Hall of Fame — ${PERIOD_LABELS[period]}`)
      .setDescription("No messages found for this period.")
      .setFooter({ text: `Page ${page + 1}/${totalPages}` });
  }

  const rank = page + 1;
  const medal = rank <= 3 ? MEDALS[rank - 1] : `#${rank}`;
  const jumpUrl = `https://discord.com/channels/${guildId}/${entry.channel_id}/${entry.message_id}`;
  const lines = [
    `${medal} **${entry.reaction_count}** ${emoji}`,
    `Channel: <#${entry.channel_id}>`,
    preview?.author ? `Author: ${preview.author}` : null,
    preview?.text ? `\n${preview.text}` : null,
    `\n[Jump to message](${jumpUrl}) • <t:${entry.created_at}:R>`,
  ].filter(Boolean);

  return baseEmbed()
    .setTitle(`${emoji} Hall of Fame — ${PERIOD_LABELS[period]}`)
    .setDescription(lines.join("\n"))
    .setFooter({ text: `Message ${page + 1}/${totalPages} • Top ${totalMessages}` });
}
