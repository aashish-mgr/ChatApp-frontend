"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { User } from "../../types/chat";
import { request } from "../../lib/emit";
import { getSocket, setSocketToken, whenConnected } from "../../lib/socket";
import {
  clearSession,
  getServerSessionSnapshot,
  getSessionSnapshot,
  setSession,
  subscribeSession,
} from "../../lib/session";

interface AuthContextValue {
  user: User | null;
  token: string | null;
  /** False during SSR and the hydration pass, true once mounted on the client. */
  isReady: boolean;
  login: (username: string, password: string) => Promise<void>;
  /** Registers the account, then logs in and starts the session. */
  register: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

// `isReady` is simply "has the client hydrated": the server snapshot is false,
// the client snapshot true. `useSyncExternalStore` reconciles the two without a
// hydration mismatch or a setState-in-effect.
const subscribeNothing = () => () => {};
const getClientReadySnapshot = () => true;
const getServerReadySnapshot = () => false;

export function AuthProvider({ children }: { children: ReactNode }) {
  const session = useSyncExternalStore(
    subscribeSession,
    getSessionSnapshot,
    getServerSessionSnapshot,
  );
  const isReady = useSyncExternalStore(
    subscribeNothing,
    getClientReadySnapshot,
    getServerReadySnapshot,
  );

  // A guarded event answered with 401 means our token is no longer valid.
  useEffect(() => {
    const socket = getSocket();

    const handleAuthError = () => {
      setSocketToken(null);
      clearSession();
    };

    socket.on("auth_error", handleAuthError);
    return () => {
      socket.off("auth_error", handleAuthError);
    };
  }, []);

  const startSession = useCallback((token: string, user: User) => {
    // The server already authenticated the live socket during login, so we only
    // need to remember the token for future reconnects.
    setSocketToken(token);
    setSession({ token, user });
  }, []);

  const login = useCallback(
    async (username: string, password: string) => {
      const socket = await whenConnected(getSocket());
      const res = await request(socket, "login", { username, password });

      if (res.status !== 200 || !res.data || !res.user) {
        throw new Error(res.message || "Invalid username or password.");
      }

      startSession(res.data, res.user);
    },
    [startSession],
  );

  const register = useCallback(
    async (username: string, password: string) => {
      const socket = await whenConnected(getSocket());
      const res = await request(socket, "register", { username, password });

      if (res.status !== 200) {
        throw new Error(res.message || "Could not create your account.");
      }

      // Seamless hand-off: sign the new account straight in.
      await login(username, password);
    },
    [login],
  );

  const logout = useCallback(() => {
    setSocketToken(null);
    clearSession();

    // The current socket stays authenticated on the server, so reconnect to
    // drop back to an anonymous connection.
    const socket = getSocket();
    socket.disconnect();
    socket.connect();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      token: session?.token ?? null,
      isReady,
      login,
      register,
      logout,
    }),
    [session, isReady, login, register, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an <AuthProvider>.");
  }
  return context;
}
