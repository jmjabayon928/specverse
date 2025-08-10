"use client";

import * as React from "react";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { AttachmentDTO } from "@/types/attachments";

type AttachmentPermissions = {
  canCreate: boolean;
  canDelete: boolean;
};

interface Props {
  sheetId: number;
  isLocked: boolean; // true when Verified/Approved
  permissions?: AttachmentPermissions;
  className?: string;

  /** Optional server-provided data to avoid client fetch */
  initialAttachments?: AttachmentDTO[];

  /** Base endpoint: defaults to /api/backend/sheets/:id/attachments */
  endpoint?: (sheetId: number) => string;
}

export default function SheetAttachmentsPanel({
  sheetId,
  isLocked,
  permissions = { canCreate: false, canDelete: false },
  className,
  initialAttachments,
  endpoint = (id) => `/api/backend/sheets/${id}/attachments`,
}: Props) {
  const [items, setItems] = React.useState<AttachmentDTO[] | null>(initialAttachments ?? null);
  const [loading, setLoading] = React.useState(!initialAttachments);
  const [error, setError] = React.useState<string | null>(null);

  // Upload UI
  const [showUpload, setShowUpload] = React.useState(false);
  const [uploading, setUploading] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  const effectiveCanCreate = permissions.canCreate && !isLocked;
  const effectiveCanDelete = permissions.canDelete && !isLocked;

  React.useEffect(() => {
    if (initialAttachments) return;
    const abort = new AbortController();
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch(endpoint(sheetId), {
          signal: abort.signal,
          credentials: "include",
          headers: { Accept: "application/json" },
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`Failed to load attachments (${res.status})`);
        const data: AttachmentDTO[] = await res.json();
        setItems(sortAttachments(data));
      } catch (e: unknown) {
        if (!(e instanceof DOMException && e.name === "AbortError")) {
          setError(e instanceof Error ? e.message : "Failed to load attachments");
        }
      } finally {
        setLoading(false);
      }
    })();
    return () => abort.abort();
  }, [sheetId, endpoint, initialAttachments]);

  const { images, pdfs, others } = groupAttachments(items ?? []);

  async function handleUploadSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!fileInputRef.current?.files || fileInputRef.current.files.length === 0) return;

    try {
      setUploading(true);
      setError(null);

      const fd = new FormData();
      // allow multi-file upload
      for (const file of Array.from(fileInputRef.current.files)) {
        fd.append("files", file, file.name);
      }

      const res = await fetch(endpoint(sheetId), {
        method: "POST",
        credentials: "include",
        body: fd,
      });
      if (!res.ok) {
        const msg = await safeErr(res);
        throw new Error(msg);
      }
      const created: AttachmentDTO[] = await res.json(); // return array from server
      setItems((prev) => sortAttachments([...(prev ?? []), ...created]));
      setShowUpload(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(id: number) {
    if (!effectiveCanDelete) return;
    const ok = window.confirm("Delete this attachment?");
    if (!ok) return;

    const res = await fetch(`${endpoint(sheetId)}/${id}`, {
      method: "DELETE",
      credentials: "include",
      cache: "no-store",
    });
    if (!res.ok && res.status !== 204) {
      const msg = await safeErr(res);
      setError(msg);
      return;
    }
    setItems((prev) => (prev ? prev.filter((a) => a.AttachmentID !== id) : prev));
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold">Attachments</h3>
          <p className="text-sm text-muted-foreground">
            Images & PDFs are previewed in-browser. Other files are downloadable.
          </p>
        </div>

        {effectiveCanCreate && (
          <div>
            {!showUpload ? (
              <button
                type="button"
                onClick={() => setShowUpload(true)}
                className="inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-white hover:bg-blue-700"
                title="Add Attachment"
              >
                ＋ Add Attachment
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="inline-flex items-center rounded-md bg-gray-200 px-3 py-1.5 hover:bg-gray-300"
                title="Cancel"
              >
                Cancel
              </button>
            )}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-6">
        {loading && <p className="text-sm text-muted-foreground">Loading attachments…</p>}
        {error && <p className="text-sm text-destructive">Error: {error}</p>}

        {/* Upload form */}
        {effectiveCanCreate && showUpload && (
          <form className="rounded border p-3 bg-gray-50 space-y-3" onSubmit={handleUploadSubmit}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              className="block w-full text-sm"
              title="File input"
              // accept any file; if you want restrict: accept="image/*,.pdf,.xlsx"
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={uploading}
                className="rounded-md bg-green-600 px-3 py-1.5 text-white hover:bg-green-700 disabled:opacity-60"
              >
                {uploading ? "Uploading…" : "Upload"}
              </button>
              <button
                type="button"
                onClick={() => setShowUpload(false)}
                className="rounded-md bg-gray-200 px-3 py-1.5 hover:bg-gray-300"
              >
                Close
              </button>
            </div>
          </form>
        )}

        {/* Images */}
        <Section title={`Images (${images.length})`} emptyText="No image attachments.">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {images.map((a) => (
              <AttachmentCard
                key={a.AttachmentID}
                a={a}
                canDelete={effectiveCanDelete}
                onDelete={() => handleDelete(a.AttachmentID)}
              />
            ))}
          </div>
        </Section>

        <Separator />

        {/* PDFs */}
        <Section title={`PDFs (${pdfs.length})`} emptyText="No PDF attachments.">
          <div className="space-y-4">
            {pdfs.map((a) => (
              <PDFRow
                key={a.AttachmentID}
                a={a}
                canDelete={effectiveCanDelete}
                onDelete={() => handleDelete(a.AttachmentID)}
              />
            ))}
          </div>
        </Section>

        <Separator />

        {/* Others */}
        <Section title={`Other Files (${others.length})`} emptyText="No other attachments.">
          <ul className="space-y-2">
            {others.map((a) => (
              <li key={a.AttachmentID} className="flex items-center justify-between gap-2">
                <a
                  href={a.Url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-700 hover:underline break-all"
                  title={a.FileName}
                >
                  {a.FileName}
                </a>
                {effectiveCanDelete && (
                  <button
                    type="button"
                    onClick={() => handleDelete(a.AttachmentID)}
                    className="p-1 rounded text-red-600 hover:bg-red-50"
                    title="Delete Attachment"
                  >
                    🗑️
                  </button>
                )}
              </li>
            ))}
        </ul>
        </Section>
      </CardContent>
    </Card>
  );
}

/* ---------- Helpers & subcomponents ---------- */

function Section(
  { title, emptyText, children }:
  React.PropsWithChildren<{ title: string; emptyText: string }>
) {
  const hasChildren = React.Children.count(children) > 0;
  return (
    <div>
      <div className="mb-2 font-medium">{title}</div>
      <div className="min-h-[0.5rem]">
        {hasChildren ? children : (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        )}
      </div>
    </div>
  );
}

function isImageMime(m: string) {
  return m?.toLowerCase().startsWith("image/");
}
function isPdfMime(m: string) {
  return m?.toLowerCase() === "application/pdf" || /\.pdf$/i.test(m);
}

function groupAttachments(items: AttachmentDTO[]) {
  const images: AttachmentDTO[] = [];
  const pdfs: AttachmentDTO[] = [];
  const others: AttachmentDTO[] = [];

  for (const a of items) {
    if (isImageMime(a.MimeType) || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.FileName)) {
      images.push(a);
    } else if (isPdfMime(a.MimeType) || /\.pdf$/i.test(a.FileName)) {
      pdfs.push(a);
    } else {
      others.push(a);
    }
  }
  return { images, pdfs, others };
}

function sortAttachments(list: AttachmentDTO[]) {
  // images first, then pdfs, then others; within each, newest first
  return [...list].sort((a, b) => {
    const rank = (x: AttachmentDTO) => (isImageMime(x.MimeType) ? 0 : isPdfMime(x.MimeType) ? 1 : 2);
    const r = rank(a) - rank(b);
    if (r !== 0) return r;
    return new Date(b.CreatedAt).getTime() - new Date(a.CreatedAt).getTime();
  });
}

function humanSize(bytes: number) {
  if (!Number.isFinite(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = bytes;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v < 10 ? 1 : 0)} ${units[i]}`;
}

function AttachmentCard({
  a,
  canDelete,
  onDelete,
}: {
  a: AttachmentDTO;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="rounded border p-2 bg-white shadow-sm">
      <div className="aspect-video w-full overflow-hidden rounded border bg-gray-50">
        <a href={a.Url} target="_blank" rel="noopener noreferrer" title="Open image">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={a.Url} alt={a.FileName} className="h-full w-full object-contain" />
        </a>
      </div>
      <div className="mt-2 flex items-center justify-between gap-2">
        <a
          href={a.Url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-blue-700 hover:underline break-all"
          title={a.FileName}
        >
          {a.FileName}
        </a>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{humanSize(a.SizeBytes)}</span>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded text-red-600 hover:bg-red-50"
              title="Delete Attachment"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function PDFRow({
  a,
  canDelete,
  onDelete,
}: {
  a: AttachmentDTO;
  canDelete: boolean;
  onDelete: () => void;
}) {
  return (
    <div className="rounded border bg-white">
      <div className="flex items-center justify-between px-2 py-1">
        <a
          href={a.Url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-700 hover:underline break-all"
          title={a.FileName}
        >
          {a.FileName}
        </a>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>{humanSize(a.SizeBytes)}</span>
          {canDelete && (
            <button
              type="button"
              onClick={onDelete}
              className="p-1 rounded text-red-600 hover:bg-red-50"
              title="Delete Attachment"
            >
              🗑️
            </button>
          )}
        </div>
      </div>
      {/* preview */}
      <div className="h-64 w-full border-t">
        <iframe
          src={a.Url}
          title={a.FileName}
          className="h-full w-full"
        />
      </div>
    </div>
  );
}

async function safeErr(res: Response): Promise<string> {
  try {
    const t = await res.text();
    if (!t) return `${res.status} ${res.statusText}`;
    try {
      const j = JSON.parse(t) as { error?: string };
      return j.error ?? t;
    } catch {
      return t;
    }
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}
