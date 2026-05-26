/**
 * `/settings show` — owner-only. M2 surfaces real friend count from the
 * DB; per-user preferences land in M4 (Save target) and beyond.
 */
import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { isOwner } from '../access.js';
import type { Config } from '../config.js';
import type { UsersRepository } from '../db/users.js';
import { log } from '../logger.js';

export const handleSettingsShow = async (
  interaction: ChatInputCommandInteraction,
  config: Config,
  users: UsersRepository,
): Promise<void> => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!isOwner(interaction.user.id, config)) {
    log('warn', 'settings.denied', { userId: interaction.user.id });
    await interaction.editReply({ content: 'This command is owner-only.' });
    return;
  }

  await interaction.editReply({
    content: [
      '**Settings**',
      `- default target language: \`${config.DEFAULT_TARGET_LANGUAGE}\``,
      `- DeepL monthly limit: \`${String(config.DEEPL_MONTHLY_CHAR_LIMIT)}\` chars`,
      `- cache stores source text: \`${String(config.CACHE_STORE_SOURCE_TEXT)}\``,
      `- friends allowlisted: \`${String(users.count())}\``,
    ].join('\n'),
  });
};
