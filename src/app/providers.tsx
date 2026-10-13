
"use client";

import type { ReactNode } from "react";
import { SocketProvider } from "../components/providers/SocketProvider";

export default function Providers({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <SocketProvider>
      {children}
    </SocketProvider>
  );
}
