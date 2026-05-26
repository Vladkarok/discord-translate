/**
 * `/friends add | remove | list` — owner-only.
 *
 * Input validation: Discord user IDs are 17–19 digit snowflakes. We
 * reject anything else before touching SQLite — prevents accidental
 * insertion of mention strings like `<@123>` that a user might paste.
 */
import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { isOwner } from '../access.js';
import type { Config } from '../config.js';
import type { UsersRepository } from '../db/users.js';
import { log } from '../logger.js';

const SNOWFLAKE_RE = /^\d{17,20}$/;

export const handleFriends = async (
  interaction: ChatInputCommandInteraction,
  config: Config,
  users: UsersRepository,
): Promise<void> => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  if (!isOwner(interaction.user.id, config)) {
    log('warn', 'friends.denied', { userId: interaction.user.id });
    await interaction.editReply({ content: 'This command is owner-only.' });
    return;
  }

  const sub = interaction.options.getSubcommand();

  if (sub === 'list') {
    await replyList(interaction, users);
    return;
  }

  const userId = interaction.options.getString('user_id', true).trim();
  if (!SNOWFLAKE_RE.test(userId)) {
    await interaction.editReply({
      content: 'That does not look like a Discord user ID (expected 17–20 digits).',
    });
    return;
  }

  if (sub === 'add') {
    if (userId === config.OWNER_DISCORD_ID) {
      await interaction.editReply({ content: 'Owner is always allowed — no need to allowlist.' });
      return;
    }
    const added = users.addFriend(userId);
    log('info', 'friends.add', { userId, added });
    await interaction.editReply({
      content: added
        ? `Added \`${userId}\` to the allowlist.`
        : `\`${userId}\` is already on the allowlist.`,
    });
    return;
  }

  if (sub === 'remove') {
    const removed = users.removeFriend(userId);
    log('info', 'friends.remove', { userId, removed });
    await interaction.editReply({
      content: removed
        ? `Removed \`${userId}\` from the allowlist.`
        : `\`${userId}\` was not on the allowlist.`,
    });
    return;
  }

  await interaction.editReply({ content: `Unknown subcommand: ${sub}` });
};

const replyList = async (
  interaction: ChatInputCommandInteraction,
  users: UsersRepository,
): Promise<void> => {
  const friends = users.listFriends();
  if (friends.length === 0) {
    await interaction.editReply({ content: 'No friends on the allowlist yet.' });
    return;
  }
  const lines = friends.map(
    (f) =>
      `- \`${f.discord_user_id}\` — server use: ${f.server_usage_enabled === 1 ? '**on**' : 'off'}` +
      (f.target_language ? ` · target: \`${f.target_language}\`` : ''),
  );
  await interaction.editReply({
    content: [`**Allowlist (${String(friends.length)})**`, ...lines].join('\n'),
  });
};
