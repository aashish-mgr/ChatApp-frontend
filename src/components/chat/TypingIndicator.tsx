"use client";

import type { User } from "../../types/chat";

interface TypingIndicatorProps {
  /** Other members currently typing, in display order. */
  users: User[];
}

/**
 * Animated "…is typing" bubble shown under the newest message. Renders nothing
 * when nobody is typing so it never occupies space in the flow.
 */
export function TypingIndicator({ users }: TypingIndicatorProps) {
  if (users.length === 0) return null;

  const label =
    users.length === 1
      ? `${users[0].username} is typing`
      : `${users.map((user) => user.username).join(", ")} are typing`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-2 pt-1"
    >
      <span className="inline-flex items-center gap-1 rounded-2xl bg-slate-800 px-3.5 py-2.5">
        <span className="sr-only">{label}</span>
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            aria-hidden="true"
            style={{ animationDelay: `${index * 150}ms` }}
            className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"
          />
        ))}
      </span>
      <span className="text-xs text-slate-500">{label}…</span>
    </div>
  );
}
