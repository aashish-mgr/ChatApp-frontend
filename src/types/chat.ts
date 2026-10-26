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
  /** ISO timestamp of account creation, when the server provides it. */
  createdAt?: string;
}

export interface Credentials {
  username: string;
  password: string;
}

/** A file uploaded to a conversation. */
export interface Attachment {
  id: string;
  /** Name of the file as it was uploaded. */
  filename: string;
  mimeType: string;
  /** Size in bytes. */
  size: number;
  /** Path the file can be fetched from. */
  url: string;
}

export interface Message {
  id: string;
  content: string;
  createdAt: string;
  /** Set when the sender edited the message; null/absent when never edited. */
  editedAt?: string | null;
  senderId: string;
  roomId: string;
  sender: User;
  /** The file carried by the message, when it has one. */
  attachment?: Attachment | null;
  /**
   * Client-only delivery state for optimistic messages. Absent on messages
   * that came from the server.
   */
  clientStatus?: "sending" | "failed";
}

export interface Room {
  id: string;
  name?: string | null;
  isGroup?: boolean;
  createdAt: string;
  members: User[];
  lastMessage: Message | null;
  /** Messages from others the current user hasn't read yet. */
  unreadCount: number;
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

export interface PresenceListResponse extends AckResponse {
  /** Ids of the users currently online. */
  onlineUserIds?: string[];
}

/** Broadcast when a room member starts (`typing: true`) or stops typing. */
export interface TypingState {
  roomId: string;
  userId: string;
  typing: boolean;
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
  "room:createGroup": [{ name: string; memberIds: string[] }];
  "room:addMember": [{ roomId: string; userId: string }];
  "room:removeMember": [{ roomId: string; userId: string }];
  "room:list": [];
  "room:read": [string];
  "room:leave": [string];
  "room:delete": [string];
  "message:history": [{ roomId: string; cursor?: string; limit?: number }];
  "message:send": [
    {
      roomId: string;
      content: string;
      /** The file to attach, uploaded beforehand. */
      attachmentId?: string;
    },
  ];
  "message:update": [{ messageId: string; content: string }];
  "message:delete": [string];
  "presence:list": [];
}

/**
 * Client -> server events that are fire-and-forget: they carry no ack callback.
 *
 * Typing signals are ephemeral and lossy-tolerant (the server clears stale
 * state on its own timeout), so a dropped signal is harmless — no round-trip
 * worth waiting on. Kept separate from `PayloadMap`, whose mapped type appends
 * an acknowledgement callback to every event.
 */
export interface FireAndForgetClientEvents {
  "typing:start": (payload: { roomId: string }) => void;
  "typing:stop": (payload: { roomId: string }) => void;
}

/** Acknowledgement payload returned for each client -> server event. */
export interface AckMap {
  register: AckResponse;
  login: LoginResponse;
  "user:list": UsersResponse;
  "user:search": UsersResponse;
  "room:open": RoomOpenResponse;
  "room:createGroup": RoomOpenResponse;
  "room:addMember": AckResponse;
  "room:removeMember": AckResponse;
  "room:list": RoomsResponse;
  "room:leave": AckResponse;
  "room:delete": AckResponse;
  "room:read": AckResponse;
  "message:history": MessagesResponse;
  "message:send": MessageSendResponse;
  "message:update": AckResponse;
  "message:delete": AckResponse;
  "presence:list": PresenceListResponse;
}

export type ClientToServerEvents = {
  [K in keyof PayloadMap]: (
    ...args: [...PayloadMap[K], (response: AckMap[K]) => void]
  ) => void;
} & FireAndForgetClientEvents;

export interface ServerToClientEvents {
  "message:new": (message: Message) => void;
  "message:updated": (message: Message) => void;
  "message:deleted": (payload: { messageId: string }) => void;
  /** Broadcast when a room member starts or stops typing. */
  "typing:state": (payload: TypingState) => void;
  "room:new": (payload: { roomId: string }) => void;
  "room:deleted": (payload: { roomId: string }) => void;
  /** Sent to every device of a user when one of them reads a room. */
  "room:read": (payload: { roomId: string }) => void;
  "room:memberAdded": (payload: { roomId: string; userId: string }) => void;
  "room:memberRemoved": (payload: { roomId: string; userId: string }) => void;
  "presence:update": (payload: { userId: string; online: boolean }) => void;
  auth_error: (payload: AuthError) => void;
}
