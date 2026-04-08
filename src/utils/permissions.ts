import type { GuildMember } from "discord.js";
import { config } from "../config";

export function isAdmin(userId: string, member?: GuildMember | null): boolean {
  if (config.globalAdmins.includes(userId)) return true;
  if (member?.permissions.has("Administrator")) return true;
  return false;
}
