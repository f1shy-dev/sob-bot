import type {
  Message,
  MessageReaction,
  PartialMessageReaction,
  PartialUser,
  User,
} from "discord.js";
import type { BotClient } from "../../client";
import { formatReactionEmoji } from "../../utils/emoji";
import { detectAttributionLate } from "../bot-attribution/detector";
import {
  getAttribution,
  reconcileAttributedReactionEvents,
  storeAttribution,
} from "../bot-attribution/queries";

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

  const rawAuthorId = resolvedReaction.message.author?.id;
  if (!rawAuthorId) return;

  let messageAuthorId = rawAuthorId;
  let botAuthorId: string | null = null;

  if (resolvedReaction.message.author?.bot) {
    botAuthorId = rawAuthorId;

    let attribution = getAttribution(client.db, resolvedReaction.message.id);

    if (!attribution) {
      const lateResult = await detectAttributionLate(client, resolvedReaction.message as Message);
      if (lateResult && resolvedReaction.message.guild) {
        storeAttribution(client.db, {
          messageId: resolvedReaction.message.id,
          guildId: resolvedReaction.message.guild.id,
          channelId: resolvedReaction.message.channel.id,
          botUserId: rawAuthorId,
          attributedUserId: lateResult.userId,
          strategy: lateResult.strategy,
          confidence: lateResult.confidence,
        });
        attribution = {
          attributed_user_id: lateResult.userId,
          bot_user_id: rawAuthorId,
          strategy: lateResult.strategy,
          confidence: lateResult.confidence,
        };
      }
    }

    if (attribution) {
      reconcileAttributedReactionEvents(
        client.db,
        resolvedReaction.message.id,
        rawAuthorId,
        attribution.attributed_user_id,
      );
      messageAuthorId = attribution.attributed_user_id;
    }
  }

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
        bot_author_id,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      resolvedReaction.message.guild.id,
      resolvedReaction.message.channel.id,
      resolvedReaction.message.id,
      messageAuthorId,
      user.id,
      emoji,
      isSelfReact,
      botAuthorId,
      Math.floor(Date.now() / 1000),
    );
}

export async function handleReactionRemove(
  _client: BotClient,
  _reaction: MessageReaction | PartialMessageReaction,
  _user: User | PartialUser,
): Promise<void> {
  // Intentionally ignored: once a reaction has been tracked, removing it should not
  // reduce historical counts. INSERT OR IGNORE on add still prevents repeat-reaction farming.
}
