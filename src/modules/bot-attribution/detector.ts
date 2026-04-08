import type { Guild, GuildMember, Message } from "discord.js";
import type { BotClient } from "../../client";
import { getPendingCommandsForChannel, consumePendingCommand } from "./pending";
import type { AttributionResult } from "./types";
import { extractUrls, normalizeUrl } from "./url-normalizer";

interface LinkMatchRow {
  user_id: string;
}

interface InteractionUserShape {
  id?: string;
  userId?: string;
}

interface InteractionMetadataShape {
  user?: InteractionUserShape;
  userId?: string;
}

interface InteractionShape {
  user?: InteractionUserShape;
}

export async function detectAttribution(
  client: BotClient,
  message: Message,
): Promise<AttributionResult | null> {
  const reply = await detectReplyAttribution(message);
  if (reply) return reply;

  if (!isFmbotMessage(client, message)) return null;

  const slash = detectSlash(message);
  if (slash) return slash;

  const linkEmbed = detectLinkEmbed(client, message);
  if (linkEmbed) return linkEmbed;

  const explicit = await detectExplicitText(message);
  if (explicit) return explicit;

  const whoKnows = await detectWhoKnows(message);
  if (whoKnows) return whoKnows;

  const correlation = detectLiveCorrelation(client, message);
  if (correlation) return correlation;

  return null;
}

export async function detectAttributionLate(
  client: BotClient,
  message: Message,
): Promise<AttributionResult | null> {
  const reply = await detectReplyAttribution(message);
  if (reply) return reply;

  if (!isFmbotMessage(client, message)) return null;

  const slash = detectSlash(message);
  if (slash) return slash;

  const linkEmbed = detectLinkEmbed(client, message);
  if (linkEmbed) return linkEmbed;

  const explicit = await detectExplicitText(message);
  if (explicit) return explicit;

  const whoKnows = await detectWhoKnows(message);
  if (whoKnows) return whoKnows;

  const correlation = detectLiveCorrelation(client, message);
  if (correlation) return correlation;

  return null;
}

async function detectReplyAttribution(message: Message): Promise<AttributionResult | null> {
  if (!message.guild || !message.author.bot || !message.reference?.messageId) return null;

  try {
    const referencedMessage = await message.fetchReference();
    const referencedAuthor = referencedMessage.author;
    if (!referencedAuthor || referencedAuthor.bot) return null;

    return { userId: referencedAuthor.id, strategy: "reply", confidence: 0.95 };
  } catch {
    return null;
  }
}

function detectSlash(message: Message): AttributionResult | null {
  const slashMessage = message as Message & {
    interactionMetadata?: InteractionMetadataShape;
    interaction?: InteractionShape;
  };
  const interactionUser =
    slashMessage.interactionMetadata?.user ??
    (slashMessage.interactionMetadata?.userId
      ? { id: slashMessage.interactionMetadata.userId }
      : null) ??
    slashMessage.interaction?.user;

  if (!interactionUser?.id) return null;

  return { userId: interactionUser.id, strategy: "slash", confidence: 1.0 };
}

function detectLinkEmbed(client: BotClient, message: Message): AttributionResult | null {
  if (!message.guild) return null;

  const urls = new Set<string>();
  for (const url of extractUrls(message.content)) {
    urls.add(url);
  }
  for (const embed of message.embeds) {
    if (embed.url) urls.add(embed.url);
    if (embed.author?.url) urls.add(embed.author.url);
  }

  const canonicalIds = [...new Set([...urls].flatMap(normalizeUrl))];
  if (canonicalIds.length === 0) return null;

  const cutoff = Math.floor(Date.now() / 1000) - 5 * 60;
  const stmt = client.db.query<LinkMatchRow, [string, string, number]>(
    `SELECT user_id
     FROM pending_link_posts
     WHERE channel_id = ? AND canonical_id = ? AND created_at >= ?
     ORDER BY created_at DESC
     LIMIT 1`,
  );

  for (const canonicalId of canonicalIds) {
    const row = stmt.get(message.channel.id, canonicalId, cutoff);
    if (row) {
      return { userId: row.user_id, strategy: "link_embed", confidence: 0.85 };
    }
  }

  return null;
}

