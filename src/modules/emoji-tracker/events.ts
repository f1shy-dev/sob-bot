import type { MessageReaction, PartialMessageReaction, PartialUser, User } from "discord.js";
import type { BotClient } from "../../client";
import { formatReactionEmoji } from "../../utils/emoji";

async function resolveReaction(
  reaction: MessageReaction | PartialMessageReaction,
): Promise<MessageReaction | PartialMessageReaction | null> {
  if (reaction.partial) {
    try {
      await reaction.fetch();
    } catch {
      return null;
    }
  }

  if (reaction.message.partial) {
    try {
      await reaction.message.fetch();
    } catch {
      return null;
    }
  }

  return reaction;
}

export async function handleReactionAdd(
  client: BotClient,
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
): Promise<void> {
  if (user.bot) return;

  const resolvedReaction = await resolveReaction(reaction);
  if (!resolvedReaction || !resolvedReaction.message.guild) return;

  const emoji = formatReactionEmoji(resolvedReaction.emoji);
  if (!emoji) return;

  const messageAuthorId = resolvedReaction.message.author?.id;
  if (!messageAuthorId) return;

  const isSelfReact = user.id === messageAuthorId ? 1 : 0;

  client.db
    .prepare(
      `INSERT OR IGNORE INTO reaction_events (
        guild_id,
        channel_id,
        message_id,
        message_author_id,
        reactor_id,
        emoji,
        is_self_react,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      resolvedReaction.message.guild.id,
      resolvedReaction.message.channel.id,
      resolvedReaction.message.id,
      messageAuthorId,
      user.id,
      emoji,
      isSelfReact,
      Math.floor(Date.now() / 1000),
    );
}

export async function handleReactionRemove(
  client: BotClient,
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser,
): Promise<void> {
  if (user.bot) return;

  const resolvedReaction = await resolveReaction(reaction);
  if (!resolvedReaction || !resolvedReaction.message.guild) return;

  const emoji = formatReactionEmoji(resolvedReaction.emoji);
  if (!emoji) return;

  client.db
    .prepare(
      `DELETE FROM reaction_events
       WHERE guild_id = ? AND message_id = ? AND reactor_id = ? AND emoji = ?`,
    )
    .run(resolvedReaction.message.guild.id, resolvedReaction.message.id, user.id, emoji);
}
