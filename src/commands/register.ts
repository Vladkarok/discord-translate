/**
 * Global command registration. Discord's PUT
 * /applications/{id}/commands is itself idempotent — it replaces the
 * entire global command set in one call. The SKIP_COMMAND_REGISTRATION
 * env flag is the dev-iteration escape hatch, not a correctness
 * requirement.
 *
 * Future polish: hash the desired spec, fetch current commands, skip
 * PUT if hashes match. Global commands are heavily rate-limited; skip
 * helps during deploy loops.
 */
import { REST, Routes, type RESTPostAPIApplicationCommandsJSONBody } from 'discord.js';
import { log } from '../logger.js';

export interface RegisterOptions {
  readonly token: string;
  readonly clientId: string;
  readonly commands: readonly RESTPostAPIApplicationCommandsJSONBody[];
}

export const registerGlobalCommands = async (opts: RegisterOptions): Promise<void> => {
  const rest = new REST({ version: '10' }).setToken(opts.token);
  log('info', 'commands.registering', { count: opts.commands.length });
  await rest.put(Routes.applicationCommands(opts.clientId), {
    body: [...opts.commands],
  });
  log('info', 'commands.registered', { count: opts.commands.length });
};
