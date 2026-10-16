"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";

/**
 * Root error boundary: catches unexpected render/runtime errors anywhere in
 * the app and offers a retry instead of a white screen.
 */
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-950 px-6 text-center text-slate-100">
      <h2 className="text-lg font-semibold">Something went wrong</h2>
      <p className="max-w-md text-sm text-slate-400">
        An unexpected error occurred. You can try again without losing your
        session.
      </p>
      <button
        type="button"
        onClick={() => retry()}
        className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-400"
      >
        Try again
      </button>
    </main>
  );
}
