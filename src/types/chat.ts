/**
 * Shared chat types + socket contracts, mirrored from the backend
 * (`chat_backend/src/modules/*`). Everything travels over Socket.IO and every
 * client -> server event is answered with an acknowledgement callback.
 *
 * `PayloadMap` and `AckMap` are the single source of truth for the request
 * contract; `ClientToServerEvents` is derived from them so the two can never
 * drift apart.
 */

export interface User {
  id: string;
  username: string;
}

export interface Credentials {
  username: string;
  password: string;
}

export interface Message {
  id: string;
  content: string;
  createdAt: string;
  senderId: string;
  roomId: string;
  sender: User;
}

export interface Room {
  id: string;
  createdAt: string;
  members: User[];
  lastMessage: Message | null;
}

/** Base shape every acknowledgement shares. */
export interface AckResponse {
  status: number;
  message: string;
}

export interface LoginResponse extends AckResponse {
  /** Signed JWT access token. */
  data?: string;
  user?: User;
}

export interface UsersResponse extends AckResponse {
  users?: User[];
}

export interface RoomsResponse extends AckResponse {
  rooms?: Room[];
}

export interface RoomOpenResponse extends AckResponse {
  roomId?: string;
}

export interface MessagesResponse extends AckResponse {
  messages?: Message[];
  nextCursor?: string | null;
  hasMore?: boolean;
}

export interface MessageSendResponse extends AckResponse {
  messageId?: string;
}

export interface AuthError {
  status: number;
  message: string;
}

/** Arguments (excluding the ack) sent with each client -> server event. */
export interface PayloadMap {
  register: [Credentials];
  login: [Credentials];
  "user:list": [];
  "user:search": [{ query: string }];
  "room:open": [string];
  "room:list": [];
  "room:leave": [string];
  "room:delete": [string];
  "message:history": [{ roomId: string; cursor?: string; limit?: number }];
  "message:send": [{ roomId: string; content: string }];
  "message:delete": [string];
}

/** Acknowledgement payload returned for each client -> server event. */
export interface AckMap {
  register: AckResponse;
  login: LoginResponse;
  "user:list": UsersResponse;
  "user:search": UsersResponse;
  "room:open": RoomOpenResponse;
  "room:list": RoomsResponse;
  "room:leave": AckResponse;
  "room:delete": AckResponse;
  "message:history": MessagesResponse;
  "message:send": MessageSendResponse;
  "message:delete": AckResponse;
}

export type ClientToServerEvents = {
  [K in keyof PayloadMap]: (
    ...args: [...PayloadMap[K], (response: AckMap[K]) => void]
  ) => void;
};

export interface ServerToClientEvents {
  "message:new": (message: Message) => void;
  "message:deleted": (payload: { messageId: string }) => void;
  "room:new": (payload: { roomId: string }) => void;
  "room:deleted": (payload: { roomId: string }) => void;
  auth_error: (payload: AuthError) => void;
}
