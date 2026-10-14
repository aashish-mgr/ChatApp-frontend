"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/providers/AuthProvider";
import { ChatShell } from "../../components/chat/ChatShell";

/**
 * Shared chrome for every signed-in route: guards the session, then renders
 * the sidebar once and swaps only the main pane between conversations.
 */
export default function ChatLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { user, isReady } = useAuth();

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

  return <ChatShell>{children}</ChatShell>;
}
