"use client";

import { useEffect, useRef } from "react";
import type { Message } from "../../types/chat";

interface MessageListProps {
  messages: Message[];
  currentUserId: string;
  isLoading?: boolean;
  onRetry: (messageId: string) => void;
  onDelete: (messageId: string) => void;
}

function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function MessageList({
  messages,
  currentUserId,
  isLoading = false,
  onRetry,
  onDelete,
}: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  // Only a brand new latest message should scroll the view. Prepending older
  // messages (pagination) leaves the last id unchanged, so the view stays put.
  const lastMessageId = messages.at(-1)?.id;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [lastMessageId]);

  if (messages.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">
        {isLoading ? "Loading messages…" : "No messages yet. Say hello."}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-4 py-6">
      {messages.map((message) => {
        const isMine = message.sender.id === currentUserId;

        return (
          <div
            key={message.id}
            className={`group flex ${isMine ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm ${
                isMine
                  ? "bg-sky-500 text-white"
                  : "bg-slate-800 text-slate-100"
              }`}
            >
              {!isMine ? (
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
                    className="hidden underline-offset-2 hover:text-white hover:underline group-hover:inline"
                  >
                    Delete
                  </button>
                ) : null}

                <span>{formatTime(message.createdAt)}</span>
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
