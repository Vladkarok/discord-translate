/**
 * Access control.
 *
 * Owner identity comes from env (`OWNER_DISCORD_ID`). Friends live in the
 * `users` table. Default friend scope is DMs and group DMs only; server
 * (guild) use requires `server_usage_enabled = 1`.
 *
 * Decisions are pure: no I/O beyond the prepared-statement read inside
 * `usersRepo.isFriend / getFriend`.
 */
import { InteractionContextType } from 'discord.js';
import type { Config } from './config.js';
import type { UsersRepository } from './db/users.js';

export type AccessDecision =
  | { allowed: true; role: 'owner' | 'friend' }
  | { allowed: false; reason: 'not_allowlisted' | 'server_use_disabled' | 'unknown_context' };

export const isOwner = (userId: string, config: Pick<Config, 'OWNER_DISCORD_ID'>): boolean =>
  userId === config.OWNER_DISCORD_ID;

export const resolveAccess = (
  userId: string,
  context: InteractionContextType | null,
  users: UsersRepository,
  config: Pick<Config, 'OWNER_DISCORD_ID'>,
): AccessDecision => {
  if (isOwner(userId, config)) {
    return { allowed: true, role: 'owner' };
  }

  const friend = users.getFriend(userId);
  if (!friend) {
    return { allowed: false, reason: 'not_allowlisted' };
  }

  // DMs and group DMs are always allowed for friends.
  if (
    context === InteractionContextType.BotDM ||
    context === InteractionContextType.PrivateChannel
  ) {
    return { allowed: true, role: 'friend' };
  }

  if (context === InteractionContextType.Guild) {
    return friend.server_usage_enabled === 1
      ? { allowed: true, role: 'friend' }
      : { allowed: false, reason: 'server_use_disabled' };
  }

  // Null/unknown context — fail closed.
  return { allowed: false, reason: 'unknown_context' };
};

export const denialMessage = (
  reason: Exclude<AccessDecision, { allowed: true }>['reason'],
): string => {
  switch (reason) {
    case 'not_allowlisted':
      return 'You are not on the allowlist for this bot.';
    case 'server_use_disabled':
      return 'You can use this bot in DMs only. Ask the owner to enable server use.';
    case 'unknown_context':
      return 'This command is not available in this context.';
  }
};
