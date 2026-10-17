import { describe, expect, it } from "vitest";
import { formatDay, formatTime } from "./format";

describe("formatTime", () => {
  it("returns an empty string for an invalid date", () => {
    expect(formatTime("not-a-date")).toBe("");
  });

  it("formats a valid timestamp as a clock time", () => {
    expect(formatTime("2026-03-15T10:30:00.000Z")).toMatch(/\d{1,2}:\d{2}/);
  });
});

describe("formatDay", () => {
  // Local noon, so building dates at other local hours can't cross a boundary.
  const now = new Date(2026, 2, 15, 12, 0, 0);

  it("labels the current day as Today", () => {
    expect(formatDay(new Date(2026, 2, 15, 8, 0, 0).toISOString(), now)).toBe(
      "Today",
    );
  });

  it("labels the previous day as Yesterday", () => {
    expect(formatDay(new Date(2026, 2, 14, 23, 0, 0).toISOString(), now)).toBe(
      "Yesterday",
    );
  });

  it("labels older dates with a short date including the year", () => {
    const label = formatDay(new Date(2025, 11, 31, 9, 0, 0).toISOString(), now);
    expect(label).toContain("2025");
  });

  it("returns an empty string for an invalid date", () => {
    expect(formatDay("nope", now)).toBe("");
  });
});
