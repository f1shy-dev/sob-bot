import { Collection, Events } from "discord.js";
import { BotClient } from "./client";
import { config, validateConfig } from "./config";
import { initializeDatabase } from "./core/database";
import { handlePrefixCommand } from "./core/router";
import type { Module } from "./core/module";
import { emojiTrackerModule } from "./modules/emoji-tracker";

const modules: Module[] = [
  emojiTrackerModule,
];

async function main(): Promise<void> {
  validateConfig();

  const client = new BotClient();
  initializeDatabase(client.db);

  client.modules = new Collection();
  client.prefixCommands = new Collection();

  for (const mod of modules) {
    client.modules.set(mod.name, mod);

    if (mod.prefixCommands) {
      for (const cmd of mod.prefixCommands) {
        for (const alias of cmd.aliases) {
          client.prefixCommands.set(alias.toLowerCase(), cmd);
        }
      }
    }

    if (mod.events) {
      for (const { event, handler } of mod.events) {
        client.on(event, (...args: any[]) => handler(client, ...args));
      }
    }
  }

  client.on(Events.MessageCreate, (message) => handlePrefixCommand(client, message));

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    for (const mod of client.modules.values()) {
      const cmd = mod.slashCommands?.find(
        (command) => command.name === interaction.commandName,
      );
      if (cmd) {
        break;
      }
    }
  });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`✅ Logged in as ${readyClient.user.tag}`);
    console.log(`📊 Tracking emoji across ${readyClient.guilds.cache.size} servers`);

    for (const mod of client.modules.values()) {
      if (mod.onReady) await mod.onReady(client);
    }
  });

  await client.login(config.token);
}

main().catch(console.error);
