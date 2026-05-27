/**
 * Single InteractionCreate dispatcher.
 *
 * Recovery rule: if a handler throws after deferReply, we still try to
 * surface a private error so the user does not stare at a spinning
 * "thinking..." indicator forever.
 */
import { MessageFlags, type Interaction } from 'discord.js';
import type { Config } from '../config.js';
import type { OwnerPrefsRepository } from '../db/owner-prefs.js';
import type { ProviderUsageRepository } from '../db/provider-usage.js';
import type { TranslationCacheRepository } from '../db/cache.js';
import type { UsersRepository } from '../db/users.js';
import type { TranslateService } from '../services/translate.js';
import type { SessionStore } from '../sessions/store.js';
import { log } from '../logger.js';
import {
  ACCESS_COMMAND_NAME,
  FRIENDS_COMMAND_NAME,
  QUOTA_COMMAND_NAME,
  SETTINGS_COMMAND_NAME,
  TRANSLATE_COMMAND_NAME,
} from '../commands/definitions.js';
import { handleAccess } from './access.js';
import { handleFriends } from './friends.js';
import { handleQuotaStatus } from './quota.js';
import { handleSettingsShow } from './settings.js';
import { handleTranslate } from './translate.js';
import { handleTranslatePanel } from './translate-panel.js';

export interface RouterDeps {
  readonly config: Config;
  readonly users: UsersRepository;
  readonly ownerPrefs: OwnerPrefsRepository;
  readonly usage: ProviderUsageRepository;
  readonly cache: TranslationCacheRepository;
  readonly translateService: TranslateService;
  readonly sessions: SessionStore;
}

export const buildInteractionRouter =
  (deps: RouterDeps) =>
  async (interaction: Interaction): Promise<void> => {
    try {
      if (
        interaction.isMessageContextMenuCommand() &&
        interaction.commandName === TRANSLATE_COMMAND_NAME
      ) {
        await handleTranslate(interaction, deps);
        return;
      }

      if (interaction.isChatInputCommand()) {
        switch (interaction.commandName) {
          case SETTINGS_COMMAND_NAME:
            await handleSettingsShow(interaction, deps.config, deps.users);
            return;
          case FRIENDS_COMMAND_NAME:
            await handleFriends(interaction, deps.config, deps.users);
            return;
          case ACCESS_COMMAND_NAME:
            await handleAccess(interaction, deps.config, deps.users);
            return;
          case QUOTA_COMMAND_NAME:
            await handleQuotaStatus(interaction, deps.config, deps.users, deps.usage, deps.cache);
            return;
        }
      }

      if (interaction.isMessageComponent()) {
        if (interaction.customId.startsWith('dt:')) {
          await handleTranslatePanel(interaction, deps);
          return;
        }
      }

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
    // Discord may have already invalidated the interaction; nothing to recover here.
  }
};
