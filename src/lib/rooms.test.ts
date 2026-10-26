import { describe, expect, it } from "vitest";
import { roomDisplayName } from "./rooms";

const alice = { id: "a", username: "alice" };
const bob = { id: "b", username: "bob" };

describe("roomDisplayName", () => {
  it("uses the peer's username for a direct conversation", () => {
    expect(
      roomDisplayName(
        { isGroup: false, name: null, members: [alice, bob] },
        alice.id,
      ),
    ).toBe("bob");
  });

  it("uses the group name for a group", () => {
    expect(
      roomDisplayName(
        { isGroup: true, name: "Weekend plans", members: [alice, bob] },
        alice.id,
      ),
    ).toBe("Weekend plans");
  });

  it("trims the group name", () => {
    expect(
      roomDisplayName(
        { isGroup: true, name: "  Team  ", members: [alice, bob] },
        alice.id,
      ),
    ).toBe("Team");
  });

  it("falls back when a group has no usable name", () => {
    expect(
      roomDisplayName(
        { isGroup: true, name: "   ", members: [alice, bob] },
        alice.id,
      ),
    ).toBe("Group");
    expect(
      roomDisplayName({ isGroup: true, name: null, members: [] }, alice.id),
    ).toBe("Group");
  });

  it("falls back when a direct room has no other member", () => {
    expect(
      roomDisplayName({ isGroup: false, name: null, members: [alice] }, alice.id),
    ).toBe("Unknown");
  });
});
