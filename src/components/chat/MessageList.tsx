"use client";

import { useLayoutEffect, useRef, useState } from "react";
import type { Message } from "../../types/chat";

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isLoading?: boolean;
  onRetry: (messageId: string) => void;
  onDelete: (messageId: string) => void;
}

const GROUP_WINDOW_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const diff = Math.round((startOfDay(new Date()) - startOfDay(date)) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function MessageList({
  messages,
  currentUserId,
  isLoading = false,
  onRetry,
  onDelete,
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const prevScrollHeight = useRef(0);
  const prevFirstId = useRef<string | undefined>(undefined);
  const prevLastId = useRef<string | undefined>(undefined);
  const atBottomRef = useRef(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

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

  const scrollToLatest = () => {
    const element = listRef.current;
    if (!element) return;
    element.scrollTo({ top: element.scrollHeight, behavior: "smooth" });
    atBottomRef.current = true;
    setIsAtBottom(true);
  };

  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">
        {isLoading ? "Loading messages…" : "No messages yet. Say hello."}
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
        {messages.map((message, index) => {
          const previous = index > 0 ? messages[index - 1] : undefined;
          const isMine = message.sender.id === currentUserId;
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

                  <p className="break-words whitespace-pre-wrap">
                    {message.content}
                  </p>

                  <div
                    className={`mt-1 flex items-center justify-end gap-2 text-[10px] ${
                      isMine ? "text-sky-100/80" : "text-slate-400"
                    }`}
                  >
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
                      <button
                        type="button"
                        onClick={() => onDelete(message.id)}
                        className="opacity-70 underline-offset-2 transition hover:text-white hover:underline sm:opacity-0 sm:group-hover:opacity-100"
                      >
                        Delete
                      </button>
                    ) : null}

                    <span>{formatTime(message.createdAt)}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
