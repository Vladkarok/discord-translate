/**
 * Supported languages — single source of truth.
 *
 * Everything that needs the language list (config validation, provider
 * support checks, panel select options, saved-preference guards) derives
 * from SUPPORTED_LANGS so adding a language is a one-line change.
 */

export const SUPPORTED_LANGS = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'uk', label: 'Ukrainian' },
  { value: 'ru', label: 'Russian' },
] as const;

export type SupportedLang = (typeof SUPPORTED_LANGS)[number]['value'];

export const SUPPORTED_LANG_CODES: readonly string[] = SUPPORTED_LANGS.map((l) => l.value);

export const isValidLang = (v: string): boolean => SUPPORTED_LANGS.some((l) => l.value === v);

export const isValidSource = (v: string): boolean => v === 'auto' || isValidLang(v);
