---
name: discordjs-guide
description: Discord.js v14 guide and API reference. Use when building or modifying Discord bot features — slash commands, events, embeds, buttons, modals, select menus, collectors, permissions, intents, voice, or any discord.js interaction pattern.
---

# discord.js v14 Reference

## Setup — clone guide on first use

The guide source is NOT bundled. Clone it into this skill folder before reading:

```bash
if [ ! -d ".agents/skills/discordjs-guide/repo" ]; then
  git clone --depth 1 https://github.com/discordjs/guide.git .agents/skills/discordjs-guide/repo
fi
```

All guide markdown lives under `repo/guide/`. Read the specific file you need — do not read everything.

## Guide index

Paths below are relative to `.agents/skills/discordjs-guide/repo/guide/`.

### Bot setup
| File | Covers |
|------|--------|
| `preparations/setting-up-a-bot-application.md` | Creating a Discord app, getting a token |
| `preparations/adding-your-bot-to-servers.md` | OAuth2 invite URLs, permissions calculator |
| `creating-your-bot/main-file.md` | Client instantiation, intents, login |
| `creating-your-bot/event-handling.md` | Event listeners, the `Events` enum |
| `creating-your-bot/command-handling.md` | Command file organization, dynamic loading |
| `creating-your-bot/command-deployment.md` | Registering slash commands with the API |

### Slash commands
| File | Covers |
|------|--------|
| `creating-your-bot/slash-commands.md` | Basic slash command structure |
| `slash-commands/response-methods.md` | `reply()`, `deferReply()`, `followUp()`, ephemeral |
| `slash-commands/parsing-options.md` | String, integer, boolean, user, channel, role, attachment options |
| `slash-commands/advanced-creation.md` | Subcommands, subcommand groups, choices, autocomplete builders |
| `slash-commands/autocomplete.md` | Autocomplete interaction handling |
| `slash-commands/permissions.md` | Default member permissions, DM permissions |
| `slash-commands/deleting-commands.md` | Bulk delete, single delete |

### Interactions & components
| File | Covers |
|------|--------|
| `interactions/context-menus.md` | User and message context menu commands |
| `interactions/modals.md` | `ModalBuilder`, `TextInputBuilder`, modal submit handling |
| `interactive-components/buttons.md` | `ButtonBuilder`, button styles, link buttons |
| `interactive-components/select-menus.md` | String, user, role, channel, mentionable select menus |
| `interactive-components/action-rows.md` | `ActionRowBuilder`, component layout rules |
| `interactive-components/interactions.md` | Component interaction collectors, custom IDs |

### Common patterns
| File | Covers |
|------|--------|
| `popular-topics/embeds.md` | `EmbedBuilder`, fields, images, timestamps |
| `popular-topics/collectors.md` | `MessageCollector`, `InteractionCollector`, filters |
| `popular-topics/reactions.md` | Adding, removing, awaiting reactions |
| `popular-topics/threads.md` | Creating, archiving, managing threads |
| `popular-topics/permissions.md` | Checking, requiring permissions |
| `popular-topics/intents.md` | Gateway intents, privileged intents, which intents enable what |
| `popular-topics/partials.md` | Partial structures, fetching partials |
| `popular-topics/errors.md` | Common errors, debugging strategies |
| `popular-topics/faq.md` | Frequently asked questions and solutions |
| `popular-topics/formatters.md` | Markdown helpers, timestamps, mentions |
| `popular-topics/canvas.md` | Image generation with Canvas |
| `popular-topics/webhooks.md` | Creating and sending via webhooks |
| `popular-topics/audit-logs.md` | Fetching and reading audit log entries |
| `popular-topics/display-components.md` | Components V2: containers, sections, media galleries, labels, separators, files |

### Voice
| File | Covers |
|------|--------|
| `voice/voice-connections.md` | Joining channels, connection lifecycle |
| `voice/audio-resources.md` | Creating audio resources from files/streams |
| `voice/audio-player.md` | AudioPlayer states, subscriptions |
| `voice/life-cycles.md` | State machine diagrams for connections and players |

### Other
| File | Covers |
|------|--------|
| `additional-features/cooldowns.md` | Per-user command cooldowns |
| `additional-features/reloading-commands.md` | Hot-reloading commands without restart |
| `additional-info/rest-api.md` | Direct REST API usage with `@discordjs/rest` |
| `additional-info/collections.md` | `Collection` methods (filter, map, find, etc.) |
| `additional-info/changes-in-v14.md` | Migration notes from v13 to v14 |
| `sharding/README.md` | ShardingManager basics |
| `miscellaneous/useful-packages.md` | Recommended npm packages |

## API reference (online)

For class/method/property details not covered in the guide, fetch from:

```
https://discord.js.org/docs/packages/discord.js/14.26.2/{ClassName}:{Type}
```

Where `{Type}` is `Class`, `Interface`, `TypeAlias`, or `Enum`. Examples:
- `https://discord.js.org/docs/packages/discord.js/14.26.2/Client:Class`
- `https://discord.js.org/docs/packages/discord.js/14.26.2/EmbedBuilder:Class`
- `https://discord.js.org/docs/packages/discord.js/14.26.2/GatewayIntentBits:Enum`
- `https://discord.js.org/docs/packages/discord.js/14.26.2/ChatInputCommandInteraction:Class`

### Frequently needed classes
- **Client** — bot client, events, login
- **ChatInputCommandInteraction** — slash command handler context
- **ButtonInteraction**, **StringSelectMenuInteraction**, **ModalSubmitInteraction** — component handlers
- **EmbedBuilder**, **ActionRowBuilder**, **ButtonBuilder** — message component builders
- **ModalBuilder**, **TextInputBuilder** — modal builders
- **SlashCommandBuilder**, **ContextMenuCommandBuilder** — command registration
- **PermissionsBitField**, **IntentsBitField** — bitfield utilities
- **Collection** — enhanced Map used for caches
- **GuildMember**, **Role**, **Guild**, **TextChannel**, **VoiceChannel** — core structures

## Key patterns (quick reference)

### Replying to a slash command
```js
const { SlashCommandBuilder } = require('discord.js');
module.exports = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Replies with Pong!'),
  async execute(interaction) {
    await interaction.reply('Pong!');
  },
};
```

### Deferred reply (for long operations)
```js
await interaction.deferReply(); // shows "Bot is thinking..."
// ... do work ...
await interaction.editReply('Done!');
```

### Embed
```js
const { EmbedBuilder } = require('discord.js');
const embed = new EmbedBuilder()
  .setColor(0x0099FF)
  .setTitle('Some title')
  .setDescription('Some description')
  .addFields({ name: 'Field', value: 'Value', inline: true })
  .setTimestamp();
await interaction.reply({ embeds: [embed] });
```

### Button row
```js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const row = new ActionRowBuilder().addComponents(
  new ButtonBuilder().setCustomId('confirm').setLabel('Confirm').setStyle(ButtonStyle.Success),
  new ButtonBuilder().setCustomId('cancel').setLabel('Cancel').setStyle(ButtonStyle.Danger),
);
await interaction.reply({ content: 'Are you sure?', components: [row] });
```

### Collector on components
```js
const collector = message.createMessageComponentCollector({ time: 60_000 });
collector.on('collect', async i => {
  if (i.customId === 'confirm') await i.update({ content: 'Confirmed!', components: [] });
});
collector.on('end', () => { /* cleanup */ });
```
