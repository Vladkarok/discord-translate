/**
 * In-memory translation session store.
 *
 * Per plan §"Interactive State Storage": single-process bot + 3 users →
 * no need for a SQLite table here. Component interactions are bound to
 * an opaque `sessionId` embedded in `custom_id`s. Sessions expire after
 * ~20 minutes (Discord ephemeral message lifetime is generous; user
 * usually finishes within a minute).
 *
 * Failure mode of a container restart mid-conversation: the user
 * re-invokes `Translate` from the message context menu, paying one
 * Google call (or hitting the cache once M5 ships).
 */
import { randomUUID } from 'node:crypto';

export interface TranslationSession {
  readonly userId: string;
  readonly originalText: string;
  readonly currentSource: string; // 'auto' | 'en' | 'fr' | 'uk' | 'ru'
  readonly currentTarget: string; // 'en' | 'fr' | 'uk' | 'ru'
  readonly lastDetectedSource: string | null; // populated by the orchestrator after a call
  readonly panelExpanded: boolean; // false → show only the toggle; true → show selects + buttons
  readonly createdAt: number;
  readonly expiresAt: number;
}

export type SessionSeed = Omit<TranslationSession, 'createdAt' | 'expiresAt'>;

export interface SessionStore {
  create(seed: SessionSeed): { readonly id: string; readonly session: TranslationSession };
  get(id: string): TranslationSession | undefined;
  update(id: string, patch: Partial<SessionSeed>): TranslationSession | undefined;
  delete(id: string): void;
  size(): number;
  stop(): void;
}

const TTL_MS = 20 * 60 * 1000; // 20 minutes
const SWEEP_INTERVAL_MS = 60 * 1000; // sweep once a minute

export const createSessionStore = (now: () => number = Date.now): SessionStore => {
  const store = new Map<string, TranslationSession>();

  const sweep = setInterval(() => {
    const t = now();
    for (const [id, s] of store) {
      if (s.expiresAt <= t) store.delete(id);
    }
  }, SWEEP_INTERVAL_MS);
  sweep.unref(); // don't keep the event loop alive on this alone

  return {
    create(seed) {
      const id = randomUUID();
      const t = now();
      const session: TranslationSession = { ...seed, createdAt: t, expiresAt: t + TTL_MS };
      store.set(id, session);
      return { id, session };
    },
    get(id) {
      const s = store.get(id);
      if (!s) return undefined;
      if (s.expiresAt <= now()) {
        store.delete(id);
        return undefined;
      }
      return s;
    },
    update(id, patch) {
      const cur = store.get(id);
      if (!cur || cur.expiresAt <= now()) return undefined;
      const next: TranslationSession = { ...cur, ...patch, expiresAt: now() + TTL_MS };
      store.set(id, next);
      return next;
    },
    delete(id) {
      store.delete(id);
    },
    size() {
      return store.size;
    },
    stop() {
      clearInterval(sweep);
    },
  };
};
