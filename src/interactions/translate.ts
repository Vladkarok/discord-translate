/**
 * Translate message-context handler — M3: real Google translation.
 *
 * Defer-first → access check → resolve target language → run orchestrator
 * → render. The orchestrator owns quota, placeholder safety, provider
 * call, and refund semantics.
 *
 * Target language resolution (interactive override lands in M4):
 *   1. Discord interaction locale → ISO code, if mappable.
 *   2. Config DEFAULT_TARGET_LANGUAGE.
 */
import { MessageFlags, type MessageContextMenuCommandInteraction } from 'discord.js';
import { denialMessage, resolveAccess } from '../access.js';
import type { Config } from '../config.js';
import type { UsersRepository } from '../db/users.js';
import { log } from '../logger.js';
import type { TranslateService } from '../services/translate.js';
import { renderTranslation } from '../text/render.js';

const LOCALE_TO_ISO: Readonly<Record<string, string>> = {
  'en-US': 'en',
  'en-GB': 'en',
  fr: 'fr',
  uk: 'uk',
};

const resolveTargetLanguage = (locale: string | null, config: Config): string => {
  if (locale && locale in LOCALE_TO_ISO) {
    return LOCALE_TO_ISO[locale]!;
  }
  return config.DEFAULT_TARGET_LANGUAGE;
};

export const handleTranslate = async (
  interaction: MessageContextMenuCommandInteraction,
  config: Config,
  users: UsersRepository,
  translateService: TranslateService,
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
  const targetLang = resolveTargetLanguage(interaction.locale, config);

  log('info', 'translate.invoked', {
    userId: interaction.user.id,
    role: access.role,
    targetMessageId: target.id,
    charCount: target.content.length,
    targetLang,
    context: interaction.context,
  });

  const outcome = await translateService({
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

  await interaction.editReply({ content: renderTranslation(outcome) });
};
