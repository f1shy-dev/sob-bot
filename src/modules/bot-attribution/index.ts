import { Events } from "discord.js";
import type { Module } from "../../core/module";
import { handleMessageForAttribution } from "./events";
import { startPendingCleanup } from "./pending";

export const botAttributionModule: Module = {
  name: "bot-attribution",
  events: [{ event: Events.MessageCreate, handler: handleMessageForAttribution }],
  onReady: async (client) => {
    startPendingCleanup(client);
  },
};
