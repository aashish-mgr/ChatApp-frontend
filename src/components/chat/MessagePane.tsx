"use client";

import { useRouter } from "next/navigation";
import type { Room } from "../../types/chat";
import { useAuth } from "../providers/AuthProvider";
import { useChat } from "../providers/ChatProvider";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";

interface MessagePaneProps {
  room: Room;
}

export function MessagePane({ room }: MessagePaneProps) {
  const router = useRouter();
  const { user } = useAuth();
  const {
    getRoomHistory,
    loadOlder,
    sendMessage,
    retryMessage,
    deleteMessage,
    isUserOnline,
  } = useChat();

  const { messages, hasMore, isLoading } = getRoomHistory(room.id);
  const peer = room.members.find((member) => member.id !== user?.id);
  const peerName = peer?.username ?? "Conversation";
  const isPeerOnline = peer ? isUserOnline(peer.id) : false;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <button
          type="button"
          onClick={() => router.push("/")}
          aria-label="Back to conversations"
          className="text-slate-400 transition hover:text-white md:hidden"
        >
          ←
        </button>
        <span className="relative shrink-0">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold uppercase text-slate-200">
            {peerName.charAt(0)}
          </span>
          {isPeerOnline ? (
            <span
              aria-label="Online"
              className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-500"
            />
          ) : null}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-100">
            {peerName}
          </p>
          <p className="text-xs text-slate-500">
            {isPeerOnline ? "Online" : "Offline"}
          </p>
        </div>
      </header>

      {hasMore ? (
        <div className="flex justify-center border-b border-slate-800/60 py-2">
          <button
            type="button"
            onClick={() => void loadOlder(room.id)}
            disabled={isLoading}
            className="text-xs font-medium text-sky-400 transition hover:text-sky-300 disabled:opacity-50"
          >
            {isLoading ? "Loading…" : "Load older messages"}
          </button>
        </div>
      ) : null}

      <MessageList
        messages={messages}
        currentUserId={user?.id ?? ""}
        isLoading={isLoading}
        onRetry={(messageId) => void retryMessage(room.id, messageId)}
        onDelete={(messageId) => void deleteMessage(messageId)}
      />

      <Composer onSend={(content) => void sendMessage(room.id, content)} />
    </div>
  );
}
