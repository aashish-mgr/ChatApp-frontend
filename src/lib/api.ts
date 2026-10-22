/**
 * HTTP client for the parts of the app that are not socket traffic: file
 * uploads and downloads.
 *
 * The backend serves the REST API next to the Socket.IO server, so the API
 * normally lives on the same origin as the socket. `NEXT_PUBLIC_API_URL`
 * overrides it when the two are deployed separately.
 */

import type { Attachment } from "../types/chat";

const DEFAULT_API_URL = "http://localhost:3000";

/** The origin of a URL, or null when it cannot be parsed. */
const originOf = (url: string): string | null => {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
};

const configuredSocketUrl = process.env.NEXT_PUBLIC_SOCKET_URL;
const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL;

/** Base URL of the REST API, without a trailing slash. */
export const API_URL = (
  configuredApiUrl ??
  (configuredSocketUrl ? originOf(configuredSocketUrl) : null) ??
  DEFAULT_API_URL
).replace(/\/+$/, "");

/** Where an attachment can be downloaded from. */
export const attachmentUrl = (attachmentId: string): string =>
  `${API_URL}/api/attachments/${attachmentId}`;

/** How far along an upload is. */
export interface UploadProgress {
  loaded: number;
  total: number;
  /** Percentage between 0 and 100. */
  percent: number;
}

/**
 * Uploads a file to a room.
 *
 * `XMLHttpRequest` is used instead of `fetch` because it reports upload
 * progress, which the composer shows while the file travels.
 */
export const uploadAttachment = (
  roomId: string,
  file: File,
  token: string,
  onProgress?: (progress: UploadProgress) => void,
): Promise<Attachment> =>
  new Promise<Attachment>((resolve, reject) => {
    const request = new XMLHttpRequest();
    request.open("POST", `${API_URL}/api/attachments`);

    if (token) {
      request.setRequestHeader("Authorization", `Bearer ${token}`);
    }

    request.upload.addEventListener("progress", (event) => {
      if (!onProgress || !event.lengthComputable) return;
      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: Math.min(100, Math.round((event.loaded / event.total) * 100)),
      });
    });

    request.addEventListener("load", () => {
      let payload: {
        status?: number;
        message?: string;
        attachment?: Attachment;
      } = {};

      try {
        payload = JSON.parse(request.responseText) as typeof payload;
      } catch {
        payload = {};
      }

      if (request.status >= 200 && request.status < 300 && payload.attachment) {
        resolve(payload.attachment);
        return;
      }

      reject(
        new Error(
          payload.message || "The file could not be uploaded. Please try again.",
        ),
      );
    });

    request.addEventListener("error", () => {
      reject(new Error("The upload failed. Check your connection."));
    });

    request.addEventListener("abort", () => {
      reject(new Error("The upload was cancelled."));
    });

    const form = new FormData();
    form.append("file", file);
    form.append("roomId", roomId);
    request.send(form);
  });

/**
 * Downloads an attachment.
 *
 * The file is fetched with the session token rather than linked directly, so
 * the token never ends up in a URL that could be shared or logged.
 */
export const fetchAttachmentBlob = async (
  attachmentId: string,
  token: string,
): Promise<Blob> => {
  const response = await fetch(attachmentUrl(attachmentId), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw new Error("The file could not be loaded.");
  }

  return response.blob();
};
