import type { User } from "../types/chat";

/**
 * Persisted login session. The backend token only carries the user id, so the
 * username is stored alongside it to keep the UI renderable on reload without
 * an extra round-trip.
 *
 * The session lives in localStorage, which is an external system, so it is
 * exposed as a tiny store for `useSyncExternalStore` rather than React state.
 */
export interface Session {
  token: string;
  user: User;
}

const STORAGE_KEY = "chatapp.session";

/** `undefined` means "not read from storage yet"; `null` means "logged out". */
let cached: Session | null | undefined;

const listeners = new Set<() => void>();

const isBrowser = () => typeof window !== "undefined";

function parseSession(raw: string | null): Session | null {
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<Session>;
    if (
      typeof parsed?.token !== "string" ||
      typeof parsed?.user?.id !== "string" ||
      typeof parsed?.user?.username !== "string"
    ) {
      return null;
    }

    return { token: parsed.token, user: parsed.user };
  } catch {
    // Corrupt or unreadable value: treat as logged out.
    return null;
  }
}

function loadFromStorage(): Session | null {
  if (!isBrowser()) return null;
  return parseSession(window.localStorage.getItem(STORAGE_KEY));
}

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** Client snapshot. Cached so repeated reads return a stable reference. */
export function getSessionSnapshot(): Session | null {
  if (cached === undefined) {
    cached = loadFromStorage();
  }
  return cached;
}

/** Server snapshot: there is never a session during SSR/prerender. */
export function getServerSessionSnapshot(): Session | null {
  return null;
}

export function subscribeSession(listener: () => void): () => void {
  listeners.add(listener);

  // Keep other browser tabs in sync.
  const handleStorage = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    cached = undefined;
    listener();
  };

  if (isBrowser()) {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    listeners.delete(listener);
    if (isBrowser()) {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

export function setSession(session: Session): void {
  cached = session;
  if (isBrowser()) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  }
  emit();
}

export function clearSession(): void {
  cached = null;
  if (isBrowser()) {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  emit();
}

export function readStoredToken(): string | null {
  return getSessionSnapshot()?.token ?? null;
}
