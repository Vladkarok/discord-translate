/**
 * Translate message-context handler — M2 wires access control on top of
 * the M1 placeholder. Provider call still lands in M3.
 *
 * Defer-first rule (plan §Interaction Flow): the first action is always
 * deferReply ephemeral. Access checks, DB reads, and (M3) provider calls
 * all happen *after* the 3-second ack deadline is safely satisfied.
 */
import { MessageFlags, type MessageContextMenuCommandInteraction } from 'discord.js';
import { denialMessage, resolveAccess } from '../access.js';
import type { Config } from '../config.js';
import type { UsersRepository } from '../db/users.js';
import { log } from '../logger.js';

export const handleTranslate = async (
  interaction: MessageContextMenuCommandInteraction,
  config: Config,
  users: UsersRepository,
): Promise<void> => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const access = resolveAccess(interaction.user.id, interaction.context, users, config);
  if (!access.allowed) {
    log('warn', 'translate.denied', {
      userId: interaction.user.id,
      context: interaction.context,
      reason: access.reason,
    });
    await interaction.editReply({ content: denialMessage(access.reason) });
    return;
  }

  const target = interaction.targetMessage;
  const charCount = target.content.length;

  // Privacy: log character count and context metadata, never message body.
  log('info', 'translate.invoked', {
    userId: interaction.user.id,
    role: access.role,
    targetMessageId: target.id,
    charCount,
    context: interaction.context,
    locale: interaction.locale,
  });

  await interaction.editReply({
    content: [
      'Translation coming soon.',
      `(M2 placeholder — access OK as **${access.role}**, ${String(charCount)} chars received.)`,
    ].join('\n'),
  });
};
