import { io, type Socket } from "socket.io-client";
import type { ClientToServerEvents, ServerToClientEvents } from "../types/chat";

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

const SOCKET_URL =
  process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:3000";

let socket: AppSocket | null = null;
let currentToken: string | null = null;

/**
 * Returns the singleton socket, creating it on first use. The socket is *not*
 * connected automatically (`autoConnect: false`) so we stay in control of when
 * the handshake happens and which token it carries.
 */
export function getSocket(): AppSocket {
  if (!socket) {
    socket = io(SOCKET_URL, {
      autoConnect: false,
      withCredentials: true,
      auth: currentToken ? { token: currentToken } : {},
    });
  }

  return socket;
}

/**
 * Updates the token used in the handshake. Applied to the live socket so the
 * next (re)connection authenticates, and remembered for future reconnects.
 */
export function setSocketToken(token: string | null): void {
  currentToken = token;

  if (socket) {
    socket.auth = token ? { token } : {};
  }
}

/** Connects the socket, optionally (re)setting the token first. */
export function connectSocket(token?: string | null): AppSocket {
  if (token !== undefined) {
    setSocketToken(token);
  }

  const instance = getSocket();
  if (!instance.connected) {
    instance.connect();
  }

  return instance;
}

/** Disconnects the socket but keeps the instance for later reuse. */
export function disconnectSocket(): void {
  socket?.disconnect();
}

/**
 * Resolves once the socket is connected, kicking off the connection if needed.
 * Lets callers safely emit right after a user action without racing the
 * initial handshake.
 */
export function whenConnected(instance: AppSocket = getSocket()): Promise<AppSocket> {
  if (instance.connected) {
    return Promise.resolve(instance);
  }

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      instance.off("connect", handleConnect);
      instance.off("connect_error", handleConnectError);
    };

    const handleConnect = () => {
      cleanup();
      resolve(instance);
    };

    const handleConnectError = (error: Error) => {
      cleanup();
      reject(error);
    };

    instance.on("connect", handleConnect);
    instance.on("connect_error", handleConnectError);
    instance.connect();
  });
}
