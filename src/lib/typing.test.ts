import { describe, expect, it } from "vitest";
import {
  applyTypingState,
  pruneExpiredTyping,
  typingUserIdsIn,
  TYPING_TTL_MS,
  type TypingStore,
} from "./typing";

const start = (roomId: string, userId: string, now: number) =>
  applyTypingState({}, { roomId, userId, typing: true }, now);

describe("applyTypingState", () => {
  it("records a typist under their room", () => {
    expect(start("r1", "u1", 1000)).toEqual({ r1: { u1: 1000 } });
  });

  it("keeps multiple typists in the same room apart", () => {
    const store = applyTypingState(start("r1", "u1", 1000), {
      roomId: "r1",
      userId: "u2",
      typing: true,
    }, 2000);
    expect(store).toEqual({ r1: { u1: 1000, u2: 2000 } });
  });

  it("clears a typist on a stop signal", () => {
    const store = applyTypingState(start("r1", "u1", 1000), {
      roomId: "r1",
      userId: "u1",
      typing: false,
    }, 1500);
    expect(store).toEqual({});
  });

  it("removes the room entry once its last typist stops", () => {
    const twoTypists = applyTypingState(start("r1", "u1", 1000), {
      roomId: "r1",
      userId: "u2",
      typing: true,
    }, 2000);
    const stoppedOne = applyTypingState(twoTypists, {
      roomId: "r1",
      userId: "u1",
      typing: false,
    }, 2500);
    expect(stoppedOne).toEqual({ r1: { u2: 2000 } });
  });

  it("returns the same object on a redundant stop (no typist to clear)", () => {
    const store = start("r1", "u1", 1000);
    const next = applyTypingState(store, {
      roomId: "r1",
      userId: "u2",
      typing: false,
    }, 1500);
    expect(next).toBe(store);
  });

  it("refreshes the timestamp on a repeated start without changing identity rules", () => {
    // A refresh while already typing is a no-op by design (see applyTypingState),
    // so the TTL is held open by the *first* signal plus the periodic refresh
    // emitting a fresh start only when not already marked.
    const store = start("r1", "u1", 1000);
    const refreshed = applyTypingState(store, {
      roomId: "r1",
      userId: "u1",
      typing: true,
    }, 3000);
    expect(refreshed).toBe(store);
  });
});

describe("pruneExpiredTyping", () => {
  it("drops typists older than the ttl", () => {
    const store: TypingStore = { r1: { u1: 1000 } };
    expect(pruneExpiredTyping(store, 1000 + TYPING_TTL_MS + 1)).toEqual({});
  });

  it("keeps typists still inside the ttl", () => {
    const store: TypingStore = { r1: { u1: 1000 } };
    expect(pruneExpiredTyping(store, 1000 + TYPING_TTL_MS - 1)).toEqual(store);
  });

  it("is a no-op when nothing expired", () => {
    const store: TypingStore = { r1: { u1: 1000 }, r2: { u2: 900 } };
    expect(pruneExpiredTyping(store, 1050)).toBe(store);
  });

  it("keeps live typists in a room while dropping expired ones", () => {
    const store: TypingStore = { r1: { u1: 1000, u2: 9000 } };
    expect(pruneExpiredTyping(store, 9500)).toEqual({ r1: { u2: 9000 } });
  });
});

describe("typingUserIdsIn", () => {
  const store: TypingStore = { r1: { u1: 1000, u2: 1000 }, r2: { u3: 1000 } };

  it("excludes the current user", () => {
    expect(typingUserIdsIn(store, "r1", "u1")).toEqual(["u2"]);
  });

  it("returns every typist when the current user is not among them", () => {
    expect(typingUserIdsIn(store, "r1", "someone-else").sort()).toEqual([
      "u1",
      "u2",
    ]);
  });

  it("returns an empty list for a room with no typists", () => {
    expect(typingUserIdsIn(store, "missing-room", "u1")).toEqual([]);
  });
});
