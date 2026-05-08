import { getSession } from '../browser/session-store.js';

export function resolveMode(
  sessionId: string | undefined,
  inputUrl: string | undefined,
):
  | { mode: 'session'; url: string; session: NonNullable<ReturnType<typeof getSession>> }
  | { mode: 'one-shot'; url: string }
  | { error: 'SESSION_NOT_FOUND' | 'INVALID_URL'; message: string } {
  if (sessionId) {
    const session = getSession(sessionId);
    if (!session) {
      return { error: 'SESSION_NOT_FOUND', message: sessionId };
    }
    return { mode: 'session', url: session.url, session };
  }

  if (inputUrl) {
    if (!inputUrl.startsWith('https://') && !inputUrl.startsWith('http://')) {
      return { error: 'INVALID_URL', message: 'URL must start with http:// or https://' };
    }
    return { mode: 'one-shot', url: inputUrl };
  }

  return { error: 'SESSION_NOT_FOUND', message: 'Must provide sessionId or url' };
}
