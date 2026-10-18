import type { TypingState } from "../types/chat";

/**
 * Pure state helpers for typing indicators.
 *
 * Kept free of React and sockets so the expiry/thinning rules can be unit
 * tested directly. The server already clears a typist after its own timeout;
 * this client-side expiry is a second line of defence for signals that were
 * in flight when a socket dropped, so an indicator can never get stuck on.
 */

/**
 * How long a "typing" signal is trusted to last on the client before it
 * expires locally. Comfortably longer than the server's 3s TTL so a normal
 * refresh always lands first and we only expire when the server went quiet.
 */
export const TYPING_TTL_MS = 5000;

/** A typist, keyed by user id, with the moment its signal was last refreshed. */
export type TypingMap = Record<string, number>;

/** All rooms' typing state, keyed by room id. */
export type TypingStore = Record<string, TypingMap>;

/**
 * Returns a store with `userId`'s signal for `roomId` set or cleared,
 * returning the same object when nothing changed (so React can bail out).
 *
 * `now` is injected for testability.
 */
export function applyTypingState(
  store: TypingStore,
  { roomId, userId, typing }: TypingState,
  now: number,
): TypingStore {
  const room = store[roomId];
  const isTyping = Boolean(room?.[userId]);

  // No-ops keep identity so consumers relying on reference equality don't
  // re-render on every redundant refresh.
  if (typing === isTyping) return store;

  const nextRoom: TypingMap = { ...(room ?? {}) };
  if (typing) nextRoom[userId] = now;
  else delete nextRoom[userId];

  const next = { ...store };
  // Drop the room entry entirely when the last typist leaves, so the store
  // never accumulates empty rooms.
  if (Object.keys(nextRoom).length === 0) delete next[roomId];
  else next[roomId] = nextRoom;

  return next;
}

/**
 * Removes typists whose signal is older than `ttlMs`, returning the same
 * object when nothing expired. Call this on a tick so stale entries that
 * never received a matching "stop" are eventually dropped.
 */
export function pruneExpiredTyping(
  store: TypingStore,
  now: number,
  ttlMs: number = TYPING_TTL_MS,
): TypingStore {
  let changed = false;
  const next: TypingStore = {};

  for (const [roomId, room] of Object.entries(store)) {
    const live: TypingMap = {};
    for (const [userId, at] of Object.entries(room)) {
      if (now - at <= ttlMs) live[userId] = at;
      else changed = true;
    }
    if (Object.keys(live).length > 0) next[roomId] = live;
    else changed = true;
  }

  return changed ? next : store;
}

/** Ids of the users currently typing in a room, ignoring the current user. */
export function typingUserIdsIn(
  store: TypingStore,
  roomId: string,
  currentUserId: string,
): string[] {
  const room = store[roomId];
  if (!room) return [];
  return Object.keys(room).filter((userId) => userId !== currentUserId);
}
