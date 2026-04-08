import {
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type GuildMember,
  type Message,
} from "discord.js";
import type { BotClient } from "../../client";
import { getGuildLeaderboards, getGuildPrefix } from "../../core/router";
import { baseEmbed, errorEmbed } from "../../utils/embeds";
import { isAdmin } from "../../utils/permissions";
import { generateAliases } from "../../utils/words";

export const helpSlashCommand = new SlashCommandBuilder()
  .setName("help")
  .setDescription("Show all available commands");

function buildHelpEmbed(client: BotClient, guildId: string, admin: boolean) {
  const prefix = getGuildPrefix(client, guildId);
  const dynamicLines = getGuildLeaderboards(client, guildId).map((leaderboard) => {
    const aliases = generateAliases(leaderboard.word);
    return `${leaderboard.emoji}: ${[...aliases.leaderboard, ...aliases.mostReacted].join(", ")}`;
  });

  const embed = baseEmbed()
    .setTitle("📖 Bot Commands")
    .addFields(
      {
        name: "🏆 Leaderboards",
        value: [
          "`emojileaderboard <emoji> [period]` — Show collected leaderboard for any emoji",
          "`emojimostreacted <emoji> [period]` — Show most reacted messages for any emoji",
          ...dynamicLines,
        ].join("\n"),
      },
      {
        name: "ℹ️ Other",
        value: "`help` — This message",
      },
    );

  if (admin) {
    embed.spliceFields(1, 0, {
      name: "⚙️ Admin",
      value: [
        "`settings prefix <new-prefix>` — Set server prefix",
        "`settings selfreact <on|off>` — Toggle self-react penalty",
        "`settings fmbot <@bot>` — Set fmbot bot user for attribution",
        "`settings fmbot-prefix <prefix>` — Set fmbot command prefix",
        "`settings info` — Show current settings",
        "`define-leaderboard <word> <emoji>` — Create a custom leaderboard",
        "`remove-leaderboard <word>` — Remove a custom leaderboard",
        "`list-leaderboards` — Show all custom leaderboards",
      ].join("\n"),
    });
  }

  return embed.setFooter({ text: `Prefix: ${prefix} • All commands work as /slash too` });
}

export async function handleHelpSlashCommand(
  interaction: ChatInputCommandInteraction,
  client: BotClient,
): Promise<boolean> {
  if (interaction.commandName !== "help") return false;

  if (!interaction.guildId) {
    await interaction.reply({
      embeds: [errorEmbed("This command can only be used in a server.")],
      ephemeral: true,
    });
    return true;
  }

  await interaction.reply({
    embeds: [
      buildHelpEmbed(
        client,
        interaction.guildId,
        isAdmin(interaction.user.id, interaction.member as GuildMember | null),
      ),
    ],
    ephemeral: true,
  });
  return true;
}

export async function handleHelpPrefixCommand(
  message: Message,
  _args: string[],
  client: BotClient,
): Promise<void> {
  if (!message.guild) return;

  await message.reply({
    embeds: [buildHelpEmbed(client, message.guild.id, isAdmin(message.author.id, message.member))],
  });
}
