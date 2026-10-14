"use client";

import { useState, type KeyboardEvent } from "react";

interface ComposerProps {
  onSend: (content: string) => Promise<void>;
}

export function Composer({ onSend }: ComposerProps) {
  const [value, setValue] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const content = value.trim();
    if (!content || isSending) return;

    setIsSending(true);
    setError(null);
    try {
      await onSend(content);
      setValue("");
    } catch (sendError) {
      setError(
        sendError instanceof Error
          ? sendError.message
          : "The message could not be sent.",
      );
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void submit();
    }
  };

  return (
    <div className="border-t border-slate-800 p-3">
      {error ? <p className="mb-2 text-xs text-red-400">{error}</p> : null}
      <div className="flex items-end gap-2">
        <textarea
          rows={1}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          className="max-h-32 flex-1 resize-none rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500"
        />
        <button
          type="button"
          onClick={() => void submit()}
          disabled={isSending || !value.trim()}
          className="rounded-xl bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Send
        </button>
      </div>
    </div>
  );
}
