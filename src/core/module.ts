import type { Message, ClientEvents, ChatInputCommandInteraction } from "discord.js";
import type { BotClient } from "../client";

export interface SlashCommandDefinition {
  name: string;
  toJSON: () => unknown;
}

export interface PrefixCommand {
  aliases: string[];
  description: string;
  adminOnly?: boolean;
  execute: (message: Message, args: string[], client: BotClient) => Promise<void>;
}

export interface Module {
  name: string;
  slashCommands?: SlashCommandDefinition[];
  prefixCommands?: PrefixCommand[];
  events?: {
    event: keyof ClientEvents;
    handler: (client: BotClient, ...args: any[]) => Promise<void>;
  }[];
  onReady?: (client: BotClient) => Promise<void>;
  handleSlashCommand?: (
    interaction: ChatInputCommandInteraction,
    client: BotClient,
  ) => Promise<boolean>;
}
