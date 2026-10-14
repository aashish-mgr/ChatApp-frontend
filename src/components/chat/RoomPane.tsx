"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useChat } from "../providers/ChatProvider";
import { MessagePane } from "./MessagePane";
import { MessagePaneSkeleton } from "./Skeletons";

interface RoomPaneProps {
  roomId: string;
}

export function RoomPane({ roomId }: RoomPaneProps) {
  const { rooms, roomsStatus, activateRoom } = useChat();

  // Route is the source of truth for which room is live: mirror it into the
  // chat store (joins the channel + loads history).
  useEffect(() => {
    activateRoom(roomId);
  }, [roomId, activateRoom]);

  const room = rooms.find((item) => item.id === roomId) ?? null;

  if (!room) {
    if (roomsStatus === "ready") {
      return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-slate-400">
            This conversation isn&apos;t available.
          </p>
          <Link
            href="/"
            className="text-sm font-medium text-sky-400 hover:text-sky-300"
          >
            Back to conversations
          </Link>
        </div>
      );
    }
    return <MessagePaneSkeleton />;
  }

  // Remount per room so drafts and scroll state never leak between rooms.
  return <MessagePane key={room.id} room={room} />;
}
