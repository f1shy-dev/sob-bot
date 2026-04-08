import { REST, Routes } from "discord.js";
import { config, validateConfig } from "./config";

validateConfig();

const commands: any[] = [];

const rest = new REST({ version: "10" }).setToken(config.token);

async function deploy(): Promise<void> {
  console.log(`Deploying ${commands.length} global slash commands...`);
  await rest.put(Routes.applicationCommands(config.clientId), { body: commands });
  console.log("✅ Commands deployed.");
}

deploy().catch(console.error);
