/**
 * closeSession tool — releases browser resources for a session.
 */

import { getSession, removeSession } from '../browser/session-store.js';
import { CloseSessionInputSchema } from '../types.js';
import type { CloseSessionInput, CloseSessionOutput } from '../types.js';

export async function closeSession(
  raw: CloseSessionInput,
): Promise<CloseSessionOutput> {
  const input = CloseSessionInputSchema.parse(raw);
  const { sessionId } = input;

  const session = getSession(sessionId);
  if (!session) {
    return { success: false, reason: 'session already closed' };
  }

  removeSession(sessionId);
  await session.browserSession.close().catch(() => {});

  return { success: true };
}
