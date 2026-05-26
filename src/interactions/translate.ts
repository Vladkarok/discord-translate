/**
 * Translate message-context handler — M1 placeholder.
 *
 * Critical rule (plan: Interaction Flow §1):
 *   First action MUST be deferReply ephemeral. The 3-second Discord ack
 *   deadline runs even before allowlist/DB/provider work in M2+, so
 *   defer-first is enforced from M1.
 *
 * The character count is reported to verify the interaction payload
 * actually carries the target message (Platform Assumption: "The app
 * receives enough message text from the interaction for translation").
 */
import { MessageFlags, type MessageContextMenuCommandInteraction } from 'discord.js';
import { log } from '../logger.js';

export const handleTranslate = async (
  interaction: MessageContextMenuCommandInteraction,
): Promise<void> => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const target = interaction.targetMessage;
  const charCount = target.content.length;

  // Privacy: log character count and context metadata, never message body.
  log('info', 'translate.invoked', {
    userId: interaction.user.id,
    targetMessageId: target.id,
    charCount,
    context: interaction.context,
    locale: interaction.locale,
  });

  await interaction.editReply({
    content: [
      'Translation coming soon.',
      `(M1 placeholder — payload OK: ${String(charCount)} chars received.)`,
    ].join('\n'),
  });
};
