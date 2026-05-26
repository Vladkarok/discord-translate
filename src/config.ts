/**
 * Environment configuration. Parsed once at startup with Zod. Failing
 * fast at boot is preferable to surfacing missing-env errors during an
 * interaction.
 */
import { z } from 'zod';

const boolFromString = z.enum(['true', 'false']).transform((v) => v === 'true');

const envSchema = z.object({
  // Discord
  DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN is required'),
  DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID is required'),
  DISCORD_PUBLIC_KEY: z.string().optional(),
  OWNER_DISCORD_ID: z.string().min(1, 'OWNER_DISCORD_ID is required'),

  // DeepL — required from M3 onward. Optional at M1.
  DEEPL_API_KEY: z.string().optional(),
  DEEPL_API_URL: z.string().url().default('https://api-free.deepl.com'),
  DEEPL_MONTHLY_CHAR_LIMIT: z.coerce.number().int().positive().default(500_000),
  DEFAULT_ENGLISH_VARIANT: z.enum(['EN-US', 'EN-GB']).default('EN-US'),

  // Cache / behaviour. Defaults are post-transform booleans; Zod v4
  // applies them when the env var is unset.
  CACHE_STORE_SOURCE_TEXT: boolFromString.default(false),
  ALLOW_PAID_OVERFLOW: boolFromString.default(false),
  DEFAULT_TARGET_LANGUAGE: z.string().min(2).default('en'),
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
