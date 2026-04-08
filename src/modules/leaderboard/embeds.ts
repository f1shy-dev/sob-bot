import { EmbedBuilder } from "discord.js";
import { baseEmbed } from "../../utils/embeds";
import { PERIOD_LABELS, type Period } from "../../utils/time";
import type { LeaderboardEntry, MostReactedMessage } from "../emoji-tracker/queries";

const MEDALS = ["🥇", "🥈", "🥉"];
const SOB_DISPLAY_EMOJI = "<:goofysob:1209165996892495872>";

function displayEmoji(emoji: string): string {
  return emoji === "😭" ? SOB_DISPLAY_EMOJI : emoji;
}

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

  const shownEmoji = displayEmoji(emoji);

  return baseEmbed()
    .setTitle(`${shownEmoji} Leaderboard — ${PERIOD_LABELS[period]}`)
    .setDescription(description)
    .setFooter({ text: `Page ${page + 1}/${totalPages} • ${totalUsers} users tracked` });
}

export function buildMostReactedEmbed(
  emoji: string,
  guildId: string,
  period: Period,
  entries: MostReactedMessage[],
  page: number,
  totalMessages: number,
  pageSize: number = 10,
): EmbedBuilder {
  const totalPages = Math.max(1, Math.ceil(totalMessages / pageSize));
  const offset = page * pageSize;
  const shownEmoji = displayEmoji(emoji);

  const description =
    entries.length === 0
      ? "No messages found for this period."
      : entries
          .map((entry, i) => {
            const rank = offset + i + 1;
            return `**${rank}.** [Jump to message](https://discord.com/channels/${guildId}/${entry.channel_id}/${entry.message_id}) — **${entry.reaction_count}** ${shownEmoji} • <t:${entry.created_at}:R>`;
          })
          .join("\n");

  return baseEmbed()
    .setTitle(`Most ${shownEmoji}'d Messages — ${PERIOD_LABELS[period]}`)
    .setDescription(description)
    .setFooter({ text: `Page ${page + 1}/${totalPages} • ${totalMessages} messages tracked` });
}
