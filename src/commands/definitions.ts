/**
 * Command definitions for Discord global registration.
 *
 * Both commands are user-installable so a friend can install the app to
 * their own account and use it in DMs / group DMs / allowed guilds —
 * no per-guild install needed.
 *
 * Reference (verify when M1 manual test runs):
 *   integration_types: [UserInstall] = the app is installable per-user.
 *   contexts: [Guild, BotDM, PrivateChannel] = command shows up in
 *     guilds, the bot's DM, and group DMs respectively.
 */
import {
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
      type: 1, // ApplicationCommandOptionType.Subcommand
    },
  ],
};

export const COMMAND_DEFINITIONS: readonly RESTPostAPIApplicationCommandsJSONBody[] = [
  translateCommand,
  settingsCommand,
];
