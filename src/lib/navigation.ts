/**
 * Extracts the open room id from a `/chat/<roomId>` pathname.
 * Shared by the sidebar and the shell so the two can never disagree.
 */
export function activeRoomIdFromPath(pathname: string | null): string | null {
  if (!pathname || !pathname.startsWith("/chat/")) return null;
  return pathname.slice("/chat/".length).split("/")[0] || null;
}
