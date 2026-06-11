/**
 * `/quota status` — visible to owner and allowlisted friends.
 *
 * Surfaces the shared monthly quota (we dropped per-user tracking when
 * we removed the default daily cap). Friend and owner see the same
 * aggregate — there is no private per-user data to hide here.
 */
import { MessageFlags, type ChatInputCommandInteraction } from 'discord.js';
import { denialMessage, resolveAccess } from '../access.js';
import type { Config } from '../config.js';
import type { ProviderUsageRepository } from '../db/provider-usage.js';
import type { TranslationCacheRepository } from '../db/cache.js';
import type { UsersRepository } from '../db/users.js';
import { log } from '../logger.js';

const GOOGLE = 'google';

export const handleQuotaStatus = async (
  interaction: ChatInputCommandInteraction,
  config: Config,
  users: UsersRepository,
  usage: ProviderUsageRepository,
  cache: TranslationCacheRepository,
): Promise<void> => {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  // Pass context as-is: resolveAccess fails closed on null/unknown,
  // matching every other handler. No DM fallback.
  const access = resolveAccess(interaction.user.id, interaction.context, users, config);
  if (!access.allowed) {
    log('warn', 'quota.denied', { userId: interaction.user.id, reason: access.reason });
    await interaction.editReply({ content: denialMessage(access.reason) });
    return;
  }

  const row = usage.get(GOOGLE);
  if (!row) {
    await interaction.editReply({
      content: 'No translation usage recorded yet this month.',
    });
    return;
  }

  const pct = ((row.characters_used / row.monthly_limit) * 100).toFixed(1);
  const remaining = Math.max(0, row.monthly_limit - row.characters_used);

  await interaction.editReply({
    content: [
      `**Translation quota** (${row.billing_month}, UTC)`,
      `Provider: \`${row.provider}\``,
      `Used: \`${fmt(row.characters_used)} / ${fmt(row.monthly_limit)}\` chars (${pct}%)`,
      `Remaining: \`${fmt(remaining)}\` chars`,
      `Cache entries: \`${fmt(cache.size())}\` (30-day retention)`,
    ].join('\n'),
  });
};

const fmt = (n: number): string => n.toLocaleString('en-US');
