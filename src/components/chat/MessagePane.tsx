"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Room } from "../../types/chat";
import { useAuth } from "../providers/AuthProvider";
import { useChat } from "../providers/ChatProvider";
import { useSocket } from "../providers/SocketProvider";
import { useToast } from "../providers/ToastProvider";
import { MessageList } from "./MessageList";
import { Composer } from "./Composer";
import { ConfirmDialog } from "./ConfirmDialog";

interface MessagePaneProps {
  room: Room;
}

export function MessagePane({ room }: MessagePaneProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const {
    getRoomHistory,
    retryHistory,
    loadOlder,
    sendMessage,
    retryMessage,
    editMessage,
    deleteMessage,
    leaveRoom,
    deleteRoom,
    isUserOnline,
  } = useChat();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingRoomAction, setPendingRoomAction] = useState<
    "leave" | "delete" | null
  >(null);
  const [menuOpen, setMenuOpen] = useState(false);

  const { messages, hasMore, isLoading, error } = getRoomHistory(room.id);
  const peer = room.members.find((member) => member.id !== user?.id);
  const peerName = peer?.username ?? "Conversation";
  const isPeerOnline = peer ? isUserOnline(peer.id) : false;

  const handleEditMessage = async (messageId: string, content: string) => {
    try {
      await editMessage(messageId, content);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not edit the message.",
        "error",
      );
      // Re-throw so the editor stays open for another attempt.
      throw error;
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const messageId = pendingDelete;
    setPendingDelete(null);
    try {
      await deleteMessage(messageId);
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not delete the message.",
        "error",
      );
    }
  };

  const confirmRoomAction = async () => {
    const action = pendingRoomAction;
    setPendingRoomAction(null);
    setMenuOpen(false);
    if (!action) return;
    try {
      if (action === "leave") {
        await leaveRoom(room.id);
        toast("You left the conversation.", "success");
      } else {
        await deleteRoom(room.id);
        toast("Conversation deleted.", "success");
      }
      router.push("/");
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Something went wrong.",
        "error",
      );
    }
  };

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
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">
            {peerName}
          </p>
          <p className="text-xs text-slate-500">
            {!isConnected
              ? "Status unavailable"
              : isPeerOnline
                ? "Online"
                : "Offline"}
          </p>
        </div>

        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Conversation options"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
            className="flex h-8 w-8 items-center justify-center rounded-full text-lg text-slate-400 transition hover:bg-slate-800 hover:text-white"
          >
            ⋯
          </button>
          {menuOpen ? (
            <>
              {/* Click-away to dismiss. */}
              <button
                type="button"
                aria-hidden="true"
                tabIndex={-1}
                onClick={() => setMenuOpen(false)}
                className="fixed inset-0 z-10 cursor-default"
              />
              <div
                role="menu"
                className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-xl border border-slate-800 bg-slate-900 py-1 shadow-xl"
              >
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setPendingRoomAction("leave")}
                  className="block w-full px-4 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                >
                  Leave conversation
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setPendingRoomAction("delete")}
                  className="block w-full px-4 py-2 text-left text-sm text-red-400 transition hover:bg-slate-800"
                >
                  Delete conversation
                </button>
              </div>
            </>
          ) : null}
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

      {error && messages.length === 0 && !isLoading ? (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-red-400">{error}</p>
          <button
            type="button"
            onClick={() => void retryHistory(room.id)}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-medium text-slate-100 transition hover:bg-slate-700"
          >
            Try again
          </button>
        </div>
      ) : (
        <MessageList
          messages={messages}
          currentUserId={user?.id ?? ""}
          isLoading={isLoading}
          onRetry={(messageId) => void retryMessage(room.id, messageId)}
          onEdit={handleEditMessage}
          onDelete={(messageId) => setPendingDelete(messageId)}
        />
      )}

      <Composer onSend={(content) => void sendMessage(room.id, content)} />

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete message"
        message="This message will be deleted for everyone in the conversation."
        confirmLabel="Delete"
        destructive
        onConfirm={() => void confirmDelete()}
        onCancel={() => setPendingDelete(null)}
      />

      <ConfirmDialog
        open={pendingRoomAction !== null}
        title={pendingRoomAction === "leave" ? "Leave conversation" : "Delete conversation"}
        message={
          pendingRoomAction === "leave"
            ? "You'll stop receiving messages here. You can reopen the conversation later."
            : "The conversation and all of its messages will be deleted for everyone. This can't be undone."
        }
        confirmLabel={pendingRoomAction === "leave" ? "Leave" : "Delete"}
        destructive
        onConfirm={() => void confirmRoomAction()}
        onCancel={() => setPendingRoomAction(null)}
      />
    </div>
  );
}
