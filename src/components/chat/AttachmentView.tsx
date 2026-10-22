"use client";

import { useCallback, useEffect, useState } from "react";
import type { Attachment } from "../../types/chat";
import { fetchAttachmentBlob } from "../../lib/api";
import { formatFileSize, isImageAttachment } from "../../lib/attachments";
import { useAuth } from "../providers/AuthProvider";

interface AttachmentViewProps {
  attachment: Attachment;
}

/**
 * Renders the file of a message.
 *
 * Images are previewed inline; everything else becomes a card with a
 * download button. The file is fetched with the session token rather than
 * linked directly, so the token never ends up in a URL.
 */
export function AttachmentView({ attachment }: AttachmentViewProps) {
  const { token } = useAuth();
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const isImage = isImageAttachment(attachment);

  useEffect(() => {
    if (!isImage || !token) return;

    let objectUrl: string | null = null;
    let cancelled = false;

    fetchAttachmentBlob(attachment.id, token)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setError("This image could not be loaded.");
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [attachment.id, isImage, token]);

  const download = useCallback(async () => {
    if (!token) return;

    try {
      const blob = await fetchAttachmentBlob(attachment.id, token);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = attachment.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      // Revoked on the next tick: revoking it right away can cancel the
      // download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch {
      setError("This file could not be downloaded.");
    }
  }, [attachment.filename, attachment.id, token]);

  if (isImage) {
    if (error) {
      return (
        <p className="mb-1 text-xs text-red-300">{error}</p>
      );
    }

    if (!previewUrl) {
      return (
        <div
          className="mb-1 h-32 w-48 animate-pulse rounded-xl bg-slate-700/60"
          aria-label="Loading image"
        />
      );
    }

    return (
      <a
        href={previewUrl}
        target="_blank"
        rel="noreferrer"
        className="mb-1 block"
        title={attachment.filename}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt={attachment.filename}
          className="max-h-64 max-w-full rounded-xl object-contain"
        />
      </a>
    );
  }

  return (
    <div className="mb-1 flex items-center gap-3 rounded-xl bg-slate-900/60 p-2">
      <span
        aria-hidden="true"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-700 text-xs font-semibold uppercase text-slate-300"
      >
        {attachment.filename.split(".").pop()?.slice(0, 4) ?? "?"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-slate-100">
          {attachment.filename}
        </span>
        <span className="block text-[10px] text-slate-400">
          {error ?? formatFileSize(attachment.size)}
        </span>
      </span>
      <button
        type="button"
        onClick={() => void download()}
        className="shrink-0 rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-medium text-slate-100 transition hover:bg-slate-600"
      >
        Download
      </button>
    </div>
  );
}
