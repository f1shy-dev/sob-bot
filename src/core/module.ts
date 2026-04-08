import type {
  SlashCommandBuilder,
  Message,
  ClientEvents,
} from "discord.js";
import type { BotClient } from "../client";

export interface PrefixCommand {
  aliases: string[];
  description: string;
  adminOnly?: boolean;
  execute: (
    message: Message,
    args: string[],
    client: BotClient,
  ) => Promise<void>;
}

export interface Module {
  name: string;
  slashCommands?: SlashCommandBuilder[];
  prefixCommands?: PrefixCommand[];
  events?: {
    event: keyof ClientEvents;
    handler: (client: BotClient, ...args: any[]) => Promise<void>;
  }[];
  onReady?: (client: BotClient) => Promise<void>;
}
