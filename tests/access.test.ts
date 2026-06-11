import { InteractionContextType } from 'discord.js';
import { describe, expect, it } from 'vitest';
import { denialMessage, isOwner, resolveAccess } from '../src/access.js';
import type { FriendRow, UsersRepository } from '../src/db/users.js';

const OWNER = '100000000000000001';
const FRIEND_DM_ONLY = '100000000000000002';
const FRIEND_SERVER_OK = '100000000000000003';
const STRANGER = '100000000000000004';

const friendRow = (userId: string, serverEnabled: 0 | 1): FriendRow => ({
  discord_user_id: userId,
  role: 'friend',
  target_language: null,
  server_usage_enabled: serverEnabled,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
});

const fakeUsers = (rows: readonly FriendRow[]): UsersRepository => ({
  addFriend: () => false,
  removeFriend: () => false,
  isFriend: (id) => rows.some((r) => r.discord_user_id === id),
  getFriend: (id) => rows.find((r) => r.discord_user_id === id),
  listFriends: () => rows,
  setServerUsage: () => false,
  setTargetLanguage: () => false,
  count: () => rows.length,
});

const users = fakeUsers([friendRow(FRIEND_DM_ONLY, 0), friendRow(FRIEND_SERVER_OK, 1)]);
const config = { OWNER_DISCORD_ID: OWNER };

describe('isOwner', () => {
  it('matches only the configured owner id', () => {
    expect(isOwner(OWNER, config)).toBe(true);
    expect(isOwner(STRANGER, config)).toBe(false);
  });
});

describe('resolveAccess', () => {
  const cases: ReadonlyArray<{
    name: string;
    userId: string;
    context: InteractionContextType | null;
    expected: ReturnType<typeof resolveAccess>;
  }> = [
    {
      name: 'owner in guild',
      userId: OWNER,
      context: InteractionContextType.Guild,
      expected: { allowed: true, role: 'owner' },
    },
    {
      name: 'owner with null context',
      userId: OWNER,
      context: null,
      expected: { allowed: true, role: 'owner' },
    },
    {
      name: 'friend in bot DM',
      userId: FRIEND_DM_ONLY,
      context: InteractionContextType.BotDM,
      expected: { allowed: true, role: 'friend' },
    },
    {
      name: 'friend in group DM',
      userId: FRIEND_DM_ONLY,
      context: InteractionContextType.PrivateChannel,
      expected: { allowed: true, role: 'friend' },
    },
    {
      name: 'DM-only friend in guild',
      userId: FRIEND_DM_ONLY,
      context: InteractionContextType.Guild,
      expected: { allowed: false, reason: 'server_use_disabled' },
    },
    {
      name: 'server-enabled friend in guild',
      userId: FRIEND_SERVER_OK,
      context: InteractionContextType.Guild,
      expected: { allowed: true, role: 'friend' },
    },
    {
      name: 'friend with null context fails closed',
      userId: FRIEND_DM_ONLY,
      context: null,
      expected: { allowed: false, reason: 'unknown_context' },
    },
    {
      name: 'stranger anywhere',
      userId: STRANGER,
      context: InteractionContextType.BotDM,
      expected: { allowed: false, reason: 'not_allowlisted' },
    },
  ];

  it.each(cases)('$name', ({ userId, context, expected }) => {
    expect(resolveAccess(userId, context, users, config)).toEqual(expected);
  });
});

describe('denialMessage', () => {
  it('has a message for every denial reason', () => {
    expect(denialMessage('not_allowlisted')).toMatch(/allowlist/);
    expect(denialMessage('server_use_disabled')).toMatch(/DMs only/);
    expect(denialMessage('unknown_context')).toMatch(/not available/);
  });
});
