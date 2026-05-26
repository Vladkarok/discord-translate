/**
 * Discord client factory. Zero privileged intents — message-context
 * commands deliver the target message in the interaction payload, so we
 * never need `MessageContent` intent (per plan decision).
 *
 * No `Guilds` intent either: this bot is interaction-driven (user-
 * installed). It does not need guild member or message-event streams.
 */
import { Client, Events, type Interaction } from 'discord.js';
import { log } from '../logger.js';

export type InteractionHandler = (interaction: Interaction) => Promise<void> | void;

export const createClient = (): Client => new Client({ intents: [] });

export const attachLifecycleLogging = (client: Client): void => {
  client.once(Events.ClientReady, (c) => {
    log('info', 'client.ready', { userId: c.user.id, username: c.user.username });
  });
  client.on(Events.Error, (err) => {
    log('error', 'client.error', { err: err.message });
  });
  client.on(Events.Warn, (msg) => {
    log('warn', 'client.warn', { msg });
  });
};

export const attachInteractionHandler = (client: Client, handler: InteractionHandler): void => {
  client.on(Events.InteractionCreate, (interaction) => {
    // Fire-and-forget; the handler owns its own error reporting.
    void Promise.resolve(handler(interaction)).catch((err: unknown) => {
      log('error', 'interaction.unhandled', {
        err: err instanceof Error ? err.message : String(err),
      });
    });
  });
};
