/**
 * `/settings show` — owner-only placeholder. M2 will hydrate real
 * values from SQLite.
 */
import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { isOwner } from '../access.js';
import type { Config } from '../config.js';
import { log } from '../logger.js';

export const handleSettingsShow = async (
  interaction: ChatInputCommandInteraction,
  config: Config,
): Promise<void> => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!isOwner(interaction.user.id, config)) {
    log('warn', 'settings.denied', { userId: interaction.user.id });
    await interaction.editReply({ content: 'This command is owner-only.' });
    return;
  }

  await interaction.editReply({
    content: [
      '**Settings** (M1 placeholder — real values land in M2)',
      `- default target language: \`${config.DEFAULT_TARGET_LANGUAGE}\``,
      `- DeepL monthly limit: \`${String(config.DEEPL_MONTHLY_CHAR_LIMIT)}\` chars`,
      `- cache stores source text: \`${String(config.CACHE_STORE_SOURCE_TEXT)}\``,
      `- friends allowlisted: \`0\` (M2)`,
    ].join('\n'),
  });
};
