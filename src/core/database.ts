import type { Database } from "bun:sqlite";

export function initializeDatabase(db: Database): void {
  db.exec(`
    DROP TABLE IF EXISTS emoji_events;
    DROP TABLE IF EXISTS guild_leaderboards;

    CREATE TABLE IF NOT EXISTS reaction_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      message_author_id TEXT NOT NULL,
      reactor_id TEXT NOT NULL,
      emoji TEXT NOT NULL,
      is_self_react INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_re_guild_emoji_author
      ON reaction_events(guild_id, emoji, message_author_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_re_guild_emoji_time
      ON reaction_events(guild_id, emoji, created_at);
    CREATE INDEX IF NOT EXISTS idx_re_guild_msg
      ON reaction_events(guild_id, message_id, emoji);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_re_unique_reaction
      ON reaction_events(guild_id, message_id, reactor_id, emoji);

    CREATE TABLE IF NOT EXISTS guild_leaderboards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      word TEXT NOT NULL,
      emoji TEXT NOT NULL,
      created_by TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_lb_guild_word
      ON guild_leaderboards(guild_id, word);

    CREATE TABLE IF NOT EXISTS guild_settings (
      guild_id TEXT PRIMARY KEY,
      prefix TEXT NOT NULL DEFAULT '!',
      self_react_penalty INTEGER NOT NULL DEFAULT 1
    );
  `);
}
