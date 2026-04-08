import type { Message } from "discord.js";
import type { BotClient } from "../../client";
import { extractUrls, normalizeUrl } from "./url-normalizer";
import type { PendingCommand } from "./types";

const KNOWN_FMBOT_COMMANDS = new Set([
  "fm",
  "np",
  "nowplaying",
  "wk",
  "whoknows",
  "wkt",
  "whoknowstrack",
  "wka",
  "whoknowsalbum",
  "gwk",
  "globalwhoknows",
  "gwkt",
  "globalwhoknowstrack",
  "gwka",
  "globalwhoknowsalbum",
  "chart",
  "topartists",
  "ta",
  "topalbums",
  "tab",
  "toptracks",
  "tt",
  "stats",
  "profile",
  "streak",
  "pace",
  "plays",
  "albumplays",
  "ap",
  "trackplays",
  "tp",
  "artistlist",
  "al",
  "albumlist",
  "abl",
  "tracklist",
  "tl",
  "taste",
  "compare",
  "cover",
  "album",
  "artist",
  "track",
  "recent",
  "last",
  "overview",
  "crowns",
  "crown",
  "discovery",
  "featured",
  "judge",
  "genre",
  "genres",
  "milestone",
  "receipt",
  "receipts",
  "year",
  "decade",
  "combo",
]);

const pendingCommands: PendingCommand[] = [];
let cleanupStarted = false;

export function recordPendingFmbotCommand(client: BotClient, message: Message): void {
  if (!message.guild || message.author.bot) return;

  const settings = client.db
    .query<{ fmbot_user_id: string | null; fmbot_prefix: string | null }, [string]>(
      "SELECT fmbot_user_id, fmbot_prefix FROM guild_settings WHERE guild_id = ?",
    )
    .get(message.guild.id);

  if (!settings?.fmbot_user_id || !settings.fmbot_prefix) return;
  if (!message.content.startsWith(settings.fmbot_prefix)) return;

  const rawCommand = message.content.slice(settings.fmbot_prefix.length).trim().split(/\s+/, 1)[0];
  const command = rawCommand?.toLowerCase();
  if (!command || !KNOWN_FMBOT_COMMANDS.has(command)) return;

  cleanupPendingCommands();
  pendingCommands.push({
    channelId: message.channel.id,
    userId: message.author.id,
    displayName: message.member?.displayName ?? message.author.username,
    command,
    timestamp: Math.floor(message.createdTimestamp / 1000),
  });
}

export function recordPendingLinks(client: BotClient, message: Message): void {
  if (!message.guild || message.author.bot) return;

  const canonicalIds = [...new Set(extractUrls(message.content).flatMap(normalizeUrl))];
  if (canonicalIds.length === 0) return;

  const stmt = client.db.prepare(
    `INSERT INTO pending_link_posts (
      guild_id,
      channel_id,
      user_id,
      canonical_id,
      message_id,
      created_at
    ) VALUES (?, ?, ?, ?, ?, ?)`,
  );
  const createdAt = Math.floor(message.createdTimestamp / 1000);

  for (const canonicalId of canonicalIds) {
    stmt.run(
      message.guild.id,
      message.channel.id,
      message.author.id,
      canonicalId,
      message.id,
      createdAt,
    );
  }
}

export function getPendingCommandsForChannel(channelId: string): PendingCommand[] {
  cleanupPendingCommands();
  return pendingCommands.filter((command) => command.channelId === channelId);
}

export function consumePendingCommand(match: PendingCommand): void {
  const index = pendingCommands.findIndex(
    (command) =>
      command.channelId === match.channelId &&
      command.userId === match.userId &&
      command.timestamp === match.timestamp &&
      command.command === match.command,
  );

  if (index >= 0) {
    pendingCommands.splice(index, 1);
  }
}

export function startPendingCleanup(client: BotClient): void {
  if (cleanupStarted) return;
  cleanupStarted = true;

  cleanupPendingCommands();
  cleanupPendingLinks(client);

  const interval = setInterval(() => {
    cleanupPendingCommands();
    cleanupPendingLinks(client);
  }, 30_000);

  interval.unref?.();
}

function cleanupPendingCommands(): void {
  const cutoff = Math.floor(Date.now() / 1000) - 60;
  for (let index = pendingCommands.length - 1; index >= 0; index -= 1) {
    if (pendingCommands[index].timestamp < cutoff) {
      pendingCommands.splice(index, 1);
    }
  }
}

function cleanupPendingLinks(client: BotClient): void {
  const cutoff = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
  client.db.prepare("DELETE FROM pending_link_posts WHERE created_at < ?").run(cutoff);
}
