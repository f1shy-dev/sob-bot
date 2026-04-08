import type { Database } from "bun:sqlite";
import { getPeriodStart, type Period } from "../../utils/time";

export interface LeaderboardEntry {
  user_id: string;
  count: number;
}

export function getEmojiLeaderboard(
  db: Database,
  guildId: string,
  emoji: string,
  period: Period,
  limit: number = 10,
  offset: number = 0,
): LeaderboardEntry[] {
  const periodStart = getPeriodStart(period);
  return db
    .query<LeaderboardEntry, [string, string, number, number, number]>(
      `SELECT user_id, COUNT(*) as count
       FROM emoji_events
       WHERE guild_id = ? AND emoji = ? AND created_at >= ?
       GROUP BY user_id
       ORDER BY count DESC
       LIMIT ? OFFSET ?`,
    )
    .all(guildId, emoji, periodStart, limit, offset);
}

export function getEmojiLeaderboardCount(
  db: Database,
  guildId: string,
  emoji: string,
  period: Period,
): number {
  const periodStart = getPeriodStart(period);
  const row = db
    .query<{ count: number }, [string, string, number]>(
      `SELECT COUNT(DISTINCT user_id) as count
       FROM emoji_events
       WHERE guild_id = ? AND emoji = ? AND created_at >= ?`,
    )
    .get(guildId, emoji, periodStart);
  return row?.count ?? 0;
}
