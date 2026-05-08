/**
 * In-memory session store.
 *
 * MVP: process-memory Map. Server restart clears all sessions.
 * Phase 2: consider TTL-based auto-expiry.
 */

import type { SessionData } from './session-manager.js';

const sessions = new Map<string, SessionData>();

export function storeSession(session: SessionData): void {
  sessions.set(session.id, session);
}

export function getSession(id: string): SessionData | undefined {
  return sessions.get(id);
}

export function removeSession(id: string): boolean {
  return sessions.delete(id);
}

export function sessionExists(id: string): boolean {
  return sessions.has(id);
}
