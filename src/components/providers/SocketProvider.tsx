"use client";

import {
  createContext,
  useContext,
  useEffect,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { connectSocket, getSocket } from "../../lib/socket";
import { readStoredToken } from "../../lib/session";

interface SocketContextValue {
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ isConnected: false });

// Stable references so `useSyncExternalStore` is not resubscribed every render.
const subscribeConnection = (onChange: () => void) => {
  const instance = getSocket();
  instance.on("connect", onChange);
  instance.on("disconnect", onChange);
  return () => {
    instance.off("connect", onChange);
    instance.off("disconnect", onChange);
  };
};

const getConnectedSnapshot = () => getSocket().connected;
const getConnectedServerSnapshot = () => false;

export function SocketProvider({ children }: { children: ReactNode }) {
  const isConnected = useSyncExternalStore(
    subscribeConnection,
    getConnectedSnapshot,
    getConnectedServerSnapshot,
  );

  useEffect(() => {
    const instance = getSocket();

    const handleConnectError = (error: Error) => {
      console.error("Socket connection failed:", error.message);
    };

    instance.on("connect_error", handleConnectError);

    // Restore the session token (if any) before the handshake so a returning
    // user is authenticated as soon as the socket connects. This drives an
    // external system, so it belongs in an effect.
    connectSocket(readStoredToken());

    return () => {
      instance.off("connect_error", handleConnectError);
    };
  }, []);

  return (
    <SocketContext.Provider value={{ isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
