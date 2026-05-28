/**
 * Translate message-context handler.
 *
 * M4 changes:
 *   - Resolves the initial target language from the user's saved
 *     preference (owner_prefs for owner, users.target_language for
 *     friends), then Discord locale, then config default.
 *   - After a successful translation, creates a session and attaches
 *     the interactive panel (Source / Target / Swap / Save).
 */
import { MessageFlags, type MessageContextMenuCommandInteraction } from 'discord.js';
import { denialMessage, isOwner, resolveAccess } from '../access.js';
import type { Config } from '../config.js';
import type { OwnerPrefsRepository } from '../db/owner-prefs.js';
import type { UsersRepository } from '../db/users.js';
import { log } from '../logger.js';
import type { TranslateService } from '../services/translate.js';
import { renderTranslation } from '../text/render.js';
import type { SessionStore } from '../sessions/store.js';
import { initialPanelFor } from './translate-panel.js';

const LOCALE_TO_ISO: Readonly<Record<string, string>> = {
  'en-US': 'en',
  'en-GB': 'en',
  fr: 'fr',
  uk: 'uk',
  ru: 'ru',
};

export interface TranslateHandlerDeps {
  readonly config: Config;
  readonly users: UsersRepository;
  readonly ownerPrefs: OwnerPrefsRepository;
  readonly translateService: TranslateService;
  readonly sessions: SessionStore;
}

const resolveInitialTarget = (
  interaction: MessageContextMenuCommandInteraction,
  deps: TranslateHandlerDeps,
): string => {
  // 1. Saved user preference
  if (isOwner(interaction.user.id, deps.config)) {
    const saved = deps.ownerPrefs.get().target_language;
    if (saved) return saved;
  } else {
    const saved = deps.users.getFriend(interaction.user.id)?.target_language;
    if (saved) return saved;
  }
  // 2. Discord locale
  const locale = interaction.locale;
  if (locale in LOCALE_TO_ISO) {
    return LOCALE_TO_ISO[locale]!;
  }
  // 3. Config default
  return deps.config.DEFAULT_TARGET_LANGUAGE;
};

export const handleTranslate = async (
  interaction: MessageContextMenuCommandInteraction,
  deps: TranslateHandlerDeps,
): Promise<void> => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const access = resolveAccess(interaction.user.id, interaction.context, deps.users, deps.config);
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
  const targetLang = resolveInitialTarget(interaction, deps);

  log('info', 'translate.invoked', {
    userId: interaction.user.id,
    role: access.role,
    targetMessageId: target.id,
    charCount: target.content.length,
    targetLang,
    context: interaction.context,
  });

  const outcome = await deps.translateService({
    text: target.content,
    sourceLanguage: 'auto',
    targetLanguage: targetLang,
  });

  if (!outcome.ok) {
    log('warn', 'translate.failed', { kind: outcome.kind });
    await interaction.editReply({ content: outcome.message });
    return;
  }

  log('info', 'translate.success', {
    provider: outcome.provider,
    source: outcome.sourceLanguage,
    target: outcome.targetLanguage,
    billed: outcome.billedCharacters,
  });

  const { id: sessionId } = deps.sessions.create({
    userId: interaction.user.id,
    originalText: target.content,
    currentSource: 'auto',
    currentTarget: targetLang,
    lastDetectedSource: outcome.sourceLanguage,
    panelExpanded: false,
  });

  const payload = renderTranslation(outcome);
  await interaction.editReply({
    content: payload.content,
    embeds: payload.embeds ?? [],
    components: initialPanelFor({
      sessionId,
      outcome,
      currentSource: 'auto',
      currentTarget: targetLang,
    }),
  });
};
