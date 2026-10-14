import type { AppSocket } from "./socket";
import type { AckMap, PayloadMap } from "../types/chat";

/** How long to wait for a server acknowledgement before giving up. */
export const ACK_TIMEOUT_MS = 10_000;

export class SocketTimeoutError extends Error {
  constructor(event: string) {
    super(`Timed out waiting for a "${event}" acknowledgement.`);
    this.name = "SocketTimeoutError";
  }
}

type EmitWithAck = <K extends keyof PayloadMap>(
  event: K,
  ...args: unknown[]
) => Promise<AckMap[K]>;

/**
 * Emits a client -> server event and resolves with its acknowledgement.
 *
 * The backend answers every request through the ack callback, so this turns the
 * callback style into a normal promise. A `.timeout()` guard means a request
 * that never gets an answer rejects instead of hanging forever.
 *
 *   const res = await request(socket, "login", { username, password });
 */
export function request<K extends keyof PayloadMap>(
  socket: AppSocket,
  event: K,
  ...args: PayloadMap[K]
): Promise<AckMap[K]> {
  const emitter = socket.timeout(ACK_TIMEOUT_MS) as unknown as {
    emitWithAck: EmitWithAck;
  };

  return (
    emitter.emitWithAck(event, ...args) as Promise<AckMap[K]>
  ).catch((error: unknown) => {
    if (error instanceof Error && error.message.includes("timed out")) {
      throw new SocketTimeoutError(String(event));
    }
    throw error;
  });
}
