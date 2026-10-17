/**
 * Pure date/layout helpers for the message list. Kept out of the component so
 * they can be tested without rendering, and so the grouping window is defined
 * in exactly one place.
 */

/** Messages by the same sender within this window stay in one visual group. */
export const GROUP_WINDOW_MS = 5 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local-midnight timestamp, so "days" follow the user's clock, not UTC. */
const startOfDay = (date: Date): number =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/** "10:30" style time, or "" when the timestamp is unparseable. */
export function formatTime(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

/**
 * Day separator label: "Today", "Yesterday", or a short date. `now` is
 * injectable so the output is deterministic in tests.
 */
export function formatDay(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";

  const diff = Math.round((startOfDay(now) - startOfDay(date)) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return date.toLocaleDateString([], {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
