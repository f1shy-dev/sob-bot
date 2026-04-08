import type { Message } from "discord.js";
import type { BotClient } from "../../client";
import { detectAttribution } from "./detector";
import { recordPendingFmbotCommand, recordPendingLinks } from "./pending";
import { reconcileAttributedReactionEvents, storeAttribution } from "./queries";

export async function handleMessageForAttribution(
  client: BotClient,
  message: Message,
): Promise<void> {
  if (!message.guild) return;

  if (!message.author.bot) {
    recordPendingFmbotCommand(client, message);
    recordPendingLinks(client, message);
    return;
  }

  const result = await detectAttribution(client, message);
  if (!result) return;

  storeAttribution(client.db, {
    messageId: message.id,
    guildId: message.guild.id,
    channelId: message.channel.id,
    botUserId: message.author.id,
    attributedUserId: result.userId,
    strategy: result.strategy,
    confidence: result.confidence,
  });
  reconcileAttributedReactionEvents(client.db, message.id, message.author.id, result.userId);
}