function isFmbotMessage(client: BotClient, message: Message): boolean {
  if (!message.guild) return false;
  const row = client.db
    .query<{ fmbot_user_id: string | null }, [string]>(
      "SELECT fmbot_user_id FROM guild_settings WHERE guild_id = ?",
    )
    .get(message.guild.id);
  return row?.fmbot_user_id === message.author.id;
}

async function detectExplicitText(message: Message): Promise<AttributionResult | null> {
  if (!message.guild) return null;

  const texts = extractComponentsV2Text(message);
  for (const text of texts) {
    const match = text.match(/requested by ([^\n]+)/i);
    const displayName = match?.[1]?.trim();
    if (!displayName) continue;

    const member = await resolveByDisplayName(message.guild, displayName);
    if (member) {
      return { userId: member.id, strategy: "explicit_text", confidence: 1.0 };
    }
  }

  return null;
}

async function detectWhoKnows(message: Message): Promise<AttributionResult | null> {
  if (!message.guild) return null;
  if (!message.embeds.some((embed) => embed.title?.includes(" in "))) return null;

  for (const embed of message.embeds) {
    if (!embed.description) continue;

    for (const line of embed.description.split("\n")) {
      const match = line.match(
        /^\s*(?:.+?\s+)?\*\*\[\u2066([^\u2069]+)\u2069\]\([^)]+\) - .+\*\*\s*$/u,
      );
      const displayName = match?.[1]?.trim();
      if (!displayName) continue;

      const member = await resolveByDisplayName(message.guild, displayName);
      if (member) {
        return { userId: member.id, strategy: "who_knows", confidence: 0.9 };
      }
    }
  }

  return null;
}

function detectLiveCorrelation(client: BotClient, message: Message): AttributionResult | null {
  const messageTimestamp = Math.floor(message.createdTimestamp / 1000);
  const candidates = getPendingCommandsForChannel(message.channel.id).filter(
    (command) => Math.abs(messageTimestamp - command.timestamp) <= 30,
  );

  if (candidates.length === 0) return null;

  if (candidates.length === 1) {
    consumePendingCommand(candidates[0]);
    return { userId: candidates[0].userId, strategy: "live_correlation", confidence: 0.8 };
  }

  const closest = [...candidates].sort(
    (left, right) =>
      Math.abs(messageTimestamp - left.timestamp) - Math.abs(messageTimestamp - right.timestamp),
  )[0];
  consumePendingCommand(closest);

  return { userId: closest.userId, strategy: "live_correlation", confidence: 0.6 };
}

function extractComponentsV2Text(message: Message): string[] {
  const texts: string[] = [];

  try {
    const rawComponents = message.components.map((component) => component.toJSON());
    walkComponents(rawComponents, texts);
  } catch {}

  return texts;
}

function walkComponents(components: any[], texts: string[]): void {
  for (const component of components) {
    if (component.type === 10 && typeof component.content === "string") {
      texts.push(component.content);
    }
    if (Array.isArray(component.components)) {
      walkComponents(component.components, texts);
    }
    if (Array.isArray(component.accessory?.components)) {
      walkComponents(component.accessory.components, texts);
    }
  }
}

async function resolveByDisplayName(
  guild: Guild,
  displayName: string,
): Promise<GuildMember | null> {
  const members = guild.members.cache;

  const exact = members.find(
    (member) => member.displayName === displayName || member.user.username === displayName,
  );
  if (exact) return exact;

  const lower = displayName.toLowerCase();
  const insensitive = members.find(
    (member) =>
      member.displayName.toLowerCase() === lower || member.user.username.toLowerCase() === lower,
  );
  if (insensitive) return insensitive;

  try {
    const fetched = await guild.members.fetch({ query: displayName, limit: 5 });
    return (
      fetched.find(
        (member) =>
          member.displayName.toLowerCase() === lower ||
          member.user.username.toLowerCase() === lower,
      ) ?? null
    );
  } catch {
    return null;
  }
}
