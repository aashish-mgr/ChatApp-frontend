"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "../../types/chat";
import { request } from "../../lib/emit";
import { getSocket, whenConnected } from "../../lib/socket";
import { useChat } from "../providers/ChatProvider";

interface NewChatDialogProps {
  onClose: () => void;
}

export function NewChatDialog({ onClose }: NewChatDialogProps) {
  const router = useRouter();
  const { openRoomWithUser, isUserOnline } = useChat();
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  // Load everyone (empty query) or search as the query changes, debounced.
  useEffect(() => {
    let cancelled = false;

    const handle = setTimeout(async () => {
      setIsLoading(true);
      setError(null);
      try {
        const socket = await whenConnected(getSocket());
        const trimmed = query.trim();
        const res = trimmed
          ? await request(socket, "user:search", { query: trimmed })
          : await request(socket, "user:list");

        if (cancelled) return;

        if (res.status === 200 && res.users) {
          setUsers(res.users);
        } else {
          setError(res.message || "Could not load people.");
        }
      } catch {
        if (!cancelled) setError("Could not load people.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  const handleStart = async (target: User) => {
    setStartingId(target.id);
    setError(null);
    try {
      const roomId = await openRoomWithUser(target);
      onClose();
      router.push(`/chat/${roomId}`);
    } catch (startError) {
      setError(
        startError instanceof Error
          ? startError.message
          : "Could not start the conversation.",
      );
      setStartingId(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="New chat"
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">New chat</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 transition hover:text-white"
          >
            ✕
          </button>
        </div>

        <div className="border-b border-slate-800 p-3">
          <input
            autoFocus
            type="text"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search people…"
            className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500"
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-2">
          {error ? (
            <p className="px-2 py-3 text-sm text-red-400">{error}</p>
          ) : isLoading ? (
            <p className="px-2 py-3 text-sm text-slate-500">Loading…</p>
          ) : users.length === 0 ? (
            <p className="px-2 py-3 text-sm text-slate-500">No people found.</p>
          ) : (
            <ul>
              {users.map((person) => (
                <li key={person.id}>
                  <button
                    type="button"
                    onClick={() => void handleStart(person)}
                    disabled={startingId === person.id}
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-800 disabled:opacity-60"
                  >
                    <span className="relative shrink-0">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold uppercase text-slate-200">
                        {person.username.charAt(0)}
                      </span>
                      {isUserOnline(person.id) ? (
                        <span
                          aria-label="Online"
                          className="absolute -right-0.5 -bottom-0.5 h-2.5 w-2.5 rounded-full border-2 border-slate-900 bg-emerald-500"
                        />
                      ) : null}
                    </span>
                    <span className="truncate text-sm text-slate-100">
                      {person.username}
                    </span>
                    {startingId === person.id ? (
                      <span className="ml-auto text-xs text-slate-400">
                        Starting…
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
