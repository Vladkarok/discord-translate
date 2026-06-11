/**
 * Component builders for the interactive translation panel.
 *
 * Two layouts:
 *   Collapsed (default after Translate):
 *     row 1: [ ⚙ Change language ]
 *   Expanded (after user clicks the toggle):
 *     row 1: Source select  (Auto, English, French, Ukrainian, Russian)
 *     row 2: Target select  (English, French, Ukrainian, Russian)
 *     row 3: [ Swap ]  [ Save target ]  [ Hide ]
 *
 * Toggling does NOT re-translate — it only repaints the components.
 *
 * custom_id format: `dt:<action>:<sessionId>` — well under the 100-char
 * cap (action ≤ 4, sessionId = 36-char UUID).
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';
import { SUPPORTED_LANGS } from '../languages.js';

export const CUSTOM_ID = {
  source: 'dt:src:',
  target: 'dt:tgt:',
  swap: 'dt:sw:',
  save: 'dt:sv:',
  show: 'dt:show:',
  hide: 'dt:hide:',
} as const;

export type PanelAction = 'src' | 'tgt' | 'sw' | 'sv' | 'show' | 'hide';

const SOURCE_OPTIONS = [{ value: 'auto', label: 'Auto-detect' }, ...SUPPORTED_LANGS];

export const buildPanel = (params: {
  readonly sessionId: string;
  readonly currentSource: string;
  readonly currentTarget: string;
  readonly canSwap: boolean;
  readonly expanded: boolean;
}): readonly ActionRowBuilder<MessageActionRowComponentBuilder>[] => {
  if (!params.expanded) {
    const showBtn = new ButtonBuilder()
      .setCustomId(CUSTOM_ID.show + params.sessionId)
      .setLabel('⚙ Change language')
      .setStyle(ButtonStyle.Secondary);
    return [new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(showBtn)];
  }

  const sourceSelect = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.source + params.sessionId)
    .setPlaceholder('Source language')
    .addOptions(
      SOURCE_OPTIONS.map((opt) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(opt.label)
          .setValue(opt.value)
          .setDefault(opt.value === params.currentSource),
      ),
    );

  const targetSelect = new StringSelectMenuBuilder()
    .setCustomId(CUSTOM_ID.target + params.sessionId)
    .setPlaceholder('Target language')
    .addOptions(
      SUPPORTED_LANGS.map((opt) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(opt.label)
          .setValue(opt.value)
          .setDefault(opt.value === params.currentTarget),
      ),
    );

  const swapBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.swap + params.sessionId)
    .setLabel('Swap')
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(!params.canSwap);

  const saveBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.save + params.sessionId)
    .setLabel('Save target')
    .setStyle(ButtonStyle.Primary);

  const hideBtn = new ButtonBuilder()
    .setCustomId(CUSTOM_ID.hide + params.sessionId)
    .setLabel('Hide')
    .setStyle(ButtonStyle.Secondary);

  return [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(sourceSelect),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(targetSelect),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
      swapBtn,
      saveBtn,
      hideBtn,
    ),
  ];
};

export const parseCustomId = (
  customId: string,
): { readonly action: PanelAction; readonly sessionId: string } | null => {
  const m = /^dt:(src|tgt|sw|sv|show|hide):([\w-]{36})$/.exec(customId);
  if (!m) return null;
  return {
    action: m[1] as PanelAction,
    sessionId: m[2]!,
  };
};
