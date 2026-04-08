import type { Database } from "bun:sqlite";

export function initializeDatabase(db: Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS emoji_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('message', 'reaction')),
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_emoji_guild_time
      ON emoji_events(guild_id, emoji, created_at);
    CREATE INDEX IF NOT EXISTS idx_emoji_guild_user
      ON emoji_events(guild_id, emoji, user_id);
    CREATE INDEX IF NOT EXISTS idx_emoji_guild_user_emoji
      ON emoji_events(guild_id, user_id, emoji, created_at);

    CREATE TABLE IF NOT EXISTS guild_leaderboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      name TEXT NOT NULL,
      emoji TEXT NOT NULL,
      aliases TEXT NOT NULL DEFAULT '[]',
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_lb_guild_name
      ON guild_leaderboards(guild_id, name);

    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      prefix TEXT NOT NULL DEFAULT '!'
    );
  `);
}
