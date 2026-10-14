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
  loaded: boolean;
}

type RoomsStatus = "loading" | "ready" | "error";

interface ChatContextValue {
  rooms: Room[];
  roomsStatus: RoomsStatus;
  activeRoomId: string | null;
  activeRoom: Room | null;
  messages: Message[];
  hasMore: boolean;
  isLoadingMessages: boolean;
  refreshRooms: () => Promise<void>;
  selectRoom: (room: Room) => void;
  openRoomWithUser: (target: User) => Promise<void>;
  closeRoom: () => void;
  loadOlder: () => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  deleteMessage: (messageId: string) => Promise<void>;
}

const ChatContext = createContext<ChatContextValue | null>(null);

const emptyHistory = (): RoomHistory => ({
  messages: [],
  nextCursor: null,
  hasMore: false,
  isLoading: false,
  loaded: false,
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

  // Rooms whose initial history has been requested, so we never fetch twice.
  const requestedRooms = useRef<Set<string>>(new Set());
  // Mirror of `rooms` for effects that must not re-run when a message arrives.
  const roomsRef = useRef<Room[]>([]);

  const currentUserId = user?.id;

  useEffect(() => {
    roomsRef.current = rooms;
  }, [rooms]);

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
          loaded: true,
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

  const loadOlder = useCallback(async () => {
    if (!activeRoomId) return;

    const current = history[activeRoomId];
    if (!current || current.isLoading || !current.hasMore || !current.nextCursor) {
      return;
    }

    const cursor = current.nextCursor;
    setHistory((prev) => ({
      ...prev,
      [activeRoomId]: { ...prev[activeRoomId], isLoading: true },
    }));

    try {
      const socket = await whenConnected(getSocket());
      const res = await request(socket, "message:history", {
        roomId: activeRoomId,
        cursor,
        limit: HISTORY_PAGE_SIZE,
      });

      if (res.status !== 200 || !res.messages) {
        setHistory((prev) => ({
          ...prev,
          [activeRoomId]: { ...prev[activeRoomId], isLoading: false },
        }));
        return;
      }

      const older = [...res.messages].reverse();
      setHistory((prev) => ({
        ...prev,
        [activeRoomId]: {
          messages: [...older, ...prev[activeRoomId].messages],
          nextCursor: res.nextCursor ?? null,
          hasMore: Boolean(res.hasMore),
          isLoading: false,
          loaded: true,
        },
      }));
    } catch {
      setHistory((prev) => ({
        ...prev,
        [activeRoomId]: { ...prev[activeRoomId], isLoading: false },
      }));
    }
  }, [activeRoomId, history]);

  const selectRoom = useCallback(
    (room: Room) => {
      setActiveRoomId(room.id);
      void loadMessages(room.id);
    },
    [loadMessages],
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
        // Show the conversation immediately; refreshRooms() reconciles with the server.
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

      setActiveRoomId(roomId);
      void loadMessages(roomId);
      void refreshRooms();
    },
    [user, loadMessages, refreshRooms],
  );

  const closeRoom = useCallback(() => setActiveRoomId(null), []);

  const sendMessage = useCallback(
    async (content: string) => {
      const roomId = activeRoomId;
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
    [activeRoomId],
  );

  const deleteMessage = useCallback(async (messageId: string) => {
    const socket = await whenConnected(getSocket());
    const res = await request(socket, "message:delete", messageId);
    if (res.status !== 200) {
      throw new Error(res.message || "Message could not be deleted.");
    }
  }, []);

  // Load the room list whenever a session becomes available (and on reconnect).
  // This is the "synchronize with an external system" case effects are for: the
  // socket is the source of truth and the state update lands after the
  // round-trip (never synchronously during the effect), so the rule misfires.
  useEffect(() => {
    if (!user || !isConnected) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refreshRooms();
  }, [user, isConnected, refreshRooms]);

  // Rejoin the active chat room on connect/reconnect so `message:new` broadcasts
  // reach us. `room:open` is the backend's join mechanism.
  useEffect(() => {
    if (!isConnected || !activeRoomId) return;

    const room = roomsRef.current.find((item) => item.id === activeRoomId);
    if (!room) return;

    const peer = othersIn(room, currentUserId)[0];
    if (!peer) return;

    void (async () => {
      const socket = await whenConnected(getSocket());
      await request(socket, "room:open", peer.id);
    })();
  }, [isConnected, activeRoomId, currentUserId]);

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
          [message.roomId]: {
            ...room,
            messages: [...room.messages, message],
          },
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

    socket.on("message:new", handleNewMessage);
    socket.on("message:deleted", handleDeletedMessage);
    socket.on("room:new", handleNewRoom);
    socket.on("room:deleted", handleDeletedRoom);

    return () => {
      socket.off("message:new", handleNewMessage);
      socket.off("message:deleted", handleDeletedMessage);
      socket.off("room:new", handleNewRoom);
      socket.off("room:deleted", handleDeletedRoom);
    };
  }, [user, isConnected, refreshRooms]);

  const activeHistory = activeRoomId ? history[activeRoomId] : undefined;
  const activeRoom = activeRoomId
    ? (rooms.find((room) => room.id === activeRoomId) ?? null)
    : null;

  const value = useMemo<ChatContextValue>(
    () => ({
      rooms,
      roomsStatus,
      activeRoomId,
      activeRoom,
      messages: activeHistory?.messages ?? [],
      hasMore: activeHistory?.hasMore ?? false,
      isLoadingMessages: activeHistory?.isLoading ?? false,
      refreshRooms,
      selectRoom,
      openRoomWithUser,
      closeRoom,
      loadOlder,
      sendMessage,
      deleteMessage,
    }),
    [
      rooms,
      roomsStatus,
      activeRoomId,
      activeRoom,
      activeHistory,
      refreshRooms,
      selectRoom,
      openRoomWithUser,
      closeRoom,
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
