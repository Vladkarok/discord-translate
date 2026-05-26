/**
 * Single InteractionCreate dispatcher. Keeps the wiring in one place so
 * adding M4's component handlers later is one more `else if` branch.
 *
 * Recovery rule: if an interaction handler throws after deferReply, we
 * still try to surface a private error so the user does not stare at a
 * spinning "thinking..." indicator forever.
 */
import { MessageFlags, type Interaction } from 'discord.js';
import type { Config } from '../config.js';
import { log } from '../logger.js';
import { SETTINGS_COMMAND_NAME, TRANSLATE_COMMAND_NAME } from '../commands/definitions.js';
import { handleTranslate } from './translate.js';
import { handleSettingsShow } from './settings.js';

export const buildInteractionRouter =
  (config: Config) =>
  async (interaction: Interaction): Promise<void> => {
    try {
      if (
        interaction.isMessageContextMenuCommand() &&
        interaction.commandName === TRANSLATE_COMMAND_NAME
      ) {
        await handleTranslate(interaction);
        return;
      }

      if (interaction.isChatInputCommand() && interaction.commandName === SETTINGS_COMMAND_NAME) {
        // M1 only ships `/settings show`. M2 adds /settings target-language.
        await handleSettingsShow(interaction, config);
        return;
      }

      // Unknown command — log and ignore. Discord shows a generic
      // "interaction failed" if we never respond, which is acceptable
      // for unrecognized commands.
      if (interaction.isCommand()) {
        log('warn', 'interaction.unknown_command', {
          commandName: interaction.commandName,
          type: interaction.commandType,
        });
      }
    } catch (err: unknown) {
      log('error', 'interaction.handler_failed', {
        err: err instanceof Error ? err.message : String(err),
        userId: interaction.isRepliable() ? interaction.user.id : undefined,
      });
      await tryReportError(interaction);
    }
  };

const tryReportError = async (interaction: Interaction): Promise<void> => {
  if (!interaction.isRepliable()) return;
  const body = { content: 'Something went wrong. Please try again.' };
  try {
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(body);
    } else {
      await interaction.reply({ ...body, flags: MessageFlags.Ephemeral });
    }
  } catch {
    // Discord may have already invalidated the interaction; nothing to
    // recover here.
  }
};
