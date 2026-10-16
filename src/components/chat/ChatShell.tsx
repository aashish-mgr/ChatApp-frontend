"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "../providers/AuthProvider";
import { useSocket } from "../providers/SocketProvider";
import { RoomList } from "./RoomList";
import { NewChatDialog } from "./NewChatDialog";
import { activeRoomIdFromPath } from "../../lib/navigation";

export function ChatShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const pathname = usePathname();
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  const isRoomOpen = activeRoomIdFromPath(pathname) !== null;

  return (
    <div className="flex h-screen w-full overflow-hidden">
      {/* Sidebar: full width on mobile until a room is open. */}
      <aside
        className={`${
          isRoomOpen ? "hidden md:flex" : "flex"
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
          <h2 className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
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
        className={`${
          isRoomOpen ? "flex" : "hidden md:flex"
        } min-w-0 flex-1 flex-col`}
      >
        {!isConnected ? (
          <div
            role="status"
            className="border-b border-amber-900/60 bg-amber-950/40 px-4 py-1.5 text-center text-xs text-amber-200"
          >
            Reconnecting… messages sent now may fail — use Retry once
            you&apos;re back online.
          </div>
        ) : null}

        <div className="flex min-h-0 flex-1 flex-col">{children}</div>
      </main>

      {isNewChatOpen ? (
        <NewChatDialog onClose={() => setIsNewChatOpen(false)} />
      ) : null}
    </div>
  );
}
