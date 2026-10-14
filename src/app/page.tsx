"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../components/providers/AuthProvider";
import { useSocket } from "../components/providers/SocketProvider";

export default function HomePage() {
  const router = useRouter();
  const { user, isReady, logout } = useAuth();
  const { isConnected } = useSocket();

  useEffect(() => {
    if (isReady && !user) {
      router.replace("/login");
    }
  }, [isReady, user, router]);

  if (!isReady || !user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-slate-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-10">
      <header className="flex items-center justify-between border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-xl font-semibold">ChatApp</h1>
          <p className="text-sm text-slate-400">
            Signed in as{" "}
            <span className="font-medium text-slate-200">{user.username}</span>
          </p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm font-medium text-slate-300 transition hover:border-slate-500 hover:text-white"
        >
          Log out
        </button>
      </header>

      <section className="mt-8 rounded-xl border border-slate-800 bg-slate-900/50 p-6">
        <p className="flex items-center gap-2 text-sm text-slate-300">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isConnected ? "bg-emerald-500" : "bg-slate-600"
            }`}
          />
          {isConnected ? "Socket connected" : "Socket disconnected"}
        </p>
        <p className="mt-3 text-sm text-slate-400">
          Authentication is wired up. The chat UI (rooms, messages, live
          updates) is the next milestone.
        </p>
      </section>
    </main>
  );
}
