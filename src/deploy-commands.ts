import { REST, Routes } from "discord.js";
import { config, validateConfig } from "./config";
import { adminModule } from "./modules/admin";
import { customLeaderboardModule } from "./modules/custom-leaderboard";
import { emojiTrackerModule } from "./modules/emoji-tracker";
import { leaderboardModule } from "./modules/leaderboard";

const modules = [emojiTrackerModule, leaderboardModule, customLeaderboardModule, adminModule];

validateConfig();

const commands = modules
  .flatMap((module) => module.slashCommands ?? [])
  .map((command) => command.toJSON());

const rest = new REST({ version: "10" }).setToken(config.token);

async function deploy(): Promise<void> {
  console.log(`Deploying ${commands.length} global slash commands...`);
  await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
  console.log("✅ Global commands deployed.");
}

deploy().catch(console.error);
