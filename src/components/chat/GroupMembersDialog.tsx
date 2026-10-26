"use client";

import { useEffect, useState } from "react";
import type { Room, User } from "../../types/chat";
import { request } from "../../lib/emit";
import { getSocket, whenConnected } from "../../lib/socket";
import { useAuth } from "../providers/AuthProvider";
import { useChat } from "../providers/ChatProvider";
import { useToast } from "../providers/ToastProvider";
import { ConfirmDialog } from "./ConfirmDialog";

interface GroupMembersDialogProps {
  room: Room;
  onClose: () => void;
}

function Avatar({ user }: { user: User }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-700 text-sm font-semibold uppercase text-slate-200">
      {user.username.charAt(0)}
    </span>
  );
}

export function GroupMembersDialog({ room, onClose }: GroupMembersDialogProps) {
  const { user } = useAuth();
  const { addGroupMember, removeGroupMember, isUserOnline } = useChat();
  const { toast } = useToast();
  const [addOpen, setAddOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<User | null>(null);
  const [people, setPeople] = useState<User[]>([]);
  const [isLoadingPeople, setIsLoadingPeople] = useState(false);

  const me = room.members.find((member) => member.id === user?.id);
  const isAdmin = me?.role === "admin";

  const memberIds = new Set(room.members.map((member) => member.id));
  const candidates = people.filter((person) => !memberIds.has(person.id));

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const loadPeople = async () => {
    setIsLoadingPeople(true);
    try {
      const socket = await whenConnected(getSocket());
      const res = await request(socket, "user:list");
      if (res.status === 200 && res.users) {
        setPeople(res.users);
      } else {
        toast(res.message || "Could not load people.", "error");
      }
    } catch {
      toast("Could not load people.", "error");
    } finally {
      setIsLoadingPeople(false);
    }
  };

  const toggleAdd = () => {
    const next = !addOpen;
    setAddOpen(next);
    if (next) void loadPeople();
  };

  const handleAdd = async (person: User) => {
    try {
      await addGroupMember(room.id, person.id);
      toast(`${person.username} added to the group.`, "success");
      setPeople((prev) => prev.filter((item) => item.id !== person.id));
    } catch (error) {
      toast(
        error instanceof Error ? error.message : "Could not add the member.",
        "error",
      );
    }
  };

  const confirmRemove = async () => {
    const target = pendingRemove;
    setPendingRemove(null);
    if (!target) return;
    try {
      await removeGroupMember(room.id, target.id);
      toast(
        target.id === user?.id
          ? "You left the group."
          : `${target.username} removed from the group.`,
        "success",
      );
    } catch (error) {
      toast(
        error instanceof Error
          ? error.message
          : "Could not remove the member.",
        "error",
      );
    }
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4"
        onClick={onClose}
      >
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${room.name ?? "Group"} members`}
          className="flex max-h-[80vh] w-full max-w-md flex-col rounded-2xl border border-slate-800 bg-slate-900 shadow-xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
            <div className="min-w-0">
              <h2 className="truncate text-sm font-semibold text-slate-100">
                {room.name ?? "Group"}
              </h2>
              <p className="text-xs text-slate-500">
                {room.members.length} member
                {room.members.length === 1 ? "" : "s"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="text-slate-400 transition hover:text-white"
            >
              ×
            </button>
          </div>

          {isAdmin ? (
            <div className="border-b border-slate-800 p-3">
              <button
                type="button"
                onClick={toggleAdd}
                className="w-full rounded-lg border border-slate-700 px-3 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 hover:text-white"
              >
                {addOpen ? "Close member search" : "Add member"}
              </button>
              {addOpen ? (
                <div className="mt-2 max-h-44 overflow-y-auto rounded-lg border border-slate-800">
                  {isLoadingPeople ? (
                    <p className="px-3 py-2 text-sm text-slate-500">Loading...</p>
                  ) : candidates.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-slate-500">
                      No more people to add.
                    </p>
                  ) : (
                    <ul>
                      {candidates.map((person) => (
                        <li key={person.id}>
                          <button
                            type="button"
                            onClick={() => void handleAdd(person)}
                            className="flex w-full items-center gap-2 px-3 py-2 text-left transition hover:bg-slate-800"
                          >
                            <Avatar user={person} />
                            <span className="truncate text-sm text-slate-100">
                              {person.username}
                            </span>
                            <span className="ml-auto text-xs font-medium text-sky-400">
                              Add
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}
            </div>
          ) : null}

          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {room.members.map((member) => {
              const canRemove = isAdmin && member.id !== user?.id;
              const isMe = member.id === user?.id;
              return (
                <li
                  key={member.id}
                  className="flex items-center gap-2 rounded-lg px-2 py-2"
                >
                  <Avatar user={member} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm text-slate-100">
                        {member.username}
                        {isMe ? " (you)" : ""}
                      </span>
                      {member.role === "admin" ? (
                        <span className="rounded bg-slate-700 px-1.5 py-0.5 text-[10px] font-semibold tracking-wide text-slate-300 uppercase">
                          Admin
                        </span>
                      ) : null}
                    </span>
                    <span className="block text-xs text-slate-500">
                      {isUserOnline(member.id) ? "Online" : "Offline"}
                    </span>
                  </span>
                  {canRemove ? (
                    <button
                      type="button"
                      onClick={() => setPendingRemove(member)}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs font-medium text-red-400 transition hover:bg-slate-800"
                    >
                      Remove
                    </button>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <ConfirmDialog
        open={pendingRemove !== null}
        title="Remove member"
        message={`Remove ${pendingRemove?.username ?? "this member"} from the group?`}
        confirmLabel="Remove"
        destructive
        onConfirm={() => void confirmRemove()}
        onCancel={() => setPendingRemove(null)}
      />
    </>
  );
}
