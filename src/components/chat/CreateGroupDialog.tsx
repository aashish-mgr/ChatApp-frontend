"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "../../types/chat";
import { request } from "../../lib/emit";
import { getSocket, whenConnected } from "../../lib/socket";
import { useChat } from "../providers/ChatProvider";

interface CreateGroupDialogProps {
  onClose: () => void;
}

export function CreateGroupDialog({ onClose }: CreateGroupDialogProps) {
  const router = useRouter();
  const { createGroup, isUserOnline } = useChat();
  const [step, setStep] = useState<"details" | "members">("details");
  const [groupName, setGroupName] = useState("");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<User[]>([]);
  const [selected, setSelected] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

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

  const toggleUser = (user: User) => {
    setSelected((prev) => {
      const exists = prev.find((u) => u.id === user.id);
      if (exists) {
        return prev.filter((u) => u.id !== user.id);
      }
      return [...prev, user];
    });
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setError("Please provide a group name.");
      return;
    }
    if (selected.length === 0) {
      setError("Select at least one member.");
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const roomId = await createGroup(
        groupName.trim(),
        selected.map((u) => u.id),
      );
      onClose();
      router.push(`/chat/${roomId}`);
    } catch (createError) {
      setError(
        createError instanceof Error
          ? createError.message
          : "Could not create the group.",
      );
      setCreating(false);
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
        aria-label="Create group"
        className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-100">
            {step === "details" ? "New group" : "Add members"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-400 transition hover:text-white"
          >
            ×
          </button>
        </div>

        {step === "details" ? (
          <>
            <div className="border-b border-slate-800 p-3">
              <input
                autoFocus
                type="text"
                value={groupName}
                onChange={(event) => setGroupName(event.target.value)}
                placeholder="Group name..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500"
              />
            </div>
            <div className="flex justify-end gap-2 px-4 py-3">
              {error ? <p className="mr-auto text-sm text-red-400">{error}</p> : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:text-white"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!groupName.trim()) {
                    setError("Please provide a group name.");
                    return;
                  }
                  setError(null);
                  setStep("members");
                }}
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-sky-400"
              >
                Next
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="border-b border-slate-800 p-3">
              <input
                autoFocus
                type="text"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search people..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500"
              />
              {selected.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-2">
                  {selected.map((user) => (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => toggleUser(user)}
                      className="flex items-center gap-1 rounded-full bg-sky-500/20 px-2 py-1 text-xs text-sky-300"
                    >
                      {user.username} ×
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {error ? (
                <p className="px-2 py-3 text-sm text-red-400">{error}</p>
              ) : isLoading ? (
                <p className="px-2 py-3 text-sm text-slate-500">Loading...</p>
              ) : users.length === 0 ? (
                <p className="px-2 py-3 text-sm text-slate-500">No people found.</p>
              ) : (
                <ul>
                  {users.map((person) => {
                    const isSelected = selected.some((u) => u.id === person.id);
                    return (
                      <li key={person.id}>
                        <button
                          type="button"
                          onClick={() => toggleUser(person)}
                          className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-slate-800"
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
                          {isSelected ? (
                            <span className="ml-auto text-xs font-semibold text-sky-400">
                              Selected
                            </span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t border-slate-800 px-4 py-3">
              <button
                type="button"
                onClick={() => setStep("details")}
                className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm text-slate-300 transition hover:text-white"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => void handleCreate()}
                disabled={creating || selected.length === 0}
                className="rounded-lg bg-sky-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:opacity-60"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
