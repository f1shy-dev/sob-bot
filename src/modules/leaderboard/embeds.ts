import { EmbedBuilder } from "discord.js";
import { baseEmbed } from "../../utils/embeds";
import { PERIOD_LABELS, type Period } from "../../utils/time";
import type { LeaderboardEntry } from "../emoji-tracker/queries";

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

  const description = entries.length === 0
    ? "No data yet for this period."
    : entries
        .map((entry, i) => {
          const rank = offset + i + 1;
          const medal = rank <= 3 ? MEDALS[rank - 1] : `**${rank}.**`;
          return `${medal} <@${entry.user_id}> — **${entry.count}** uses`;
        })
        .join("\n");

  return baseEmbed()
    .setTitle(`${emoji} Leaderboard — ${PERIOD_LABELS[period]}`)
    .setDescription(description)
    .setFooter({ text: `Page ${page + 1}/${totalPages} • ${totalUsers} users tracked` });
}
