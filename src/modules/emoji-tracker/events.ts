import type {
  Message,
  MessageReaction,
  PartialMessageReaction,
  User,
  PartialUser,
} from "discord.js";
import type { BotClient } from "../../client";
import { extractEmoji, formatReactionEmoji } from "../../utils/emoji";

const insertStmt = `
  INSERT INTO emoji_events (guild_id, user_id, emoji, event_type, channel_id, message_id, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`;

export async function handleMessageCreate(
  client: BotClient,
  message: Message,
): Promise<void> {
  if (message.author.bot || !message.guild) return;

  const emoji = extractEmoji(message.content);
  if (emoji.size === 0) return;

  const now = Math.floor(Date.now() / 1000);
  const insert = client.db.prepare(insertStmt);
  const insertMany = client.db.transaction((emojiSet: Set<string>) => {
    for (const e of emojiSet) {
      insert.run(
        message.guild!.id,
        message.author.id,
        e,
        "message",
        message.channel.id,
        message.id,
        now,
      );
    }
  });
  insertMany(emoji);
}

export async function handleReactionAdd(
  client: BotClient,
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
): Promise<void> {
  if (user.bot) return;

  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return;
    }
  }

  if (!reaction.message.guild) return;

  const emoji = formatReactionEmoji(reaction.emoji);
  if (!emoji) return;

  const now = Math.floor(Date.now() / 1000);
  client.db.prepare(insertStmt).run(
    reaction.message.guild.id,
    user.id,
    emoji,
    "reaction",
    reaction.message.channel.id,
    reaction.message.id,
    now,
  );
}
