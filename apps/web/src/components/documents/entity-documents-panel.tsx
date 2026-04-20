"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  FileText,
  Upload,
  Trash2,
  Download,
  Loader2,
  Plus,
  ExternalLink,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface LinkedDocument {
  link_id: string;
  link_description: string | null;
  linked_at: string;
  document_id: string;
  title: string;
  category: string;
  status: string;
  current_version: number;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  published_at: string | null;
  updated_at: string;
}

interface EntityDocumentsPanelProps {
  entityType: string;
  entityId: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  in_review: "bg-yellow-100 text-yellow-700",
  approved: "bg-blue-100 text-blue-700",
  published: "bg-green-100 text-green-700",
  archived: "bg-gray-100 text-gray-500",
};

function formatFileSize(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function EntityDocumentsPanel({
  entityType,
  entityId,
}: EntityDocumentsPanelProps) {
  const t = useTranslations("documents");
  const [docs, setDocs] = useState<LinkedDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [availableDocs, setAvailableDocs] = useState<
    Array<{ id: string; title: string; category: string; status: string }>
  >([]);
  const [searchDoc, setSearchDoc] = useState("");
  const [loadingAvailable, setLoadingAvailable] = useState(false);

  const fetchLinkedDocs = useCallback(async () => {
    setLoading(true);
    const res = await fetch(
      `/api/v1/entity-documents?entityType=${entityType}&entityId=${entityId}`,
    );
    if (res.ok) setDocs((await res.json()).data ?? []);
    setLoading(false);
  }, [entityType, entityId]);

  useEffect(() => {
    fetchLinkedDocs();
  }, [fetchLinkedDocs]);

  const loadAvailableDocs = useCallback(async () => {
    setLoadingAvailable(true);
    const params = new URLSearchParams({ limit: "50" });
    if (searchDoc) params.set("search", searchDoc);
    const res = await fetch(`/api/v1/documents?${params}`);
    if (res.ok) {
      const json = await res.json();
      setAvailableDocs(
        (json.data ?? []).map((d: any) => ({
          id: d.id,
          title: d.title,
          category: d.category,
          status: d.status,
        })),
      );
    }
    setLoadingAvailable(false);
  }, [searchDoc]);

  useEffect(() => {
    if (linkDialogOpen) loadAvailableDocs();
  }, [linkDialogOpen, searchDoc, loadAvailableDocs]);

  const linkDocument = async (documentId: string) => {
    await fetch("/api/v1/entity-documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId, entityType, entityId }),
    });
    await fetchLinkedDocs();
  };

  const unlinkDocument = async (linkId: string) => {
    await fetch(`/api/v1/entity-documents?id=${linkId}`, { method: "DELETE" });
    await fetchLinkedDocs();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" />
          {t("title")} ({docs.length})
        </h3>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setLinkDialogOpen(true)}
        >
          <Plus className="h-3 w-3 mr-1" />
          {t("attachDocument")}
        </Button>
      </div>

      {docs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {t("noLinkedDocuments")}
        </p>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div
              key={doc.link_id}
              className="flex items-center justify-between rounded-lg border p-3"
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <Link
                    href={`/documents/${doc.document_id}`}
                    className="text-sm font-medium hover:underline truncate block"
                  >
                    {doc.title}
                  </Link>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge
                      className={`${STATUS_COLORS[doc.status] ?? ""} text-[10px]`}
                    >
                      {doc.status}
                    </Badge>
                    <span>{doc.category}</span>
                    <span>v{doc.current_version}</span>
                    {doc.file_name && (
                      <span>{formatFileSize(doc.file_size)}</span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {doc.file_name && (
                  <a
                    href={`/api/v1/documents/${doc.document_id}/download`}
                    className="rounded p-1.5 hover:bg-gray-100"
                    title={t("download")}
                  >
                    <Download className="h-3.5 w-3.5 text-muted-foreground" />
                  </a>
                )}
                <Link
                  href={`/documents/${doc.document_id}`}
                  className="rounded p-1.5 hover:bg-gray-100"
                >
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </Link>
                <button
                  onClick={() => unlinkDocument(doc.link_id)}
                  className="rounded p-1.5 hover:bg-red-50 text-muted-foreground hover:text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("attachDocument")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <input
              type="text"
              placeholder={t("searchDocuments")}
              value={searchDoc}
              onChange={(e) => setSearchDoc(e.target.value)}
              className="w-full rounded-md border px-3 py-2 text-sm"
            />
            <div className="max-h-72 overflow-y-auto rounded border">
              {loadingAvailable ? (
                <div className="flex justify-center py-6">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : availableDocs.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  {t("noDocumentsFound")}
                </p>
              ) : (
                availableDocs.map((d) => {
                  const isLinked = docs.some((ld) => ld.document_id === d.id);
                  return (
                    <div
                      key={d.id}
                      className="flex items-center justify-between border-b px-3 py-2.5 last:border-0 hover:bg-gray-50"
                    >
                      <div className="min-w-0 flex-1 mr-2">
                        <span className="text-sm font-medium truncate block">
                          {d.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {d.category} &middot; {d.status}
                        </span>
                      </div>
                      {isLinked ? (
                        <Badge
                          variant="secondary"
                          className="text-[10px] shrink-0"
                        >
                          {t("alreadyLinked")}
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => linkDocument(d.id)}
                          className="shrink-0"
                        >
                          <Plus className="h-3 w-3 mr-1" />
                          {t("attach")}
                        </Button>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
