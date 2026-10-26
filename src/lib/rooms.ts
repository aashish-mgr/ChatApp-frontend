import type { Room } from "../types/chat";

/**
 * What to show as a room's title: the group's name, or the other person's
 * username for a direct conversation. Falls back to a neutral label when the
 * data needed for either is missing.
 */
export function roomDisplayName(
  room: Pick<Room, "isGroup" | "name" | "members">,
  currentUserId: string | undefined,
): string {
  if (room.isGroup) {
    return room.name?.trim() || "Group";
  }

  const peer = room.members.find((member) => member.id !== currentUserId);
  return peer?.username ?? "Unknown";
}
