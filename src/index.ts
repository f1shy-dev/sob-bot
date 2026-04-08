import { Collection, Events } from "discord.js";
import { BotClient } from "./client";
import { config, validateConfig } from "./config";
import { initializeDatabase } from "./core/database";
import { getDynamicLeaderboardByAlias, handlePrefixCommand } from "./core/router";
import type { Module } from "./core/module";
import { adminModule } from "./modules/admin";
import { customLeaderboardModule } from "./modules/custom-leaderboard";
import { emojiTrackerModule } from "./modules/emoji-tracker";
import { handleDynamicLeaderboardSlashCommand } from "./modules/leaderboard/commands";
import { leaderboardModule } from "./modules/leaderboard";
import { errorEmbed } from "./utils/embeds";
import { scheduleS3Backup } from "./utils/s3-backup";

const modules: Module[] = [
  emojiTrackerModule,
  leaderboardModule,
  customLeaderboardModule,
  adminModule,
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

  client.on(Events.MessageCreate, (message) => void handlePrefixCommand(client, message));

  client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    try {
      for (const mod of client.modules.values()) {
        if (mod.handleSlashCommand && (await mod.handleSlashCommand(interaction, client))) {
          return;
        }
      }

      if (interaction.guildId) {
        const dynamicLeaderboard = getDynamicLeaderboardByAlias(
          client,
          interaction.guildId,
          interaction.commandName,
        );

        if (dynamicLeaderboard) {
          await handleDynamicLeaderboardSlashCommand(interaction, client, dynamicLeaderboard);
          return;
        }
      }

      if (!interaction.replied && !interaction.deferred) {
        await interaction.reply({
          embeds: [errorEmbed(`No handler found for command \`${interaction.commandName}\`.`)],
          ephemeral: true,
        });
      }
    } catch (error) {
      console.error(`Slash command error [${interaction.commandName}]:`, error);

      const payload = {
        embeds: [errorEmbed("Something went wrong executing that command.")],
        ephemeral: true,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(payload).catch(() => {});
      } else {
        await interaction.reply(payload).catch(() => {});
      }
    }
  });

  client.once(Events.ClientReady, async (readyClient) => {
    console.log(`✅ Logged in as ${readyClient.user.tag}`);
    console.log(`📊 Tracking emoji across ${readyClient.guilds.cache.size} servers`);

    for (const mod of client.modules.values()) {
      if (mod.onReady) await mod.onReady(client);
    }

    scheduleS3Backup();
  });

  await client.login(config.token);
}

main().catch(console.error);
