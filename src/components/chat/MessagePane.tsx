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
import { TypingIndicator } from "./TypingIndicator";
import { ConfirmDialog } from "./ConfirmDialog";
import { GroupMembersDialog } from "./GroupMembersDialog";

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
    uploadAttachment,
    editMessage,
    deleteMessage,
    leaveRoom,
    deleteRoom,
    isUserOnline,
    getTypingUserIds,
    setTyping,
  } = useChat();
  const { toast } = useToast();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingRoomAction, setPendingRoomAction] = useState<
    "leave" | "delete" | null
  >(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [membersOpen, setMembersOpen] = useState(false);

  const { messages, hasMore, isLoading, error } = getRoomHistory(room.id);
  const isGroup = room.isGroup === true;
  const peer = isGroup
    ? undefined
    : room.members.find((member) => member.id !== user?.id);
  const title = isGroup ? room.name || "Group" : peer?.username ?? "Conversation";
  const isPeerOnline = !isGroup && peer ? isUserOnline(peer.id) : false;
  const subtitle = isGroup
    ? `${room.members.length} member${room.members.length === 1 ? "" : "s"}`
    : !isConnected
      ? "Status unavailable"
      : isPeerOnline
        ? "Online"
        : "Offline";
  // Other members currently typing here (the current user is excluded).
  const typingIds = getTypingUserIds(room.id);
  const typingMembers = room.members.filter((member) =>
    typingIds.includes(member.id),
  );

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
        toast(isGroup ? "You left the group." : "You left the conversation.", "success");
      } else {
        await deleteRoom(room.id);
        toast(isGroup ? "Group deleted." : "Conversation deleted.", "success");
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
            {title.charAt(0)}
          </span>
          {isPeerOnline ? (
            <span
              aria-label="Online"
              className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-500"
            />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-100">{title}</p>
          <p className="text-xs text-slate-500">{subtitle}</p>
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
                {isGroup ? (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      setMembersOpen(true);
                    }}
                    className="block w-full px-4 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                  >
                    Group members
                  </button>
                ) : null}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => setPendingRoomAction("leave")}
                  className="block w-full px-4 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                >
                  {isGroup ? "Leave group" : "Leave conversation"}
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
          hasMore={hasMore}
          onLoadOlder={() => void loadOlder(room.id)}
          onRetry={(messageId) => void retryMessage(room.id, messageId)}
          onEdit={handleEditMessage}
          onDelete={(messageId) => setPendingDelete(messageId)}
        >
          <TypingIndicator users={typingMembers} />
        </MessageList>
      )}

      <Composer
        onSend={(content, attachment) =>
          void sendMessage(room.id, content, attachment)
        }
        onTypingChange={(typing) => setTyping(room.id, typing)}
        onAttach={(file, onProgress) =>
          uploadAttachment(room.id, file, ({ percent }) => onProgress(percent))
        }
        onError={(message) => toast(message, "error")}
      />

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
        title={
          pendingRoomAction === "leave"
            ? isGroup
              ? "Leave group"
              : "Leave conversation"
            : isGroup
              ? "Delete group"
              : "Delete conversation"
        }
        message={
          pendingRoomAction === "leave"
            ? isGroup
              ? "You'll stop receiving messages from this group. You can be added back later."
              : "You'll stop receiving messages here. You can reopen the conversation later."
            : "The conversation and all of its messages will be deleted for everyone. This can't be undone."
        }
        confirmLabel={pendingRoomAction === "leave" ? "Leave" : "Delete"}
        destructive
        onConfirm={() => void confirmRoomAction()}
        onCancel={() => setPendingRoomAction(null)}
      />

      {membersOpen && isGroup ? (
        <GroupMembersDialog room={room} onClose={() => setMembersOpen(false)} />
      ) : null}
    </div>
  );
}
