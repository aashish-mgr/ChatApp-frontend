import { describe, expect, it } from "vitest";
import { activeRoomIdFromPath } from "./navigation";

describe("activeRoomIdFromPath", () => {
  it("extracts the room id from a chat path", () => {
    expect(activeRoomIdFromPath("/chat/abc")).toBe("abc");
  });

  it("ignores trailing path segments", () => {
    expect(activeRoomIdFromPath("/chat/abc/def")).toBe("abc");
  });

  it("returns null when no room is open", () => {
    expect(activeRoomIdFromPath("/")).toBeNull();
    expect(activeRoomIdFromPath("/login")).toBeNull();
  });

  it("returns null for a missing or empty room id", () => {
    expect(activeRoomIdFromPath(null)).toBeNull();
    expect(activeRoomIdFromPath("/chat/")).toBeNull();
  });
});
