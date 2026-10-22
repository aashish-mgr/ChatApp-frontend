import { describe, expect, it } from "vitest";
import {
  formatFileSize,
  isAllowedAttachmentType,
  isImageAttachment,
  MAX_ATTACHMENT_SIZE,
  messagePreview,
  validateAttachment,
} from "./attachments";

/** Builds a File-like object for the validation checks. */
const fileOf = (name: string, type: string, size: number): File =>
  new File([new Uint8Array(size)], name, { type });

describe("isAllowedAttachmentType", () => {
  it("accepts images and common documents", () => {
    expect(isAllowedAttachmentType("image/png")).toBe(true);
    expect(isAllowedAttachmentType("application/pdf")).toBe(true);
  });

  it("rejects everything else", () => {
    expect(isAllowedAttachmentType("text/html")).toBe(false);
    expect(isAllowedAttachmentType("")).toBe(false);
  });
});

describe("isImageAttachment", () => {
  it("recognises images", () => {
    expect(isImageAttachment({ mimeType: "image/png" })).toBe(true);
    expect(isImageAttachment({ mimeType: "image/webp" })).toBe(true);
  });

  it("treats everything else as a download", () => {
    expect(isImageAttachment({ mimeType: "application/pdf" })).toBe(false);
  });
});

describe("validateAttachment", () => {
  it("accepts a file within the limits", () => {
    expect(validateAttachment(fileOf("a.png", "image/png", 1024))).toBeNull();
  });

  it("rejects an oversized file", () => {
    const problem = validateAttachment(
      fileOf("big.png", "image/png", MAX_ATTACHMENT_SIZE + 1),
    );
    expect(problem).toContain("too large");
  });

  it("rejects an unsupported type", () => {
    const problem = validateAttachment(fileOf("a.exe", "application/x-msdownload", 10));
    expect(problem).toContain("not a supported file type");
  });
});

describe("formatFileSize", () => {
  it("reports bytes, kilobytes and megabytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
    expect(formatFileSize(2048)).toBe("2 KB");
    expect(formatFileSize(5 * 1024 * 1024)).toBe("5 MB");
  });

  it("returns an empty string for nonsense sizes", () => {
    expect(formatFileSize(-1)).toBe("");
    expect(formatFileSize(Number.NaN)).toBe("");
  });
});

describe("messagePreview", () => {
  it("uses the text of the message", () => {
    expect(messagePreview({ content: "hello" })).toBe("hello");
  });

  it("falls back to the file name for a message without text", () => {
    expect(
      messagePreview({
        content: "",
        attachment: {
          id: "1",
          filename: "photo.png",
          mimeType: "image/png",
          size: 10,
          url: "/api/attachments/1",
        },
      }),
    ).toContain("photo.png");
  });

  it("returns an empty string for an empty message", () => {
    expect(messagePreview({ content: "   " })).toBe("");
  });
});
