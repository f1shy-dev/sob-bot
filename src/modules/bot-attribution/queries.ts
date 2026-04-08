import type { Database } from "bun:sqlite";

export interface StoredAttribution {
  messageId: string;
  guildId: string;
  channelId: string;
  botUserId: string;
  attributedUserId: string;
  strategy: string;
  confidence: number;
}

export interface AttributionRow {
  attributed_user_id: string;
  bot_user_id: string;
  strategy: string;
  confidence: number;
}

export function storeAttribution(db: Database, attribution: StoredAttribution): void {
  db.prepare(
    `INSERT OR REPLACE INTO bot_message_attributions (
      message_id,
      guild_id,
      channel_id,
      bot_user_id,
      attributed_user_id,
      strategy,
      confidence,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    attribution.messageId,
    attribution.guildId,
    attribution.channelId,
    attribution.botUserId,
    attribution.attributedUserId,
    attribution.strategy,
    attribution.confidence,
    Math.floor(Date.now() / 1000),
  );
}

export function reconcileAttributedReactionEvents(
  db: Database,
  messageId: string,
  botUserId: string,
  attributedUserId: string,
): void {
  db.prepare(
    `UPDATE reaction_events
     SET message_author_id = ?,
         is_self_react = CASE WHEN reactor_id = ? THEN 1 ELSE 0 END
     WHERE message_id = ? AND bot_author_id = ?`,
  ).run(attributedUserId, attributedUserId, messageId, botUserId);
}

export function getAttribution(db: Database, messageId: string): AttributionRow | null {
  return (
    db
      .query<AttributionRow, [string]>(
        `SELECT attributed_user_id, bot_user_id, strategy, confidence
         FROM bot_message_attributions
         WHERE message_id = ?`,
      )
      .get(messageId) ?? null
  );
}
