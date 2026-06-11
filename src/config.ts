/**
 * Environment configuration. Parsed once at startup with Zod. Failing
 * fast at boot is preferable to surfacing missing-env errors during an
 * interaction.
 */
import { z } from 'zod';
import { SUPPORTED_LANG_CODES, isValidLang } from './languages.js';

const boolFromString = z.enum(['true', 'false']).transform((v) => v === 'true');

const envSchema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_PUBLIC_KEY: z.string().optional(),
  OWNER_DISCORD_ID: z.string().min(1, 'OWNER_DISCORD_ID is required'),

  // Translation provider — Google Cloud Translation v2 (API key auth).
  // DeepL was the original v1 provider; pivoted to Google after DeepL
  // Free API plan closed signups. DeepL vars stay parseable but unused
  // so an existing-key user can wire them up later.
  GOOGLE_TRANSLATE_API_KEY: z.string().min(1, 'GOOGLE_TRANSLATE_API_KEY is required'),
  GOOGLE_MONTHLY_CHAR_LIMIT: z.coerce.number().int().positive().default(500_000),
  DEEPL_API_KEY: z.string().optional(),
  DEEPL_API_URL: z.string().url().optional(),
  DEEPL_MONTHLY_CHAR_LIMIT: z.coerce.number().int().positive().optional(),

  // Cache / behaviour. Defaults are post-transform booleans; Zod v4
  // applies them when the env var is unset.
  CACHE_STORE_SOURCE_TEXT: boolFromString.default(false),
  ALLOW_PAID_OVERFLOW: boolFromString.default(false),
  DEFAULT_TARGET_LANGUAGE: z
    .string()
    .default('en')
    .refine(isValidLang, {
      message: `must be one of: ${SUPPORTED_LANG_CODES.join(', ')}`,
    }),
  DATABASE_PATH: z.string().min(1).default('/data/bot.sqlite'),
  LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),

  // Registration
  SKIP_COMMAND_REGISTRATION: boolFromString.default(false),
});

export type Config = z.infer<typeof envSchema>;

export const loadConfig = (): Config => {
  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const issues = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment: ${issues}`);
  }
  return result.data;
};
