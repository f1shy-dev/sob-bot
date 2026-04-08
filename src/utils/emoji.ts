const CUSTOM_EMOJI_REGEX = /<a?:\w+:\d+>/g;

const UNICODE_EMOJI_REGEX =
  /(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F)(?:\u200D(?:\p{Emoji_Presentation}|\p{Emoji}\uFE0F))*/gu;

export function extractEmoji(content: string): Set<string> {
  const emoji = new Set<string>();

  const customMatches = content.match(CUSTOM_EMOJI_REGEX);
  if (customMatches) {
    for (const match of customMatches) emoji.add(match);
  }

  const unicodeMatches = content.match(UNICODE_EMOJI_REGEX);
  if (unicodeMatches) {
    for (const match of unicodeMatches) {
      if (!/^[\d#*]/.test(match)) emoji.add(match);
    }
  }

  return emoji;
}

export function formatReactionEmoji(emoji: {
  id: string | null;
  name: string | null;
  animated?: boolean | null;
}): string | null {
  if (emoji.id) {
    return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}>`;
  }
  return emoji.name;
}
