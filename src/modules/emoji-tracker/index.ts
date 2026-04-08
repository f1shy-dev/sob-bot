import { Events } from "discord.js";
import type { Module } from "../../core/module";
import { handleReactionAdd, handleReactionRemove } from "./events";

export const emojiTrackerModule: Module = {
  name: "emoji-tracker",
  events: [
    { event: Events.MessageReactionAdd, handler: handleReactionAdd },
    { event: Events.MessageReactionRemove, handler: handleReactionRemove },
  ],
};
