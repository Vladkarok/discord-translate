/**
 * Component handlers for the translation panel:
 *   - Source select → re-translate with new source
 *   - Target select → re-translate with new target
 *   - Swap         → swap effective source/target, re-translate
 *   - Save target  → persist current target as user default
 *
 * Every handler verifies the interaction user matches the session
 * owner. Foreign clicks get a private "not your controls" reply
 * without spending any quota.
 */
import {
  MessageFlags,
  type ButtonInteraction,
  type MessageComponentInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { Config } from '../config.js';
import type { OwnerPrefsRepository } from '../db/owner-prefs.js';
import type { UsersRepository } from '../db/users.js';
import { isOwner } from '../access.js';
import { log } from '../logger.js';
import type { TranslateService, TranslateSuccess } from '../services/translate.js';
import { renderTranslation } from '../text/render.js';
import type { SessionStore, TranslationSession } from '../sessions/store.js';
import { buildPanel, isValidLang, isValidSource, parseCustomId } from './components.js';

export interface PanelDeps {
  readonly config: Config;
  readonly users: UsersRepository;
  readonly ownerPrefs: OwnerPrefsRepository;
  readonly translateService: TranslateService;
  readonly sessions: SessionStore;
}

export const handleTranslatePanel = async (
  interaction: MessageComponentInteraction,
  deps: PanelDeps,
): Promise<void> => {
  const parsed = parseCustomId(interaction.customId);
  if (!parsed) return; // not ours

  const session = deps.sessions.get(parsed.sessionId);
  if (!session) {
    await interaction.reply({
      content:
        'This translation session has expired. Right-click the message and run **Translate** again.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (interaction.user.id !== session.userId) {
    log('warn', 'panel.foreign_user', {
      sessionUserId: session.userId,
      clickedBy: interaction.user.id,
    });
    await interaction.reply({
      content: 'These controls belong to someone else.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  switch (parsed.action) {
    case 'src':
      await handleSourceSelect(
        interaction as StringSelectMenuInteraction,
        parsed.sessionId,
        session,
        deps,
      );
      return;
    case 'tgt':
      await handleTargetSelect(
        interaction as StringSelectMenuInteraction,
        parsed.sessionId,
        session,
        deps,
      );
      return;
    case 'sw':
      await handleSwap(interaction as ButtonInteraction, parsed.sessionId, session, deps);
      return;
    case 'sv':
      await handleSave(interaction as ButtonInteraction, parsed.sessionId, session, deps);
      return;
    case 'show':
    case 'hide':
      await handleToggle(
        interaction as ButtonInteraction,
        parsed.sessionId,
        session,
        deps,
        parsed.action === 'show',
      );
      return;
  }
};

/**
 * Toggle the panel between collapsed (just the ⚙ button) and
 * expanded (Source/Target/Swap/Save). No re-translation, no quota
 * spend — just a component repaint.
 */
const handleToggle = async (
  interaction: ButtonInteraction,
  sessionId: string,
  session: TranslationSession,
  deps: PanelDeps,
  expand: boolean,
): Promise<void> => {
  await interaction.deferUpdate();
  const updated = deps.sessions.update(sessionId, { panelExpanded: expand });
  if (!updated) {
    await interaction.editReply({
      content: 'Session expired mid-action. Right-click the message and run **Translate** again.',
      components: [],
    });
    return;
  }
  await interaction.editReply({
    components: buildPanel({
      sessionId,
      currentSource: updated.currentSource,
      currentTarget: updated.currentTarget,
      canSwap: canSwap(updated),
      expanded: updated.panelExpanded,
    }),
  });
};

const handleSourceSelect = async (
  interaction: StringSelectMenuInteraction,
  sessionId: string,
  session: TranslationSession,
  deps: PanelDeps,
): Promise<void> => {
  const chosen = interaction.values[0];
  if (!chosen || !isValidSource(chosen)) {
    await interaction.deferUpdate();
    return;
  }
  await interaction.deferUpdate();
  await rerunAndPaint(sessionId, { ...session, currentSource: chosen }, deps, interaction);
};

const handleTargetSelect = async (
  interaction: StringSelectMenuInteraction,
  sessionId: string,
  session: TranslationSession,
  deps: PanelDeps,
): Promise<void> => {
  const chosen = interaction.values[0];
  if (!chosen || !isValidLang(chosen)) {
    await interaction.deferUpdate();
    return;
  }
  await interaction.deferUpdate();
  await rerunAndPaint(sessionId, { ...session, currentTarget: chosen }, deps, interaction);
};

const handleSwap = async (
  interaction: ButtonInteraction,
  sessionId: string,
  session: TranslationSession,
  deps: PanelDeps,
): Promise<void> => {
  // Swap is disabled in the UI when this would be invalid; defend in code anyway.
  const effectiveSource =
    session.currentSource === 'auto' ? session.lastDetectedSource : session.currentSource;
  if (!effectiveSource || !isValidLang(effectiveSource)) {
    await interaction.deferUpdate();
    return;
  }
  const swapped: TranslationSession = {
    ...session,
    currentSource: session.currentTarget,
    currentTarget: effectiveSource,
  };
  await interaction.deferUpdate();
  await rerunAndPaint(sessionId, swapped, deps, interaction);
};

const handleSave = async (
  interaction: ButtonInteraction,
  _sessionId: string,
  session: TranslationSession,
  deps: PanelDeps,
): Promise<void> => {
  await interaction.deferUpdate();
  const target = session.currentTarget;
  if (!isValidLang(target)) return;

  if (isOwner(interaction.user.id, deps.config)) {
    deps.ownerPrefs.setTargetLanguage(target);
  } else {
    deps.users.setTargetLanguage(interaction.user.id, target);
  }
  log('info', 'panel.saved_target', { userId: interaction.user.id, target });

  // Don't re-translate, just append a confirmation to the existing message.
  const existing = interaction.message.content;
  const note = `\n\n_Default target saved: **${target.toUpperCase()}**_`;
  // Avoid double-appending if user mashes Save: only append once.
  const next = existing.includes('Default target saved') ? existing : existing + note;
  await interaction.editReply({
    content: next.slice(0, 2000),
    components: [...interaction.message.components],
  });
};

/**
 * Re-run the orchestrator with the updated session, update the session
 * store, and edit the ephemeral message with the new render + panel.
 */
const rerunAndPaint = async (
  sessionId: string,
  next: TranslationSession,
  deps: PanelDeps,
  interaction: MessageComponentInteraction,
): Promise<void> => {
  const outcome = await deps.translateService(
    next.currentSource === 'auto'
      ? { text: next.originalText, targetLanguage: next.currentTarget }
      : {
          text: next.originalText,
          sourceLanguage: next.currentSource,
          targetLanguage: next.currentTarget,
        },
  );

  if (!outcome.ok) {
    log('warn', 'panel.translate_failed', { kind: outcome.kind });
    await interaction.editReply({
      content: outcome.message,
      components: buildPanel({
        sessionId,
        currentSource: next.currentSource,
        currentTarget: next.currentTarget,
        canSwap: canSwap(next),
        expanded: next.panelExpanded,
      }),
    });
    return;
  }

  // Update the session with the (possibly new) detected source.
  const updated = deps.sessions.update(sessionId, {
    currentSource: next.currentSource,
    currentTarget: next.currentTarget,
    lastDetectedSource: outcome.sourceLanguage,
  });
  if (!updated) {
    // Race with sweep — session expired between get and update.
    await interaction.editReply({
      content: 'Session expired mid-action. Right-click the message and run **Translate** again.',
      components: [],
    });
    return;
  }

  const payload = renderTranslation(outcome);
  await interaction.editReply({
    content: payload.content,
    embeds: payload.embeds ?? [],
    components: buildPanel({
      sessionId,
      currentSource: updated.currentSource,
      currentTarget: updated.currentTarget,
      canSwap: canSwap(updated),
      expanded: updated.panelExpanded,
    }),
  });
};

const canSwap = (s: TranslationSession): boolean => {
  if (s.currentSource === 'auto') {
    return s.lastDetectedSource !== null && isValidLang(s.lastDetectedSource);
  }
  return isValidLang(s.currentSource);
};

export const initialPanelFor = (params: {
  readonly sessionId: string;
  readonly outcome: TranslateSuccess;
  readonly currentSource: string;
  readonly currentTarget: string;
}): ReturnType<typeof buildPanel> =>
  buildPanel({
    sessionId: params.sessionId,
    currentSource: params.currentSource,
    currentTarget: params.currentTarget,
    canSwap: canSwap({
      userId: '',
      originalText: '',
      currentSource: params.currentSource,
      currentTarget: params.currentTarget,
      lastDetectedSource: params.outcome.sourceLanguage,
      panelExpanded: false,
      createdAt: 0,
      expiresAt: 0,
    }),
    expanded: false, // Panel starts collapsed; user opens it via the ⚙ toggle.
  });
