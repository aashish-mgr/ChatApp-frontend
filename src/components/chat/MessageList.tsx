"use client";

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { Message } from "../../types/chat";
import { formatDay, formatTime, GROUP_WINDOW_MS } from "../../lib/format";
import { MAX_MESSAGE_LENGTH } from "./Composer";
import { AttachmentView } from "./AttachmentView";

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadOlder?: () => void;
  /** Rendered at the tail of the list, e.g. the peer's typing indicator. */
  children?: ReactNode;
  onRetry: (messageId: string) => void;
  onEdit: (messageId: string, content: string) => Promise<void>;
  onDelete: (messageId: string) => void;
}

export function MessageList({
  messages,
  currentUserId,
  isLoading = false,
  hasMore = false,
  onLoadOlder,
  children,
  onRetry,
  onEdit,
  onDelete,
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const topSentinelRef = useRef<HTMLDivElement>(null);
  const prevScrollHeight = useRef(0);
  const prevFirstId = useRef<string | undefined>(undefined);
  const prevLastId = useRef<string | undefined>(undefined);
  const atBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Preserve the viewport when older messages are prepended, and stick to the
  // bottom when a new latest message arrives while already at the bottom.
  useLayoutEffect(() => {
    const element = listRef.current;
    if (!element) return;

    const firstId = messages[0]?.id;
    const lastId = messages.at(-1)?.id;

    if (prevFirstId.current !== undefined && firstId !== prevFirstId.current) {
      element.scrollTop += element.scrollHeight - prevScrollHeight.current;
    } else if (lastId !== prevLastId.current) {
      if (prevLastId.current === undefined || atBottomRef.current) {
        element.scrollTop = element.scrollHeight;
      }
    }

    prevFirstId.current = firstId;
    prevLastId.current = lastId;
    prevScrollHeight.current = element.scrollHeight;
  }, [messages]);

  const handleScroll = () => {
    const element = listRef.current;
    if (!element) return;
    const atBottom =
      element.scrollHeight - element.scrollTop - element.clientHeight < 80;
    atBottomRef.current = atBottom;
    setIsAtBottom(atBottom);
  };

  useEffect(() => {
    const sentinel = topSentinelRef.current;
    const root = listRef.current;
    if (!sentinel || !root || !hasMore || !onLoadOlder || isLoading) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          onLoadOlder();
        }
      },
      {
        root,
        rootMargin: "200px 0px 0px 0px",
        threshold: 0.01,
      },
    );

    observer.observe(sentinel);
    return () => {
      observer.disconnect();
    };
  }, [hasMore, onLoadOlder, isLoading, messages.length]);

  const scrollToLatest = () => {
    const element = listRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    atBottomRef.current = true;
    setIsAtBottom(true);
  };

  const beginEdit = (message: Message) => {
    setEditingId(message.id);
    setDraft(message.content);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setDraft("");
  };

  const saveEdit = async () => {
    if (editingId === null) return;

    const trimmed = draft.trim().slice(0, MAX_MESSAGE_LENGTH);
    const original = messages.find((item) => item.id === editingId);
    // Nothing to save: closing is friendlier than a pointless round-trip.
    if (!trimmed || !original || trimmed === original.content) {
      cancelEdit();
      return;
    }

    setIsSavingEdit(true);
    try {
      await onEdit(editingId, trimmed);
      cancelEdit();
    } catch {
      // The parent surfaced the error; keep the editor open to retry.
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleEditKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      cancelEdit();
      return;
    }
    // Enter saves; Shift+Enter keeps a newline. `isComposing` protects IMEs.
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      void saveEdit();
    }
  };

  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-sm text-slate-500">
        <p>{isLoading ? "Loading messages…" : "No messages yet. Say hello."}</p>
        {children}
      </div>
    );
  }

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {!isAtBottom ? (
        <button
          type="button"
          onClick={scrollToLatest}
          className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-800/95 px-3 py-1.5 text-xs font-medium text-slate-200 shadow-lg transition hover:bg-slate-700"
        >
          Jump to latest ↓
        </button>
      ) : null}

      <div
        ref={listRef}
        onScroll={handleScroll}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-6"
      >
        {hasMore ? <div ref={topSentinelRef} aria-hidden="true" className="h-1" /> : null}
        {isLoading && messages.length > 0 ? (
          <div className="flex justify-center py-2 text-xs text-slate-500">
            Loading older messages…
          </div>
        ) : null}
        {messages.map((message, index) => {
          const previous = index > 0 ? messages[index - 1] : undefined;
          const isMine = message.sender.id === currentUserId;
          const isEditing = editingId === message.id;
          const dayChanged =
            !previous || formatDay(previous.createdAt) !== formatDay(message.createdAt);
          const startedNewGroup =
            !previous ||
            dayChanged ||
            previous.sender.id !== message.sender.id ||
            new Date(message.createdAt).getTime() -
              new Date(previous.createdAt).getTime() >
              GROUP_WINDOW_MS;

          return (
            <div key={message.id}>
              {dayChanged ? (
                <div className="my-4 flex items-center gap-3">
                  <span className="h-px flex-1 bg-slate-800" />
                  <span className="text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                    {formatDay(message.createdAt)}
                  </span>
                  <span className="h-px flex-1 bg-slate-800" />
                </div>
              ) : null}

              <div
                className={`group flex ${
                  isMine ? "justify-end" : "justify-start"
                } ${startedNewGroup ? "" : "mt-1"}`}
              >
                {isEditing ? (
                  <div className="w-full max-w-[75%] rounded-2xl border border-sky-600/60 bg-slate-900 px-3.5 py-2 text-sm">
                    <textarea
                      autoFocus
                      rows={2}
                      value={draft}
                      onChange={(event) => setDraft(event.target.value)}
                      onKeyDown={handleEditKeyDown}
                      aria-label="Edit message"
                      className="max-h-32 w-full resize-none rounded-lg border border-slate-700 bg-slate-950 px-2 py-1.5 text-sm text-slate-100 outline-none transition focus:border-sky-500"
                    />
                    <div className="mt-2 flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={cancelEdit}
                        disabled={isSavingEdit}
                        className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-400 transition hover:text-white disabled:opacity-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveEdit()}
                        disabled={isSavingEdit || !draft.trim()}
                        className="rounded-lg bg-sky-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isSavingEdit ? "Saving…" : "Save"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                      isMine
                        ? "bg-sky-500 text-white"
                        : "bg-slate-800 text-slate-100"
                    }`}
                  >
                    {!isMine && startedNewGroup ? (
                      <p className="mb-0.5 text-xs font-medium text-slate-300">
                        {message.sender.username}
                      </p>
                    ) : null}

                    {message.attachment ? (
                      <AttachmentView attachment={message.attachment} />
                    ) : null}

                    {message.content ? (
                      <p className="break-words whitespace-pre-wrap">
                        {message.content}
                      </p>
                    ) : null}

                    <div
                      className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${
                        isMine ? "text-sky-100/80" : "text-slate-400"
                      }`}
                    >
                      {message.editedAt ? <span>edited</span> : null}

                      {isMine && message.clientStatus === "failed" ? (
                        <button
                          type="button"
                          onClick={() => onRetry(message.id)}
                          className="font-medium text-red-100 underline underline-offset-2 hover:text-white"
                        >
                          Failed · Retry
                        </button>
                      ) : null}

                      {isMine && message.clientStatus === "sending" ? (
                        <span>Sending…</span>
                      ) : null}

                      {isMine && !message.clientStatus ? (
                        <>
                          <button
                            type="button"
                            onClick={() => beginEdit(message)}
                            className="opacity-70 underline-offset-2 transition hover:text-white hover:underline sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => onDelete(message.id)}
                            className="opacity-70 underline-offset-2 transition hover:text-white hover:underline sm:opacity-0 sm:group-hover:opacity-100"
                          >
                            Delete
                          </button>
                        </>
                      ) : null}

                      <span>{formatTime(message.createdAt)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {children}
      </div>
    </div>
  );
}
