
"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Socket } from "socket.io-client";
import { getSocket } from "../../lib/socket";

const SocketContext = createContext<Socket | null>(null);

export function SocketProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const currentSocket = getSocket();

    const handleConnect = () => {
      console.log("Connected:", currentSocket.id);
      setSocket(currentSocket);
    };

    const handleDisconnect = (reason: string) => {
      console.log("Disconnected:", reason);
      setSocket(null);
    };

    const handleConnectError = (error: Error) => {
      console.error("Connection failed:", error.message);
    };

    currentSocket.on("connect", handleConnect);
    currentSocket.on("disconnect", handleDisconnect);
    currentSocket.on("connect_error", handleConnectError);

    currentSocket.connect();

    return () => {
      currentSocket.off("connect", handleConnect);
      currentSocket.off("disconnect", handleDisconnect);
      currentSocket.off("connect_error", handleConnectError);
      currentSocket.disconnect();
    };
  }, []);

  return (
    <SocketContext.Provider value={socket}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
