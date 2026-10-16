"use client";

import { useRef, useState, type KeyboardEvent } from "react";

/** Matches the backend's `message:send` content limit. */
export const MAX_MESSAGE_LENGTH = 4000;

interface ComposerProps {
  onSend: (content: string) => void;
}

export function Composer({ onSend }: ComposerProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

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
            onChange={(event) => {
              setValue(event.target.value);
              resize();
            }}
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
