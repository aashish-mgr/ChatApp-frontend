"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../components/providers/AuthProvider";
import { useSocket } from "../../components/providers/SocketProvider";
import { SocketTimeoutError } from "../../lib/emit";

type Mode = "login" | "register";

// Mirror the backend's register rules so the user learns about them before
// the round-trip (login intentionally skips them: see auth.socket.ts).
const MIN_USERNAME_LENGTH = 3;
const MAX_USERNAME_LENGTH = 32;
const MIN_PASSWORD_LENGTH = 6;

export default function LoginPage() {
  const router = useRouter();
  const { user, isReady, login, register } = useAuth();
  const { isConnected } = useSocket();

  const [mode, setMode] = useState<Mode>("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Already signed in (e.g. returning user landed here): skip to the app.
  useEffect(() => {
    if (isReady && user) {
      router.replace("/");
    }
  }, [isReady, user, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    const trimmedUsername = username.trim();
    if (!trimmedUsername || !password) {
      setError("Please enter both a username and a password.");
      return;
    }

    if (mode === "register") {
      if (
        trimmedUsername.length < MIN_USERNAME_LENGTH ||
        trimmedUsername.length > MAX_USERNAME_LENGTH
      ) {
        setError(
          `Username must be ${MIN_USERNAME_LENGTH}-${MAX_USERNAME_LENGTH} characters.`,
        );
        return;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        return;
      }
    }

    setIsSubmitting(true);
    try {
      if (mode === "register") {
        await register(trimmedUsername, password);
      } else {
        await login(trimmedUsername, password);
      }
      router.replace("/");
    } catch (submitError) {
      setError(
        submitError instanceof SocketTimeoutError
          ? "Could not reach the server. Please try again."
          : submitError instanceof Error
            ? submitError.message
            : "Something went wrong. Please try again.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const switchMode = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setError(null);
    // Don't carry a typed password across tabs (e.g. a sign-in password
    // sitting in the sign-up form).
    setPassword("");
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-semibold tracking-tight">ChatApp</h1>
          <p className="mt-2 text-sm text-slate-400">
            {mode === "login"
              ? "Welcome back. Sign in to continue."
              : "Create an account to start chatting."}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-slate-900 p-1 text-sm">
          {(["login", "register"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => switchMode(option)}
              className={`rounded-md px-3 py-2 font-medium transition ${
                mode === option
                  ? "bg-slate-700 text-white"
                  : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {option === "login" ? "Sign in" : "Sign up"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="username"
              className="block text-sm font-medium text-slate-300"
            >
              Username
            </label>
            <input
              id="username"
              name="username"
              type="text"
              autoComplete="username"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
              placeholder="your-username"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-sm font-medium text-slate-300"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-500/30"
              placeholder="••••••••"
            />
            {mode === "register" ? (
              <p className="text-xs text-slate-500">
                {MIN_PASSWORD_LENGTH}+ characters.{" "}
                {MIN_USERNAME_LENGTH}-{MAX_USERNAME_LENGTH} character username.
              </p>
            ) : null}
          </div>

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-300"
            >
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-sky-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-sky-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting
              ? "Please wait…"
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>

        <p className="mt-6 flex items-center justify-center gap-2 text-xs text-slate-500">
          <span
            className={`inline-block h-2 w-2 rounded-full ${
              isConnected ? "bg-emerald-500" : "bg-slate-600"
            }`}
          />
          {isConnected ? "Connected to server" : "Connecting to server…"}
        </p>
      </div>
    </main>
  );
}
