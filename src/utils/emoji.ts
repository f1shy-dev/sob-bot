const CUSTOM_EMOJI_PATTERN = "<a?:\\w+:\\d+>";
const FLAG_EMOJI_PATTERN = "\\p{Regional_Indicator}{2}";
const SUBDIVISION_FLAG_EMOJI_PATTERN = "\\u{1F3F4}[\\u{E0061}-\\u{E007A}]+\\u{E007F}";
const KEYCAP_EMOJI_PATTERN = "[\\d#*]\\uFE0F?\\u20E3";
const EMOJI_UNIT_PATTERN =
  "(?:\\p{Emoji_Presentation}|\\p{Emoji}\\uFE0F)\\p{Emoji_Modifier}?";
const UNICODE_EMOJI_PATTERN =
  `(?:${FLAG_EMOJI_PATTERN}|${SUBDIVISION_FLAG_EMOJI_PATTERN}|${KEYCAP_EMOJI_PATTERN}|${EMOJI_UNIT_PATTERN}(?:\\u200D${EMOJI_UNIT_PATTERN})*)`;

const EMOJI_REGEX = new RegExp(`${CUSTOM_EMOJI_PATTERN}|${UNICODE_EMOJI_PATTERN}`, "gu");
const SINGLE_EMOJI_REGEX = new RegExp(`^(?:${CUSTOM_EMOJI_PATTERN}|${UNICODE_EMOJI_PATTERN})$`, "u");

export function extractEmoji(content: string): Set<string> {
  const emoji = new Set<string>();

  const matches = content.matchAll(EMOJI_REGEX);
  for (const match of matches) {
    const value = match[0];
    if (value) emoji.add(value);
  }

  return emoji;
}

export function parseSingleEmoji(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed || !SINGLE_EMOJI_REGEX.test(trimmed)) return null;
  return trimmed;
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
