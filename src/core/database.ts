import type { Database } from "bun:sqlite";

export function initializeDatabase(db: Database): void {
  db.exec(`
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

    CREATE TABLE IF NOT EXISTS bot_message_attributions (
      message_id TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      bot_user_id TEXT NOT NULL,
      attributed_user_id TEXT NOT NULL,
      strategy TEXT NOT NULL,
      confidence REAL NOT NULL DEFAULT 1.0,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_bma_guild_bot
      ON bot_message_attributions(guild_id, bot_user_id);
    CREATE INDEX IF NOT EXISTS idx_bma_channel
      ON bot_message_attributions(channel_id, created_at);

    CREATE TABLE IF NOT EXISTS pending_link_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      canonical_id TEXT NOT NULL,
      message_id TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_plp_channel_canonical
      ON pending_link_posts(channel_id, canonical_id, created_at);
  `);

  const safeAddColumn = (table: string, column: string, type: string) => {
    try {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
    } catch {}
  };

  safeAddColumn("guild_settings", "fmbot_user_id", "TEXT");
  safeAddColumn("guild_settings", "fmbot_prefix", "TEXT");
  safeAddColumn("reaction_events", "bot_author_id", "TEXT DEFAULT NULL");
}
