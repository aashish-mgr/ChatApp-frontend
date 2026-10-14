"use client";

import type { ReactNode } from "react";
import { SocketProvider } from "../components/providers/SocketProvider";
import { AuthProvider, useAuth } from "../components/providers/AuthProvider";
import { ToastProvider } from "../components/providers/ToastProvider";
import { ChatProvider } from "../components/providers/ChatProvider";

/**
 * Remounts the chat store whenever the signed-in user changes, so one user's
 * rooms and messages can never leak into another session.
 */
function ChatSession({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return <ChatProvider key={user?.id ?? "anonymous"}>{children}</ChatProvider>;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SocketProvider>
      <AuthProvider>
        <ToastProvider>
          <ChatSession>{children}</ChatSession>
        </ToastProvider>
      </AuthProvider>
    </SocketProvider>
  );
}
