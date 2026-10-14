"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Room } from "../../types/chat";
import { useAuth } from "../providers/AuthProvider";
import { useChat } from "../providers/ChatProvider";
import { RoomListSkeleton } from "./Skeletons";

function peerOf(room: Room, currentUserId: string | undefined) {
  return room.members.find((member) => member.id !== currentUserId);
}

function activeRoomIdFromPath(pathname: string | null): string | null {
  if (!pathname || !pathname.startsWith("/chat/")) return null;
  return pathname.slice("/chat/".length).split("/")[0] || null;
}

export function RoomList() {
  const { user } = useAuth();
  const { rooms, roomsStatus, isUserOnline, refreshRooms } = useChat();
  const pathname = usePathname();
  const activeRoomId = activeRoomIdFromPath(pathname);

  if (roomsStatus === "loading") {
    return <RoomListSkeleton />;
  }

  if (roomsStatus === "error") {
    return (
      <div className="px-4 py-6 text-sm text-slate-400">
        <p>Could not load your chats.</p>
        <button
          type="button"
          onClick={() => void refreshRooms()}
          className="mt-2 font-medium text-sky-400 hover:text-sky-300"
        >
          Try again
        </button>
      </div>
    );
  }

  if (rooms.length === 0) {
    return (
      <p className="px-4 py-6 text-sm text-slate-500">
        No conversations yet. Start a new chat.
      </p>
    );
  }

  return (
    <ul className="flex-1 overflow-y-auto">
      {rooms.map((room) => {
        const peer = peerOf(room, user?.id);
        const name = peer?.username ?? "Unknown";
        const preview = room.lastMessage
          ? `${
              room.lastMessage.sender.id === user?.id
                ? "You"
                : room.lastMessage.sender.username
            }: ${room.lastMessage.content}`
          : "No messages yet";
        const isActive = room.id === activeRoomId;
        const isOnline = peer ? isUserOnline(peer.id) : false;

        return (
          <li key={room.id}>
            <Link
              href={`/chat/${room.id}`}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                isActive ? "bg-slate-800" : "hover:bg-slate-800/60"
              }`}
            >
              <span className="relative shrink-0">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold uppercase text-slate-200">
                  {name.charAt(0)}
                </span>
                {isOnline ? (
                  <span
                    aria-label="Online"
                    className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full border-2 border-slate-950 bg-emerald-500"
                  />
                ) : null}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-100">
                  {name}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {preview}
                </span>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
