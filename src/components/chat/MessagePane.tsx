"use client";

import type { Room } from "../../types/chat";
import { useAuth } from "../providers/AuthProvider";
import { useChat } from "../providers/ChatProvider";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";

interface MessagePaneProps {
  room: Room;
}

export function MessagePane({ room }: MessagePaneProps) {
  const { user } = useAuth();
  const {
    messages,
    hasMore,
    isLoadingMessages,
    loadOlder,
    sendMessage,
    deleteMessage,
    closeRoom,
  } = useChat();

  const peer = room.members.find((member) => member.id !== user?.id);
  const peerName = peer?.username ?? "Conversation";

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-slate-800 px-4 py-3">
        <button
          type="button"
          onClick={closeRoom}
          aria-label="Back to conversations"
          className="text-slate-400 transition hover:text-white md:hidden"
        >
          ←
        </button>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold uppercase text-slate-200">
          {peerName.charAt(0)}
        </div>
        <p className="text-sm font-semibold text-slate-100">{peerName}</p>
      </header>

      {hasMore ? (
        <div className="flex justify-center border-b border-slate-800/60 py-2">
          <button
            type="button"
            onClick={() => void loadOlder()}
            disabled={isLoadingMessages}
            className="text-xs font-medium text-sky-400 transition hover:text-sky-300 disabled:opacity-50"
          >
            {isLoadingMessages ? "Loading…" : "Load older messages"}
          </button>
        </div>
      ) : null}

      <MessageList
        messages={messages}
        currentUserId={user?.id ?? ""}
        isLoading={isLoadingMessages}
        onDelete={deleteMessage}
      />

      <Composer onSend={sendMessage} />
    </div>
  );
}
