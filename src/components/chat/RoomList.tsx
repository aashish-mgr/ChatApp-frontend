"use client";

import type { Room } from "../../types/chat";
import { useAuth } from "../providers/AuthProvider";
import { useChat } from "../providers/ChatProvider";

function peerOf(room: Room, currentUserId: string | undefined) {
  return room.members.find((member) => member.id !== currentUserId);
}

export function RoomList() {
  const { user } = useAuth();
  const { rooms, roomsStatus, activeRoomId, selectRoom, refreshRooms } =
    useChat();

  if (roomsStatus === "loading") {
    return <p className="px-4 py-6 text-sm text-slate-500">Loading chats…</p>;
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

        return (
          <li key={room.id}>
            <button
              type="button"
              onClick={() => selectRoom(room)}
              className={`flex w-full items-center gap-3 px-4 py-3 text-left transition ${
                isActive ? "bg-slate-800" : "hover:bg-slate-800/60"
              }`}
            >
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold uppercase text-slate-200">
                {name.charAt(0)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-slate-100">
                  {name}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {preview}
                </span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
