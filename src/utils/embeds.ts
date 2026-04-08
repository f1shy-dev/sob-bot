import { EmbedBuilder } from "discord.js";

const BRAND_COLOR = 0x5865f2;

export function baseEmbed(): EmbedBuilder {
  return new EmbedBuilder().setColor(BRAND_COLOR).setTimestamp();
}

export function errorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0xed4245).setDescription(`❌ ${message}`);
}

export function successEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder().setColor(0x57f287).setDescription(`✅ ${message}`);
}
