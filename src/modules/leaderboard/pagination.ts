import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  type EmbedBuilder,
  type Message,
} from "discord.js";

export function buildPaginationRow(
  page: number,
  totalPages: number,
): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("lb_prev")
      .setLabel("◀ Previous")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page === 0),
    new ButtonBuilder()
      .setCustomId("lb_next")
      .setLabel("Next ▶")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages - 1),
  );
}

export async function attachPagination(
  replyMessage: Message,
  options: {
    userId: string;
    totalPages: number;
    fetchPage: (page: number) =>
      | {
          embeds: EmbedBuilder[];
          components: ActionRowBuilder<ButtonBuilder>[];
        }
      | Promise<{
          embeds: EmbedBuilder[];
          components: ActionRowBuilder<ButtonBuilder>[];
        }>;
  },
): Promise<void> {
  if (options.totalPages <= 1) return;

  let page = 0;
  const collector = replyMessage.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: 120_000,
    filter: (interaction) => interaction.user.id === options.userId,
  });

  collector.on("collect", async (interaction) => {
    page += interaction.customId === "lb_prev" ? -1 : 1;
    page = Math.min(Math.max(page, 0), options.totalPages - 1);
    await interaction.update(await options.fetchPage(page));
  });

  collector.on("end", async () => {
    try {
      const payload = await options.fetchPage(page);
      const row = payload.components[0];
      await replyMessage.edit({
        components: row
          ? [
              new ActionRowBuilder<ButtonBuilder>().addComponents(
                ButtonBuilder.from(row.components[0]).setDisabled(true),
                ButtonBuilder.from(row.components[1]).setDisabled(true),
              ),
            ]
          : [],
      });
    } catch {}
  });
}
