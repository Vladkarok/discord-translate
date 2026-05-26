/**
 * Command definitions for Discord global registration.
 *
 * All commands are user-installable per plan: integration_types contains
 * UserInstall; contexts include Guild, BotDM, and PrivateChannel (group
 * DM). Friends are restricted to DMs by default via runtime access
 * control (see src/access.ts), not via Discord-side context filtering.
 */
import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  ApplicationIntegrationType,
  InteractionContextType,
  type RESTPostAPIApplicationCommandsJSONBody,
} from 'discord.js';

const INTEGRATION_TYPES = [ApplicationIntegrationType.UserInstall] as const;
const CONTEXTS = [
  InteractionContextType.Guild,
  InteractionContextType.BotDM,
  InteractionContextType.PrivateChannel,
] as const;

export const TRANSLATE_COMMAND_NAME = 'Translate';
export const SETTINGS_COMMAND_NAME = 'settings';
export const FRIENDS_COMMAND_NAME = 'friends';
export const ACCESS_COMMAND_NAME = 'access';

const translateCommand: RESTPostAPIApplicationCommandsJSONBody = {
  name: TRANSLATE_COMMAND_NAME,
  type: ApplicationCommandType.Message,
  integration_types: [...INTEGRATION_TYPES],
  contexts: [...CONTEXTS],
};

const settingsCommand: RESTPostAPIApplicationCommandsJSONBody = {
  name: SETTINGS_COMMAND_NAME,
  description: 'Bot settings (owner-only in v1)',
  type: ApplicationCommandType.ChatInput,
  integration_types: [...INTEGRATION_TYPES],
  contexts: [...CONTEXTS],
  options: [
    {
      name: 'show',
      description: 'Show current settings (owner-only).',
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
};

// /friends and /access take a string user-ID rather than a USER option
// because the owner manages friends from the bot's DM, where USER picker
// resolution is unreliable. The owner already has the friend's snowflake.
const userIdOption = {
  name: 'user_id',
  description: 'Discord user ID (Developer Mode → right-click → Copy User ID).',
  type: ApplicationCommandOptionType.String,
  required: true,
} as const;

const friendsCommand: RESTPostAPIApplicationCommandsJSONBody = {
  name: FRIENDS_COMMAND_NAME,
  description: 'Manage the friend allowlist (owner-only).',
  type: ApplicationCommandType.ChatInput,
  integration_types: [...INTEGRATION_TYPES],
  contexts: [...CONTEXTS],
  options: [
    {
      name: 'add',
      description: 'Allowlist a friend by Discord user ID.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [userIdOption],
    },
    {
      name: 'remove',
      description: 'Remove a friend from the allowlist.',
      type: ApplicationCommandOptionType.Subcommand,
      options: [userIdOption],
    },
    {
      name: 'list',
      description: 'List allowlisted friends.',
      type: ApplicationCommandOptionType.Subcommand,
    },
  ],
};

const accessCommand: RESTPostAPIApplicationCommandsJSONBody = {
  name: ACCESS_COMMAND_NAME,
  description: 'Manage friend access scope (owner-only).',
  type: ApplicationCommandType.ChatInput,
  integration_types: [...INTEGRATION_TYPES],
  contexts: [...CONTEXTS],
  options: [
    {
      name: 'server',
      description: 'Server (guild) access for a friend.',
      type: ApplicationCommandOptionType.SubcommandGroup,
      options: [
        {
          name: 'enable',
          description: 'Allow this friend to use the bot in servers.',
          type: ApplicationCommandOptionType.Subcommand,
          options: [userIdOption],
        },
        {
          name: 'disable',
          description: 'Restrict this friend back to DMs only.',
          type: ApplicationCommandOptionType.Subcommand,
          options: [userIdOption],
        },
      ],
    },
  ],
};

export const COMMAND_DEFINITIONS: readonly RESTPostAPIApplicationCommandsJSONBody[] = [
  translateCommand,
  settingsCommand,
  friendsCommand,
  accessCommand,
];
