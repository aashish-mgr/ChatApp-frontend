"use client";

import { useEffect, useRef, useState, type KeyboardEvent } from "react";

/** Matches the backend's `message:send` content limit. */
export const MAX_MESSAGE_LENGTH = 4000;

/**
 * How long to wait after the last keystroke before announcing "typing". Keeps
 * the first signal snappy without emitting on every single key.
 */
const TYPING_START_DEBOUNCE_MS = 150;

/**
 * Minimum gap between `typing:start` refreshes while the user keeps typing.
 * The server drops a typist after its own TTL (~3s), so a refresh well inside
 * that window keeps the indicator alive without per-keystroke chatter.
 */
const TYPING_REFRESH_MS = 2000;

interface ComposerProps {
  onSend: (content: string) => void;
  /** Reports typing state changes; used to drive the peer's indicator. */
  onTypingChange: (typing: boolean) => void;
}

export function Composer({ onSend, onTypingChange }: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Typing-signal bookkeeping. Kept in refs because the callbacks read the
  // latest values without needing to re-bind the textarea handlers.
  const isTypingRef = useRef(false);
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refreshTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onTypingChangeRef = useRef(onTypingChange);

  useEffect(() => {
    onTypingChangeRef.current = onTypingChange;
  }, [onTypingChange]);

  const stopTyping = () => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    if (refreshTimerRef.current) {
      clearInterval(refreshTimerRef.current);
      refreshTimerRef.current = null;
    }
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingChangeRef.current(false);
    }
  };

  const startTyping = () => {
    if (isTypingRef.current) return;
    isTypingRef.current = true;
    onTypingChangeRef.current(true);
    // Keep the signal fresh while the user keeps typing; the server expires a
    // typist after its TTL, so a refresh inside that window holds it open.
    refreshTimerRef.current = setInterval(() => {
      onTypingChangeRef.current(true);
    }, TYPING_REFRESH_MS);
  };

  // Cancel any pending timers on unmount, and never leave the peer's indicator
  // stuck on when the composer goes away.
  useEffect(
    () => () => {
      if (startTimerRef.current) clearTimeout(startTimerRef.current);
      if (refreshTimerRef.current) clearInterval(refreshTimerRef.current);
      if (isTypingRef.current) onTypingChangeRef.current(false);
    },
    [],
  );

  const handleInput = (next: string) => {
    setValue(next);
    resize();

    if (!next.trim()) {
      // Empty (or whitespace-only) draft: nothing worth announcing.
      stopTyping();
      return;
    }

    if (isTypingRef.current) return; // Refresh interval already running.
    if (startTimerRef.current) clearTimeout(startTimerRef.current);
    startTimerRef.current = setTimeout(() => {
      startTimerRef.current = null;
      startTyping();
    }, TYPING_START_DEBOUNCE_MS);
  };

  const resize = () => {
    const element = textareaRef.current;
    if (!element) return;
    element.style.height = "auto";
    element.style.height = `${Math.min(element.scrollHeight, 128)}px`;
  };

  const submit = () => {
    const content = value.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!content) return;

    setValue("");
    const element = textareaRef.current;
    if (element) element.style.height = "auto";
    // A sent message ends the typing signal immediately.
    stopTyping();
    // Sending is optimistic: the message renders immediately and reports its
    // own status, so the composer does not need to wait or lock.
    onSend(content);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    // `isComposing`: Enter must confirm an IME candidate (e.g. Japanese or
    // Chinese input) instead of sending the half-typed message.
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault();
      submit();
    }
  };

  const isOverLimit = value.length > MAX_MESSAGE_LENGTH;
  const isDisabled = !value.trim() || isOverLimit;

  return (
    <div className="border-t border-slate-800 p-3">
      <div className="flex items-end gap-2">
        <div className="min-w-0 flex-1">
          <textarea
            ref={textareaRef}
            rows={1}
            value={value}
            onChange={(event) => handleInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message…"
            aria-label="Message"
            className="max-h-32 w-full resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500"
          />
          {isOverLimit ? (
            <p className="mt-1 text-right text-xs text-red-400">
              {value.length}/{MAX_MESSAGE_LENGTH}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={submit}
          disabled={isDisabled}
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
