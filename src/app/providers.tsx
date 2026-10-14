"use client";

import type { ReactNode } from "react";
import { SocketProvider } from "../components/providers/SocketProvider";
import { AuthProvider } from "../components/providers/AuthProvider";

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <SocketProvider>
      <AuthProvider>{children}</AuthProvider>
    </SocketProvider>
  );
}
