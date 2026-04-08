import { Events } from "discord.js";
import type { Module } from "../../core/module";
import { handleMessageCreate, handleReactionAdd } from "./events";

export const emojiTrackerModule: Module = {
  name: "emoji-tracker",
  events: [
    { event: Events.MessageCreate, handler: handleMessageCreate },
    { event: Events.MessageReactionAdd, handler: handleReactionAdd },
  ],
};
