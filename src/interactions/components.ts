/**
 * Component builders for the interactive translation panel.
 *
 * Layout (3 of Discord's 5 allowed action rows):
 *   row 1: Source select  (Auto, English, French, Ukrainian)
 *   row 2: Target select  (English, French, Ukrainian)
 *   row 3: [ Swap ]  [ Save target ]
 *
 * custom_id format: `dt:<action>:<sessionId>` — well under the 100-char
 * cap (action ≤ 3, sessionId = 36-char UUID).
 */
import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  type MessageActionRowComponentBuilder,
} from 'discord.js';

export const CUSTOM_ID = {
  source: 'dt:src:',
  target: 'dt:tgt:',
  swap: 'dt:sw:',
  save: 'dt:sv:',
} as const;

export const SUPPORTED_LANGS = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'uk', label: 'Ukrainian' },
] as const;

const SOURCE_OPTIONS = [{ value: 'auto', label: 'Auto-detect' }, ...SUPPORTED_LANGS];

export const isValidLang = (v: string): boolean => SUPPORTED_LANGS.some((l) => l.value === v);

export const isValidSource = (v: string): boolean => v === 'auto' || isValidLang(v);

export const buildPanel = (params: {
  readonly sessionId: string;
  readonly currentSource: string;
  readonly currentTarget: string;
  readonly canSwap: boolean;
}): readonly ActionRowBuilder<MessageActionRowComponentBuilder>[] => {
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

  return [
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(sourceSelect),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(targetSelect),
    new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(swapBtn, saveBtn),
  ];
};

export const parseCustomId = (
  customId: string,
): { readonly action: 'src' | 'tgt' | 'sw' | 'sv'; readonly sessionId: string } | null => {
  const m = /^dt:(src|tgt|sw|sv):([\w-]{36})$/.exec(customId);
  if (!m) return null;
  return {
    action: m[1] as 'src' | 'tgt' | 'sw' | 'sv',
    sessionId: m[2]!,
  };
};
