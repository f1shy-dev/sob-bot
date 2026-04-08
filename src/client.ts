import { mkdirSync, existsSync } from "node:fs";
import {
  Client,
  Collection,
  GatewayIntentBits,
  Partials,
} from "discord.js";
import { Database } from "bun:sqlite";
import type { Module, PrefixCommand } from "./core/module";

export class BotClient extends Client {
  db: Database;
  modules: Collection<string, Module> = new Collection();
  prefixCommands: Collection<string, PrefixCommand> = new Collection();

  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMessageReactions,
      ],
      partials: [Partials.Message, Partials.Reaction],
    });

    if (!existsSync("data")) {
      mkdirSync("data", { recursive: true });
    }

    this.db = new Database("data/bot.db");
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.db.exec("PRAGMA foreign_keys = ON;");
  }
}
