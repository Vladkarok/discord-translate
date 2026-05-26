/**
 * `/access server enable | disable <user_id>` — owner-only.
 *
 * Toggles `users.server_usage_enabled`. Friend must already be
 * allowlisted via `/friends add`; this command refuses to silently
 * create them.
 */
import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { isOwner } from '../access.js';
import type { Config } from '../config.js';
import type { UsersRepository } from '../db/users.js';
import { log } from '../logger.js';

const SNOWFLAKE_RE = /^\d{17,20}$/;

export const handleAccess = async (
  interaction: ChatInputCommandInteraction,
  config: Config,
  users: UsersRepository,
): Promise<void> => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!isOwner(interaction.user.id, config)) {
    log('warn', 'access.denied', { userId: interaction.user.id });
    await interaction.editReply({ content: 'This command is owner-only.' });
    return;
  }

  const group = interaction.options.getSubcommandGroup(true);
  const sub = interaction.options.getSubcommand(true);
  const userId = interaction.options.getString('user_id', true).trim();

  if (!SNOWFLAKE_RE.test(userId)) {
    await interaction.editReply({
      content: 'That does not look like a Discord user ID (expected 17–20 digits).',
    });
    return;
  }

  if (group !== 'server') {
    await interaction.editReply({ content: `Unknown access group: ${group}` });
    return;
  }

  if (!users.isFriend(userId)) {
    await interaction.editReply({
      content: `\`${userId}\` is not on the allowlist. Use \`/friends add\` first.`,
    });
    return;
  }

  const enable = sub === 'enable';
  users.setServerUsage(userId, enable);
  log('info', 'access.server_set', { userId, enabled: enable });
  await interaction.editReply({
    content: enable
      ? `Server use **enabled** for \`${userId}\`.`
      : `Server use **disabled** for \`${userId}\`.`,
  });
};
