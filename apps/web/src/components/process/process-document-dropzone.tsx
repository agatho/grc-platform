"use client";

// BPM Overhaul Phase 2: drag-drop docs onto the process header.
// Accepts either a file (uploads via documents API) or a document-id
// dragged from the DMS list (custom mime type).

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { Upload, FileText } from "lucide-react";

export function ProcessDocumentDropzone({
  processId,
  onAttached,
}: {
  processId: string;
  onAttached?: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      if (busy) return;
      setBusy(true);
      try {
        // 1. Dragged document IDs from DMS list?
        const docIdsRaw =
          e.dataTransfer.getData("application/x-grc-document-ids") ||
          e.dataTransfer.getData("text/plain");
        const docIds = (docIdsRaw ?? "")
          .split(/[\s,;]+/)
          .map((s) => s.trim())
          .filter((s) =>
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
              s,
            ),
          );

        if (docIds.length > 0) {
          const resp = await fetch(
            `/api/v1/processes/${processId}/documents/bulk-attach`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify({ documentIds: docIds }),
            },
          );
          if (resp.ok) {
            const j = await resp.json();
            toast.success(
              `Attached ${j.data?.created ?? 0} document(s)` +
                (j.data?.skippedDuplicates
                  ? ` (${j.data.skippedDuplicates} duplicate)`
                  : ""),
            );
            onAttached?.();
          } else {
            const err = await resp.json().catch(() => ({}));
            toast.error(err.error ?? "Attach failed");
          }
          return;
        }

        // 2. Plain files — upload first, then attach
        const files = Array.from(e.dataTransfer.files ?? []);
        if (files.length > 0) {
          const uploaded: string[] = [];
          for (const file of files) {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("title", file.name);
            const up = await fetch(`/api/v1/dms/documents`, {
              method: "POST",
              body: fd,
            });
            if (up.ok) {
              const j = await up.json();
              if (j.data?.id) uploaded.push(j.data.id);
            }
          }
          if (uploaded.length > 0) {
            await fetch(
              `/api/v1/processes/${processId}/documents/bulk-attach`,
              {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ documentIds: uploaded }),
              },
            );
            toast.success(`Uploaded + attached ${uploaded.length} document(s)`);
            onAttached?.();
          } else {
            toast.error("No documents uploaded");
          }
        }
      } catch (err) {
        toast.error((err as Error).message ?? "Drop failed");
      } finally {
        setBusy(false);
      }
    },
    [processId, busy, onAttached],
  );

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      className={`flex h-12 items-center justify-center rounded-md border-2 border-dashed px-3 text-xs transition-colors ${
        dragOver
          ? "border-primary bg-primary/5 text-primary"
          : "border-gray-300 text-muted-foreground"
      }`}
    >
      {busy ? (
        <span>Uploading…</span>
      ) : (
        <span className="inline-flex items-center gap-2">
          <Upload className="h-3 w-3" />
          Drop documents here to attach
        </span>
      )}
    </div>
  );
}
