"use client";

import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
  type KeyboardEvent,
} from "react";
import type { Attachment } from "../../types/chat";
import {
  ATTACHMENT_ACCEPT,
  formatFileSize,
  validateAttachment,
} from "../../lib/attachments";

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

/** A file that is currently being uploaded. */
interface UploadingFile {
  filename: string;
  size: number;
  /** Progress of the upload, 0-100. */
  percent: number;
}

interface ComposerProps {
  onSend: (content: string, attachment?: Attachment | null) => void;
  /** Reports typing state changes; used to drive the peer's indicator. */
  onTypingChange: (typing: boolean) => void;
  /** Uploads a file and resolves with the stored attachment. */
  onAttach: (
    file: File,
    onProgress: (percent: number) => void,
  ) => Promise<Attachment>;
  /** Reports a problem the user should know about (e.g. a rejected file). */
  onError?: (message: string) => void;
}

export function Composer({
  onSend,
  onTypingChange,
  onAttach,
  onError,
}: ComposerProps) {
  const [value, setValue] = useState("");
  const [staged, setStaged] = useState<Attachment | null>(null);
  const [uploading, setUploading] = useState<UploadingFile | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Guards against a second upload starting before the first one reported
  // back; the state update alone would arrive too late.
  const isUploadingRef = useRef(false);

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

  /** Uploads a picked (or dropped) file and stages it for the next message. */
  const attach = async (file: File) => {
    if (isUploadingRef.current) return;

    const problem = validateAttachment(file);
    if (problem) {
      onError?.(problem);
      return;
    }

    isUploadingRef.current = true;
    setUploading({ filename: file.name, size: file.size, percent: 0 });
    try {
      const attachment = await onAttach(file, (percent) => {
        setUploading((prev) => (prev ? { ...prev, percent } : prev));
      });
      setStaged(attachment);
    } catch (error) {
      onError?.(
        error instanceof Error ? error.message : "The file could not be uploaded.",
      );
    } finally {
      isUploadingRef.current = false;
      setUploading(null);
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Reset the input so picking the same file again still fires a change.
    event.target.value = "";
    if (file) void attach(file);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) void attach(file);
  };

  const removeStaged = () => {
    setStaged(null);
  };

  const submit = () => {
    const content = value.trim().slice(0, MAX_MESSAGE_LENGTH);
    if (!content && !staged) return;

    setValue("");
    const element = textareaRef.current;
    if (element) element.style.height = "auto";
    // A sent message ends the typing signal immediately.
    stopTyping();
    // Sending is optimistic: the message renders immediately and reports its
    // own status, so the composer does not need to wait or lock.
    const attachment = staged;
    setStaged(null);
    onSend(content, attachment);
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
  const isDisabled = (!value.trim() && !staged) || isOverLimit || !!uploading;

  return (
    <div
      className={`border-t border-slate-800 p-3 transition ${
        isDragging ? "border-sky-500 bg-sky-950/20" : ""
      }`}
      onDragOver={(event) => {
        event.preventDefault();
        setIsDragging(true);
      }}
      onDragLeave={(event) => {
        // Only stop the highlight when the pointer really leaves the composer;
        // it also fires while moving over the textarea.
        if (event.relatedTarget && event.currentTarget.contains(event.relatedTarget as Node)) {
          return;
        }
        setIsDragging(false);
      }}
      onDrop={handleDrop}
    >
      {uploading || staged ? (
        <div className="mb-2 flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2">
          <span aria-hidden="true" className="text-slate-400">
            📎
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm text-slate-100">
              {uploading ? uploading.filename : staged?.filename}
            </span>
            <span className="block text-xs text-slate-500">
              {formatFileSize(uploading ? uploading.size : (staged?.size ?? 0))}
              {uploading ? ` · uploading ${uploading.percent}%` : ""}
            </span>
          </span>
          {uploading ? (
            <span
              role="progressbar"
              aria-valuenow={uploading.percent}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Upload progress"
              className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-700"
            >
              <span
                className="block h-full rounded-full bg-sky-500 transition-[width]"
                style={{ width: `${uploading.percent}%` }}
              />
            </span>
          ) : (
            <button
              type="button"
              onClick={removeStaged}
              aria-label="Remove attachment"
              className="rounded-lg px-2 py-1 text-xs font-medium text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              Remove
            </button>
          )}
        </div>
      ) : null}

      <div className="flex items-end gap-2">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={!!uploading}
          aria-label="Attach a file"
          title="Attach a file"
          className="shrink-0 rounded-xl border border-slate-700 px-3 py-2 text-slate-400 transition hover:border-slate-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          📎
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ATTACHMENT_ACCEPT}
          onChange={handleFileChange}
          className="hidden"
          tabIndex={-1}
        />

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
          {uploading ? "Uploading…" : "Send"}
        </button>
      </div>
    </div>
  );
}
