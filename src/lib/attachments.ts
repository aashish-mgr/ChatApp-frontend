/**
 * Helpers for file attachments.
 *
 * The limits and the allowed types mirror the backend
 * (`chat_backend/src/modules/attachment/limits.ts`). They are checked here
 * first so an oversized or unsupported file is refused before a single byte
 * is uploaded; the server enforces the same rules again.
 */

import type { Attachment } from "../types/chat";

/** Largest accepted upload: 10 MB. */
export const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

/** Accepted MIME types, matching the backend allowlist. */
export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/csv",
  "application/json",
  "application/zip",
  "application/x-zip-compressed",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
] as const;

const ALLOWED_MIME_TYPE_SET = new Set<string>(ALLOWED_MIME_TYPES);

/** The `accept` attribute for the file picker. */
export const ATTACHMENT_ACCEPT = ALLOWED_MIME_TYPES.join(",");

/** True when the MIME type may be uploaded. */
export const isAllowedAttachmentType = (mimeType: string): boolean =>
  ALLOWED_MIME_TYPE_SET.has(mimeType.toLowerCase());

/** True when the file is an image and can be previewed inline. */
export const isImageAttachment = (attachment: {
  mimeType: string;
}): boolean => attachment.mimeType.toLowerCase().startsWith("image/");

/**
 * Checks a picked file against the upload rules.
 *
 * Returns an error message, or null when the file may be uploaded.
 */
export const validateAttachment = (file: File): string | null => {
  if (file.size > MAX_ATTACHMENT_SIZE) {
    return `"${file.name}" is too large. The maximum size is ${formatFileSize(
      MAX_ATTACHMENT_SIZE,
    )}.`;
  }
  if (!isAllowedAttachmentType(file.type)) {
    return `"${file.name}" is not a supported file type.`;
  }
  return null;
};

/** Human-readable size, e.g. "1.4 MB". */
export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "";
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || Number.isInteger(value) ? 0 : 1)} ${
    units[unitIndex]
  }`;
}

/**
 * The text of a message for the sidebar preview: its content, or the name of
 * the file it carries.
 */
export const messagePreview = (message: {
  content: string;
  attachment?: Attachment | null;
}): string => {
  const text = message.content.trim();
  if (text) return text;
  if (message.attachment) return `📎 ${message.attachment.filename}`;
  return "";
};
