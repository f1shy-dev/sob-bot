import type { Database } from "bun:sqlite";
import { getPeriodStart, type Period } from "../../utils/time";

export interface LeaderboardEntry {
  user_id: string;
  score: number;
}

export function getCollectedLeaderboard(
  db: Database,
  guildId: string,
  emoji: string,
  period: Period,
  selfReactPenalty: boolean,
  limit: number = 10,
  offset: number = 0,
): LeaderboardEntry[] {
  const periodStart = getPeriodStart(period);
  const selfReactValue = selfReactPenalty ? -1 : 0;

  return db
    .query<LeaderboardEntry, [string, string, number, number, number]>(
      `SELECT message_author_id as user_id,
              SUM(CASE WHEN is_self_react = 1 THEN ${selfReactValue} ELSE 1 END) as score
       FROM reaction_events
       WHERE guild_id = ? AND emoji = ? AND created_at >= ?
         AND (bot_author_id IS NULL OR message_author_id != bot_author_id)
       GROUP BY message_author_id
       HAVING score > 0
       ORDER BY score DESC
       LIMIT ? OFFSET ?`,
    )
    .all(guildId, emoji, periodStart, limit, offset);
}

export function getCollectedLeaderboardCount(
  db: Database,
  guildId: string,
  emoji: string,
  period: Period,
  selfReactPenalty: boolean,
): number {
  const periodStart = getPeriodStart(period);
  const selfReactValue = selfReactPenalty ? -1 : 0;
  const row = db
    .query<{ count: number }, [string, string, number]>(
      `SELECT COUNT(*) as count
       FROM (
         SELECT message_author_id
         FROM reaction_events
         WHERE guild_id = ? AND emoji = ? AND created_at >= ?
           AND (bot_author_id IS NULL OR message_author_id != bot_author_id)
         GROUP BY message_author_id
         HAVING SUM(CASE WHEN is_self_react = 1 THEN ${selfReactValue} ELSE 1 END) > 0
       )`,
    )
    .get(guildId, emoji, periodStart);

  return row?.count ?? 0;
}

export interface MostReactedMessage {
  message_id: string;
  channel_id: string;
  reaction_count: number;
  created_at: number;
}

export function getMostReactedMessages(
  db: Database,
  guildId: string,
  emoji: string,
  period: Period,
  selfReactPenalty: boolean,
  limit: number = 10,
  offset: number = 0,
): MostReactedMessage[] {
  const periodStart = getPeriodStart(period);
  const selfReactValue = selfReactPenalty ? -1 : 0;

  return db
    .query<MostReactedMessage, [string, string, number, number, number]>(
      `SELECT message_id,
              channel_id,
              SUM(CASE WHEN is_self_react = 1 THEN ${selfReactValue} ELSE 1 END) as reaction_count,
              MIN(created_at) as created_at
       FROM reaction_events
       WHERE guild_id = ? AND emoji = ? AND created_at >= ?
         AND (bot_author_id IS NULL OR message_author_id != bot_author_id)
       GROUP BY message_id, channel_id
       HAVING reaction_count > 0
       ORDER BY reaction_count DESC
       LIMIT ? OFFSET ?`,
    )
    .all(guildId, emoji, periodStart, limit, offset);
}

export function getMostReactedMessagesCount(
  db: Database,
  guildId: string,
  emoji: string,
  period: Period,
  selfReactPenalty: boolean,
): number {
  const periodStart = getPeriodStart(period);
  const selfReactValue = selfReactPenalty ? -1 : 0;
  const row = db
    .query<{ count: number }, [string, string, number]>(
      `SELECT COUNT(*) as count
       FROM (
         SELECT message_id, channel_id
         FROM reaction_events
         WHERE guild_id = ? AND emoji = ? AND created_at >= ?
           AND (bot_author_id IS NULL OR message_author_id != bot_author_id)
         GROUP BY message_id, channel_id
         HAVING SUM(CASE WHEN is_self_react = 1 THEN ${selfReactValue} ELSE 1 END) > 0
         LIMIT 200
       )`,
    )
    .get(guildId, emoji, periodStart);

  return row?.count ?? 0;
}

export function getGuildSelfReactPenalty(db: Database, guildId: string): boolean {
  const row = db
    .query<{ self_react_penalty: number }, [string]>(
      "SELECT self_react_penalty FROM guild_settings WHERE guild_id = ?",
    )
    .get(guildId);
  return (row?.self_react_penalty ?? 1) === 1;
}
