"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Attachment, Message, Room, TypingState, User } from "../../types/chat";
import { request } from "../../lib/emit";
import { getSocket, whenConnected } from "../../lib/socket";
import {
  uploadAttachment as uploadAttachmentRequest,
  type UploadProgress,
} from "../../lib/api";
import {
  applyTypingState,
  pruneExpiredTyping,
  typingUserIdsIn,
  type TypingStore,
} from "../../lib/typing";
import { useAuth } from "./AuthProvider";
import { useSocket } from "./SocketProvider";

const HISTORY_PAGE_SIZE = 50;

/** How often the typing store is swept for locally-expired signals. */
const PRUNE_TYPING_INTERVAL_MS = 2000;

interface RoomHistory {
  /** Oldest first, ready for rendering top-to-bottom. */
  messages: Message[];
  nextCursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
  /** Set when the initial load failed, so the UI can offer a retry. */
  error: string | null;
}

/** What a consumer needs to render one room's history. */
export interface RoomHistoryView {
  messages: Message[];
  hasMore: boolean;
  isLoading: boolean;
  error: string | null;
}

type RoomsStatus = "loading" | "ready" | "error";

interface ChatContextValue {
  rooms: Room[];
  roomsStatus: RoomsStatus;
  isUserOnline: (userId: string) => boolean;
  refreshRooms: () => Promise<void>;
  /** Marks a room as the live one: joins its channel and loads its history. */
  activateRoom: (roomId: string) => void;
  getRoomHistory: (roomId: string) => RoomHistoryView;
  /** Re-runs a failed initial history load. */
  retryHistory: (roomId: string) => Promise<void>;
  /** Opens (or creates) the 1:1 room with a user and returns its id. */
  openRoomWithUser: (target: User) => Promise<string>;
  loadOlder: (roomId: string) => Promise<void>;
  /**
   * Sends a message. `attachment` is the file that was uploaded beforehand;
   * the message may carry text, a file, or both.
   */
  sendMessage: (
    roomId: string,
    content: string,
    attachment?: Attachment | null,
  ) => Promise<void>;
  retryMessage: (roomId: string, messageId: string) => Promise<void>;
  /**
   * Uploads a file to a room and returns it, so it can be attached to the
   * next message.
   */
  uploadAttachment: (
    roomId: string,
    file: File,
    onProgress?: (progress: UploadProgress) => void,
  ) => Promise<Attachment>;
  /** Edits one of the current user's messages; the room is notified. */
  editMessage: (messageId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
  /** Removes the current user's membership of a room. */
  leaveRoom: (roomId: string) => Promise<void>;
  /** Deletes the room (and its messages) for every member. */
  deleteRoom: (roomId: string) => Promise<void>;
  /** Ids of other members currently typing in a room (self excluded). */
  getTypingUserIds: (roomId: string) => string[];
  /**
   * Announces the current user's typing state for a room. Ephemeral and
   * fire-and-forget: it is a no-op while disconnected and needs no await.
   */
  setTyping: (roomId: string, typing: boolean) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const emptyHistory = (): RoomHistory => ({
  messages: [],
  nextCursor: null,
  hasMore: false,
  isLoading: false,
  error: null,
});

const othersIn = (room: Room, currentUserId: string | undefined): User[] =>
  room.members.filter((member) => member.id !== currentUserId);

/** Zeroes a room's badge without touching the server. */
const clearUnread = (rooms: Room[], roomId: string): Room[] =>
  rooms.some((room) => room.id === roomId && room.unreadCount > 0)
    ? rooms.map((room) =>
        room.id === roomId ? { ...room, unreadCount: 0 } : room,
      )
    : rooms;

let tempCounter = 0;
const makeTempId = (): string => {
  tempCounter += 1;
  return `temp-${Date.now()}-${tempCounter}`;
};

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, token } = useAuth();
  const { isConnected } = useSocket();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsStatus, setRoomsStatus] = useState<RoomsStatus>("loading");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, RoomHistory>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [typingStore, setTypingStore] = useState<TypingStore>(() => ({}));

  // Rooms whose initial history has been requested, so we never fetch twice.
  const requestedRooms = useRef<Set<string>>(new Set());
  // Latest history, for reads that must not re-run an effect on every message.
  const historyRef = useRef<Record<string, RoomHistory>>({});
  // Maps a server message id back to the optimistic message it confirms.
  const pendingByServerId = useRef<Map<string, string>>(new Map());
  // The open room, readable from socket handlers without re-subscribing them.
  const activeRoomIdRef = useRef<string | null>(null);

  const currentUserId = user?.id;

  useEffect(() => {
    historyRef.current = history;
  }, [history]);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  const refreshRooms = useCallback(async () => {
    try {
      const socket = await whenConnected(getSocket());
      const res = await request(socket, "room:list");

      if (res.status === 200 && res.rooms) {
        setRooms(res.rooms);
        setRoomsStatus("ready");
      } else {
        setRoomsStatus("error");
      }
    } catch {
      setRoomsStatus("error");
    }
  }, []);

  const refreshPresence = useCallback(async () => {
    try {
      const socket = await whenConnected(getSocket());
      const res = await request(socket, "presence:list");

      if (res.status === 200 && res.onlineUserIds) {
        setOnlineUserIds(new Set(res.onlineUserIds));
      }
    } catch {
      // Presence is best-effort; keep the last known state on failure.
    }
  }, []);

  const loadMessages = useCallback(async (roomId: string) => {
    if (requestedRooms.current.has(roomId)) return;
    requestedRooms.current.add(roomId);

    // The request itself succeeded but the server refused (403/404/...):
    // surface its message. Timeouts and network failures get a friendlier one.
    const failWith = (message: string) => {
      requestedRooms.current.delete(roomId);
      setHistory((prev) => ({
        ...prev,
        [roomId]: {
          ...(prev[roomId] ?? emptyHistory()),
          isLoading: false,
          error: message,
        },
      }));
    };

    setHistory((prev) => ({
      ...prev,
      [roomId]: {
        ...(prev[roomId] ?? emptyHistory()),
        isLoading: true,
        error: null,
      },
    }));

    try {
      const socket = await whenConnected(getSocket());
      const res = await request(socket, "message:history", {
        roomId,
        limit: HISTORY_PAGE_SIZE,
      });

      if (res.status !== 200 || !res.messages) {
        failWith(res.message || "Could not load messages.");
        return;
      }

      // The API returns newest first; the UI wants oldest first.
      const messages = [...res.messages].reverse();
      setHistory((prev) => ({
        ...prev,
        [roomId]: {
          messages,
          nextCursor: res.nextCursor ?? null,
          hasMore: Boolean(res.hasMore),
          isLoading: false,
          error: null,
        },
      }));
    } catch {
      failWith("Could not load messages. Check your connection and retry.");
    }
  }, []);

  /** Clears a room's badge locally and on the server (and other devices). */
  const markRoomRead = useCallback(async (roomId: string) => {
    setRooms((prev) => clearUnread(prev, roomId));
    try {
      const socket = await whenConnected(getSocket());
      await request(socket, "room:read", roomId);
    } catch {
      // Best-effort: room:list reconciles the real counts.
    }
  }, []);

  const activateRoom = useCallback(
    (roomId: string) => {
      setActiveRoomId(roomId);
      void loadMessages(roomId);
      void markRoomRead(roomId);
    },
    [loadMessages, markRoomRead],
  );

  const loadOlder = useCallback(
    async (roomId: string) => {
      const current = history[roomId];
      if (
        !current ||
        current.isLoading ||
        !current.hasMore ||
        !current.nextCursor
      ) {
        return;
      }

      const cursor = current.nextCursor;
      setHistory((prev) => ({
        ...prev,
        [roomId]: { ...prev[roomId], isLoading: true },
      }));

      try {
        const socket = await whenConnected(getSocket());
        const res = await request(socket, "message:history", {
          roomId,
          cursor,
          limit: HISTORY_PAGE_SIZE,
        });

        if (res.status !== 200 || !res.messages) {
          setHistory((prev) => ({
            ...prev,
            [roomId]: { ...prev[roomId], isLoading: false },
          }));
          return;
        }

        const older = [...res.messages].reverse();
        setHistory((prev) => ({
          ...prev,
          [roomId]: {
            ...prev[roomId],
            messages: [...older, ...prev[roomId].messages],
            nextCursor: res.nextCursor ?? null,
            hasMore: Boolean(res.hasMore),
            isLoading: false,
            error: null,
          },
        }));
      } catch {
        setHistory((prev) => ({
          ...prev,
          [roomId]: { ...prev[roomId], isLoading: false },
        }));
      }
    },
    [history],
  );

  const openRoomWithUser = useCallback(
    async (target: User) => {
      const socket = await whenConnected(getSocket());
      const res = await request(socket, "room:open", target.id);
      if (res.status !== 200 || !res.roomId) {
        throw new Error(res.message || "Could not open the conversation.");
      }

      const roomId = res.roomId;
      if (user) {
        // Show the conversation immediately; refreshRooms() reconciles.
        setRooms((prev) =>
          prev.some((room) => room.id === roomId)
            ? prev
            : [
                {
                  id: roomId,
                  createdAt: new Date().toISOString(),
                  members: [user, target],
                  lastMessage: null,
                  unreadCount: 0,
                },
                ...prev,
              ],
        );
      }

      void refreshRooms();
      return roomId;
    },
    [user, refreshRooms],
  );

  /** Sends `content` and reconciles the optimistic message with the server. */
  const deliver = useCallback(
    async (
      roomId: string,
      tempId: string,
      content: string,
      attachmentId?: string,
    ) => {
      const markFailed = () => {
        setHistory((prev) => {
          const room = prev[roomId];
          if (!room) return prev;
          return {
            ...prev,
            [roomId]: {
              ...room,
              messages: room.messages.map((item) =>
                item.id === tempId
                  ? { ...item, clientStatus: "failed" as const }
                  : item,
              ),
            },
          };
        });
      };

      try {
        const socket = await whenConnected(getSocket());
        const res = await request(socket, "message:send", {
          roomId,
          content,
          ...(attachmentId ? { attachmentId } : {}),
        });

        if (res.status !== 200 || !res.messageId) {
          markFailed();
          return;
        }

        const serverId = res.messageId;
        const alreadyArrived =
          historyRef.current[roomId]?.messages.some(
            (item) => item.id === serverId,
          ) ?? false;

        if (alreadyArrived) {
          // The broadcast beat the ack: drop the optimistic copy.
          setHistory((prev) => {
            const room = prev[roomId];
            if (!room) return prev;
            return {
              ...prev,
              [roomId]: {
                ...room,
                messages: room.messages.filter((item) => item.id !== tempId),
              },
            };
          });
        } else {
          pendingByServerId.current.set(serverId, tempId);
        }
      } catch {
        markFailed();
      }
    },
    [],
  );

  const sendMessage = useCallback(
    async (
      roomId: string,
      content: string,
      attachment?: Attachment | null,
    ) => {
      const trimmed = content.trim();
      if (!roomId || (!trimmed && !attachment) || !user) return;

      const tempId = makeTempId();
      const optimistic: Message = {
        id: tempId,
        content: trimmed,
        createdAt: new Date().toISOString(),
        senderId: user.id,
        roomId,
        sender: user,
        attachment: attachment ?? null,
        clientStatus: "sending",
      };

      setHistory((prev) => {
        const room = prev[roomId] ?? emptyHistory();
        return {
          ...prev,
          [roomId]: { ...room, messages: [...room.messages, optimistic] },
        };
      });

      await deliver(roomId, tempId, trimmed, attachment?.id);
    },
    [user, deliver],
  );

  const retryMessage = useCallback(
    async (roomId: string, messageId: string) => {
      const target = historyRef.current[roomId]?.messages.find(
        (item) => item.id === messageId,
      );
      if (!target) return;

      setHistory((prev) => {
        const room = prev[roomId];
        if (!room) return prev;
        return {
          ...prev,
          [roomId]: {
            ...room,
            messages: room.messages.map((item) =>
              item.id === messageId
                ? { ...item, clientStatus: "sending" as const }
                : item,
            ),
          },
        };
      });

      await deliver(roomId, messageId, target.content, target.attachment?.id);
    },
    [deliver],
  );

  /**
   * Uploads a file to a room. The file is stored by the server straight away
   * and linked to a message when that message is sent.
   */
  const uploadAttachment = useCallback(
    async (
      roomId: string,
      file: File,
      onProgress?: (progress: UploadProgress) => void,
    ): Promise<Attachment> => {
      if (!token) {
        throw new Error("You need to be signed in to upload a file.");
      }

      return uploadAttachmentRequest(roomId, file, token, onProgress);
    },
    [token],
  );

  const editMessage = useCallback(async (messageId: string, content: string) => {
    const trimmed = content.trim();
    if (!trimmed) return;

    const socket = await whenConnected(getSocket());
    const res = await request(socket, "message:update", {
      messageId,
      content: trimmed,
    });
    if (res.status !== 200) {
      throw new Error(res.message || "Message could not be edited.");
    }
  }, []);

  /** Removes a room from the list, its history, and the active-room state. */
  const dropRoom = useCallback((roomId: string) => {
    requestedRooms.current.delete(roomId);
    setRooms((prev) => prev.filter((room) => room.id !== roomId));
    setHistory((prev) => {
      if (!(roomId in prev)) return prev;
      const next = { ...prev };
      delete next[roomId];
      return next;
    });
    setActiveRoomId((prev) => (prev === roomId ? null : prev));
  }, []);

  const deleteMessage = useCallback(async (messageId: string) => {
    const socket = await whenConnected(getSocket());
    const res = await request(socket, "message:delete", messageId);
    if (res.status !== 200) {
      throw new Error(res.message || "Message could not be deleted.");
    }
  }, []);

  const leaveRoom = useCallback(async (roomId: string) => {
    const socket = await whenConnected(getSocket());
    const res = await request(socket, "room:leave", roomId);
    if (res.status !== 200) {
      throw new Error(res.message || "Could not leave the conversation.");
    }
    // Drop it locally right away; other devices reconcile via room:list.
    dropRoom(roomId);
  }, [dropRoom]);

  const deleteRoom = useCallback(async (roomId: string) => {
    const socket = await whenConnected(getSocket());
    const res = await request(socket, "room:delete", roomId);
    if (res.status !== 200) {
      throw new Error(res.message || "Could not delete the conversation.");
    }
    // The server broadcasts `room:deleted`, which also cleans up other
    // devices; clearing locally here keeps this one instant.
    dropRoom(roomId);
  }, [dropRoom]);

  const getRoomHistory = useCallback(
    (roomId: string): RoomHistoryView => {
      const room = history[roomId];
      return {
        messages: room?.messages ?? [],
        hasMore: room?.hasMore ?? false,
        isLoading: room?.isLoading ?? false,
        error: room?.error ?? null,
      };
    },
    [history],
  );

  const retryHistory = useCallback(
    async (roomId: string) => {
      requestedRooms.current.delete(roomId);
      await loadMessages(roomId);
    },
    [loadMessages],
  );

  // Last-known presence. Deliberately NOT gated on our own connection: while
  // we are offline the previous state is more accurate than blanking every
  // dot to "Offline" (which wrongly implied peers went offline with us).
  const isUserOnline = useCallback(
    (userId: string) => onlineUserIds.has(userId),
    [onlineUserIds],
  );

  // Announces the current user's typing state for a room. Fire-and-forget: a
  // lost signal is harmless (the server clears stale typists on its own
  // timeout), so it is skipped entirely while disconnected rather than queued.
  const setTyping = useCallback((roomId: string, typing: boolean) => {
    if (!roomId) return;
    const socket = getSocket();
    if (!socket.connected) return;
    socket.emit(typing ? "typing:start" : "typing:stop", { roomId });
  }, []);

  /** Ids of other members currently typing in a room (self excluded). */
  const getTypingUserIds = useCallback(
    (roomId: string): string[] =>
      typingUserIdsIn(typingStore, roomId, currentUserId ?? ""),
    [typingStore, currentUserId],
  );

  // Sweep typists whose signal expired locally. The server is the source of
  // truth and broadcasts explicit stops; this only catches signals lost to a
  // dropped connection so an indicator can never get stuck on.
  useEffect(() => {
    const interval = setInterval(() => {
      setTypingStore((prev) => pruneExpiredTyping(prev, Date.now()));
    }, PRUNE_TYPING_INTERVAL_MS);
    return () => clearInterval(interval);
  }, []);

  // Load the room list and online-user state whenever a session becomes
  // available (and on reconnect). This is the "synchronize with an external
  // system" case effects are for: the socket is the source of truth and the
  // state update lands after the round-trip (never synchronously during the
  // effect), so the rule misfires.
  useEffect(() => {
    if (!user || !isConnected) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshRooms();
    void refreshPresence();
  }, [user, isConnected, refreshRooms, refreshPresence]);

  // Join the active room's channel on connect/reconnect so `message:new`
  // broadcasts reach us. `room:open` is the backend's join mechanism. Keyed on
  // the peer id (not the room list) so reordering the list never re-joins.
  const activeRoom = activeRoomId
    ? (rooms.find((room) => room.id === activeRoomId) ?? null)
    : null;
  const activePeerId = activeRoom
    ? othersIn(activeRoom, currentUserId)[0]?.id
    : undefined;

  useEffect(() => {
    if (!isConnected || !activePeerId) return;
    void (async () => {
      try {
        const socket = await whenConnected(getSocket());
        await request(socket, "room:open", activePeerId);
      } catch {
        // Reconnect will retry.
      }
    })();
  }, [isConnected, activePeerId]);

  // Live updates from the server.
  useEffect(() => {
    if (!user || !isConnected) return;
    const socket = getSocket();

    const handleNewMessage = (message: Message) => {
      let tempId = pendingByServerId.current.get(message.id);
      if (tempId) pendingByServerId.current.delete(message.id);

      if (!tempId) {
        // The server emits `message:new` before it acks, so the broadcast wins
        // the race. Match the oldest still-unsent copy with the same text and
        // the same file so the optimistic message is replaced rather than
        // duplicated.
        const acked = new Set(pendingByServerId.current.values());
        tempId = (
          historyRef.current[message.roomId]?.messages ?? []
        ).find(
          (item) =>
            item.clientStatus === "sending" &&
            !acked.has(item.id) &&
            item.senderId === message.senderId &&
            item.content === message.content &&
            (item.attachment?.id ?? null) === (message.attachment?.id ?? null),
        )?.id;
      }

      setHistory((prev) => {
        const room = prev[message.roomId];
        if (!room) return prev;

        let messages = room.messages;
        if (tempId) {
          messages = messages.filter((item) => item.id !== tempId);
        }
        if (messages.some((item) => item.id === message.id)) {
          return { ...prev, [message.roomId]: { ...room, messages } };
        }
        return {
          ...prev,
          [message.roomId]: { ...room, messages: [...messages, message] },
        };
      });

      const isFromOther = message.senderId !== user.id;
      const isActive = activeRoomIdRef.current === message.roomId;
      if (isFromOther && isActive) {
        // The room is open: mark it read so the badge never re-appears.
        void markRoomRead(message.roomId);
      }

      setRooms((prev) => {
        const index = prev.findIndex((room) => room.id === message.roomId);
        if (index === -1) return prev;
        const updated: Room = {
          ...prev[index],
          lastMessage: message,
          unreadCount:
            isFromOther && !isActive
              ? prev[index].unreadCount + 1
              : prev[index].unreadCount,
        };
        return [updated, ...prev.filter((room) => room.id !== message.roomId)];
      });
    };

    const handleUpdatedMessage = (message: Message) => {
      setHistory((prev) => {
        const room = prev[message.roomId];
        if (!room) return prev;
        if (!room.messages.some((item) => item.id === message.id)) return prev;
        return {
          ...prev,
          [message.roomId]: {
            ...room,
            messages: room.messages.map((item) =>
              item.id === message.id ? message : item,
            ),
          },
        };
      });

      // Keep the sidebar preview in sync when the edited message is the latest.
      setRooms((prev) =>
        prev.map((room) =>
          room.id === message.roomId && room.lastMessage?.id === message.id
            ? { ...room, lastMessage: message }
            : room,
        ),
      );
    };

    const handleDeletedMessage = ({ messageId }: { messageId: string }) => {
      setHistory((prev) => {
        let changed = false;
        const next: Record<string, RoomHistory> = { ...prev };
        for (const [roomId, room] of Object.entries(prev)) {
          if (room.messages.some((item) => item.id === messageId)) {
            next[roomId] = {
              ...room,
              messages: room.messages.filter((item) => item.id !== messageId),
            };
            changed = true;
          }
        }
        return changed ? next : prev;
      });
    };

    const handleNewRoom = () => {
      void refreshRooms();
    };

    const handleDeletedRoom = ({ roomId }: { roomId: string }) => {
      dropRoom(roomId);
    };

    // One of our devices read a room: clear the badge here too.
    const handleRoomRead = ({ roomId }: { roomId: string }) => {
      setRooms((prev) => clearUnread(prev, roomId));
    };

    const handlePresenceUpdate = ({
      userId,
      online,
    }: {
      userId: string;
      online: boolean;
    }) => {
      setOnlineUserIds((prev) => {
        if (online === prev.has(userId)) return prev;
        const next = new Set(prev);
        if (online) next.add(userId);
        else next.delete(userId);
        return next;
      });
    };

    const handleTypingState = (state: TypingState) => {
      // Ignore our own broadcasts; the composer already knows we're typing.
      if (state.userId === user.id) return;
      setTypingStore((prev) => applyTypingState(prev, state, Date.now()));
    };

    socket.on("message:new", handleNewMessage);
    socket.on("message:updated", handleUpdatedMessage);
    socket.on("message:deleted", handleDeletedMessage);
    socket.on("room:new", handleNewRoom);
    socket.on("room:deleted", handleDeletedRoom);
    socket.on("room:read", handleRoomRead);
    socket.on("presence:update", handlePresenceUpdate);
    socket.on("typing:state", handleTypingState);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:updated", handleUpdatedMessage);
      socket.off("message:deleted", handleDeletedMessage);
      socket.off("room:new", handleNewRoom);
      socket.off("room:deleted", handleDeletedRoom);
      socket.off("room:read", handleRoomRead);
      socket.off("presence:update", handlePresenceUpdate);
      socket.off("typing:state", handleTypingState);
    };
  }, [user, isConnected, refreshRooms, dropRoom, markRoomRead]);

  const value = useMemo<ChatContextValue>(
    () => ({
      rooms,
      roomsStatus,
      isUserOnline,
      refreshRooms,
      activateRoom,
      getRoomHistory,
      retryHistory,
      openRoomWithUser,
      loadOlder,
      sendMessage,
      retryMessage,
      uploadAttachment,
      editMessage,
      deleteMessage,
      leaveRoom,
      deleteRoom,
      getTypingUserIds,
      setTyping,
    }),
    [
      rooms,
      roomsStatus,
      isUserOnline,
      refreshRooms,
      activateRoom,
      getRoomHistory,
      retryHistory,
      openRoomWithUser,
      loadOlder,
      sendMessage,
      retryMessage,
      uploadAttachment,
      editMessage,
      deleteMessage,
      leaveRoom,
      deleteRoom,
      getTypingUserIds,
      setTyping,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChat must be used within a <ChatProvider>.");
  }
  return context;
}
