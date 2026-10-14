"use client";

import { useState } from "react";
import { useAuth } from "../providers/AuthProvider";
import { useChat } from "../providers/ChatProvider";
import { useSocket } from "../providers/SocketProvider";
import { RoomList } from "./RoomList";
import { MessagePane } from "./MessagePane";
import { NewChatDialog } from "./NewChatDialog";

export function ChatShell() {
  const { user, logout } = useAuth();
  const { activeRoom } = useChat();
  const { isConnected } = useSocket();
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar: full width on mobile until a room is open. */}
      <aside
        className={`${
          activeRoom ? "hidden md:flex" : "flex"
        } w-full flex-col border-r border-slate-800 bg-slate-950 md:w-80 md:shrink-0`}
      >
        <header className="flex items-center justify-between border-b border-slate-800 px-4 py-3">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-100">
              {user?.username}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-slate-500">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isConnected ? "bg-emerald-500" : "bg-slate-600"
                }`}
              />
              {isConnected ? "Online" : "Connecting…"}
            </p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
          >
            Log out
          </button>
        </header>

        <div className="flex items-center justify-between px-4 py-3">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Chats
          </h2>
          <button
            type="button"
            onClick={() => setIsNewChatOpen(true)}
            className="rounded-lg bg-sky-500 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-sky-400"
          >
            New
          </button>
        </div>

        <RoomList />
      </aside>

      {/* Main pane. */}
      <main
        className={`${activeRoom ? "flex" : "hidden md:flex"} min-w-0 flex-1`}
      >
        {activeRoom ? (
          <MessagePane room={activeRoom} />
        ) : (
          <div className="flex flex-1 items-center justify-center px-6 text-center">
            <p className="text-sm text-slate-500">
              Select a conversation, or start a new one.
            </p>
          </div>
        )}
      </main>

      {isNewChatOpen ? (
        <NewChatDialog onClose={() => setIsNewChatOpen(false)} />
      ) : null}
    </div>
  );
}
