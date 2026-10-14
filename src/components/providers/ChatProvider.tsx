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
import type { Message, Room, User } from "../../types/chat";
import { request } from "../../lib/emit";
import { getSocket, whenConnected } from "../../lib/socket";
import { useAuth } from "./AuthProvider";
import { useSocket } from "./SocketProvider";

const HISTORY_PAGE_SIZE = 50;

interface RoomHistory {
  /** Oldest first, ready for rendering top-to-bottom. */
  messages: Message[];
  nextCursor: string | null;
  hasMore: boolean;
  isLoading: boolean;
}

/** What a consumer needs to render one room's history. */
export interface RoomHistoryView {
  messages: Message[];
  hasMore: boolean;
  isLoading: boolean;
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
  /** Opens (or creates) the 1:1 room with a user and returns its id. */
  openRoomWithUser: (target: User) => Promise<string>;
  loadOlder: (roomId: string) => Promise<void>;
  sendMessage: (roomId: string, content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const emptyHistory = (): RoomHistory => ({
  messages: [],
  nextCursor: null,
  hasMore: false,
  isLoading: false,
});

const othersIn = (room: Room, currentUserId: string | undefined): User[] =>
  room.members.filter((member) => member.id !== currentUserId);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isConnected } = useSocket();

  const [rooms, setRooms] = useState<Room[]>([]);
  const [roomsStatus, setRoomsStatus] = useState<RoomsStatus>("loading");
  const [activeRoomId, setActiveRoomId] = useState<string | null>(null);
  const [history, setHistory] = useState<Record<string, RoomHistory>>({});
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(
    () => new Set(),
  );

  // Rooms whose initial history has been requested, so we never fetch twice.
  const requestedRooms = useRef<Set<string>>(new Set());

  const currentUserId = user?.id;

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

    setHistory((prev) => ({
      ...prev,
      [roomId]: { ...(prev[roomId] ?? emptyHistory()), isLoading: true },
    }));

    try {
      const socket = await whenConnected(getSocket());
      const res = await request(socket, "message:history", {
        roomId,
        limit: HISTORY_PAGE_SIZE,
      });

      if (res.status !== 200 || !res.messages) {
        requestedRooms.current.delete(roomId);
        setHistory((prev) => ({
          ...prev,
          [roomId]: { ...(prev[roomId] ?? emptyHistory()), isLoading: false },
        }));
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
        },
      }));
    } catch {
      requestedRooms.current.delete(roomId);
      setHistory((prev) => ({
        ...prev,
        [roomId]: { ...(prev[roomId] ?? emptyHistory()), isLoading: false },
      }));
    }
  }, []);

  const activateRoom = useCallback(
    (roomId: string) => {
      setActiveRoomId(roomId);
      void loadMessages(roomId);
    },
    [loadMessages],
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

  const sendMessage = useCallback(
    async (roomId: string, content: string) => {
      const trimmed = content.trim();
      if (!roomId || !trimmed) return;

      const socket = await whenConnected(getSocket());
      const res = await request(socket, "message:send", {
        roomId,
        content: trimmed,
      });

      if (res.status !== 200) {
        throw new Error(res.message || "Message could not be sent.");
      }
    },
    [],
  );

  const deleteMessage = useCallback(async (messageId: string) => {
    const socket = await whenConnected(getSocket());
    const res = await request(socket, "message:delete", messageId);
    if (res.status !== 200) {
      throw new Error(res.message || "Message could not be deleted.");
    }
  }, []);

  const getRoomHistory = useCallback(
    (roomId: string): RoomHistoryView => {
      const room = history[roomId];
      return {
        messages: room?.messages ?? [],
        hasMore: room?.hasMore ?? false,
        isLoading: room?.isLoading ?? false,
      };
    },
    [history],
  );

  const isUserOnline = useCallback(
    (userId: string) => isConnected && onlineUserIds.has(userId),
    [isConnected, onlineUserIds],
  );

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
      setHistory((prev) => {
        const room = prev[message.roomId];
        if (!room || room.messages.some((item) => item.id === message.id)) {
          return prev;
        }
        return {
          ...prev,
          [message.roomId]: { ...room, messages: [...room.messages, message] },
        };
      });

      setRooms((prev) => {
        const index = prev.findIndex((room) => room.id === message.roomId);
        if (index === -1) return prev;
        const updated = { ...prev[index], lastMessage: message };
        return [updated, ...prev.filter((room) => room.id !== message.roomId)];
      });
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
      requestedRooms.current.delete(roomId);
      setRooms((prev) => prev.filter((room) => room.id !== roomId));
      setHistory((prev) => {
        if (!(roomId in prev)) return prev;
        const next = { ...prev };
        delete next[roomId];
        return next;
      });
      setActiveRoomId((prev) => (prev === roomId ? null : prev));
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

    socket.on("message:new", handleNewMessage);
    socket.on("message:deleted", handleDeletedMessage);
    socket.on("room:new", handleNewRoom);
    socket.on("room:deleted", handleDeletedRoom);
    socket.on("presence:update", handlePresenceUpdate);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:deleted", handleDeletedMessage);
      socket.off("room:new", handleNewRoom);
      socket.off("room:deleted", handleDeletedRoom);
      socket.off("presence:update", handlePresenceUpdate);
    };
  }, [user, isConnected, refreshRooms]);

  const value = useMemo<ChatContextValue>(
    () => ({
      rooms,
      roomsStatus,
      isUserOnline,
      refreshRooms,
      activateRoom,
      getRoomHistory,
      openRoomWithUser,
      loadOlder,
      sendMessage,
      deleteMessage,
    }),
    [
      rooms,
      roomsStatus,
      isUserOnline,
      refreshRooms,
      activateRoom,
      getRoomHistory,
      openRoomWithUser,
      loadOlder,
      sendMessage,
      deleteMessage,
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
