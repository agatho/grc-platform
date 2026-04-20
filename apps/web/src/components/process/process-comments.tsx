"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useSession } from "next-auth/react";
import { toast } from "sonner";
import {
  MessageSquare,
  Reply,
  Check,
  Trash2,
  Loader2,
  Send,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@grc/ui";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Comment {
  id: string;
  processId: string;
  entityType: string;
  entityId: string;
  content: string;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  parentCommentId?: string;
  createdAt: string;
  createdBy: string;
  authorName?: string;
  authorEmail?: string;
  replies?: Comment[];
}

type FilterTab = "all" | "open" | "resolved";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProcessCommentsProps {
  processId: string;
  entityType?: "process" | "process_step";
  entityId?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ProcessComments({
  processId,
  entityType = "process",
  entityId,
}: ProcessCommentsProps) {
  const t = useTranslations("processGovernance");
  const { data: session } = useSession();

  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTab, setFilterTab] = useState<FilterTab>("all");
  const [newComment, setNewComment] = useState("");
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyContent, setReplyContent] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resolvedEntityId = entityId ?? processId;
  const userId = session?.user?.id;
  const userRole = session?.user?.roles?.[0]?.role;
  const isAdmin = userRole === "admin";
  const isProcessOwner = userRole === "process_owner";

  // Fetch comments
  const fetchComments = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterTab === "open") params.set("resolved", "false");
      if (filterTab === "resolved") params.set("resolved", "true");

      const res = await fetch(
        `/api/v1/processes/${processId}/comments?${params.toString()}`,
      );
      if (!res.ok) throw new Error("Failed to load comments");
      const json = await res.json();
      setComments(json.data ?? []);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [processId, filterTab]);

  useEffect(() => {
    void fetchComments();
  }, [fetchComments]);

  // Build threaded structure
  const threadedComments = buildThreads(comments);

  // Add comment
  const handleAddComment = async (parentId?: string) => {
    const content = parentId ? replyContent : newComment;
    if (!content.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(`/api/v1/processes/${processId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          entityType,
          entityId: resolvedEntityId,
          content: content.trim(),
          parentCommentId: parentId ?? undefined,
        }),
      });
      if (!res.ok) throw new Error("Failed to add comment");
      if (parentId) {
        setReplyContent("");
        setReplyTo(null);
      } else {
        setNewComment("");
      }
      void fetchComments();
    } catch {
      toast.error("Failed to add comment");
    } finally {
      setSubmitting(false);
    }
  };

  // Resolve comment
  const handleResolve = async (commentId: string) => {
    try {
      const res = await fetch(
        `/api/v1/processes/${processId}/comments/${commentId}/resolve`,
        { method: "PATCH" },
      );
      if (!res.ok) throw new Error("Failed to resolve");
      void fetchComments();
    } catch {
      toast.error("Failed to resolve comment");
    }
  };

  // Delete comment
  const handleDelete = async (commentId: string) => {
    try {
      const res = await fetch(
        `/api/v1/processes/${processId}/comments/${commentId}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("Failed to delete");
      void fetchComments();
    } catch {
      toast.error("Failed to delete comment");
    }
  };

  const FILTER_TABS: FilterTab[] = ["all", "open", "resolved"];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare size={20} />
          {t("comments.title")}
        </h3>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 rounded-lg bg-gray-100 p-1 w-fit">
        {FILTER_TABS.map((tab) => (
          <button
            key={tab}
            className={cn(
              "px-3 py-1 rounded-md text-sm font-medium transition-colors",
              filterTab === tab
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700",
            )}
            onClick={() => setFilterTab(tab)}
          >
            {t(`comments.${tab}`)}
          </button>
        ))}
      </div>

      {/* Comments list */}
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-gray-400" />
        </div>
      ) : threadedComments.length === 0 ? (
        <div className="text-center py-8">
          <MessageSquare className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-2 text-sm text-gray-500">
            {t("comments.noComments")}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {threadedComments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              depth={0}
              userId={userId}
              isAdmin={isAdmin}
              isProcessOwner={isProcessOwner}
              replyTo={replyTo}
              replyContent={replyContent}
              submitting={submitting}
              onReply={(id) => {
                setReplyTo(replyTo === id ? null : id);
                setReplyContent("");
              }}
              onReplyContentChange={setReplyContent}
              onSubmitReply={(parentId) => handleAddComment(parentId)}
              onResolve={handleResolve}
              onDelete={handleDelete}
              t={t}
            />
          ))}
        </div>
      )}

      {/* Add comment form */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex gap-2">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder={t("comments.addComment")}
            rows={2}
            className="flex-1 rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          <Button
            size="sm"
            onClick={() => handleAddComment()}
            disabled={!newComment.trim() || submitting}
            className="self-end"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comment Item
// ---------------------------------------------------------------------------

function CommentItem({
  comment,
  depth,
  userId,
  isAdmin,
  isProcessOwner,
  replyTo,
  replyContent,
  submitting,
  onReply,
  onReplyContentChange,
  onSubmitReply,
  onResolve,
  onDelete,
  t,
}: {
  comment: Comment;
  depth: number;
  userId?: string;
  isAdmin: boolean;
  isProcessOwner: boolean;
  replyTo: string | null;
  replyContent: string;
  submitting: boolean;
  onReply: (id: string) => void;
  onReplyContentChange: (val: string) => void;
  onSubmitReply: (parentId: string) => void;
  onResolve: (id: string) => void;
  onDelete: (id: string) => void;
  t: ReturnType<typeof useTranslations>;
}) {
  const isAuthor = userId === comment.createdBy;
  const canResolve = isAdmin || isProcessOwner;
  const canDelete = isAdmin || isAuthor;

  return (
    <div
      className={cn(
        "space-y-2",
        depth > 0 && "ml-8 border-l-2 border-gray-100 pl-4",
      )}
    >
      <div
        className={cn(
          "rounded-lg border p-3",
          comment.isResolved
            ? "border-green-100 bg-green-50"
            : "border-gray-200 bg-white",
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="flex items-center justify-center h-6 w-6 rounded-full bg-gray-200">
            <User size={12} className="text-gray-500" />
          </div>
          <span className="font-medium text-gray-700">
            {comment.authorName ?? comment.authorEmail ?? "User"}
          </span>
          <span>{new Date(comment.createdAt).toLocaleString()}</span>
          {comment.isResolved && (
            <Badge
              variant="secondary"
              className="text-[10px] bg-green-100 text-green-700"
            >
              {t("comments.resolved")}
            </Badge>
          )}
        </div>

        {/* Content */}
        <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
          {comment.content}
        </p>

        {/* Actions */}
        <div className="mt-2 flex items-center gap-2">
          {depth === 0 && (
            <button
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-indigo-600 transition-colors"
              onClick={() => onReply(comment.id)}
            >
              <Reply size={12} />
              {t("comments.reply")}
            </button>
          )}
          {canResolve && !comment.isResolved && (
            <button
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-green-600 transition-colors"
              onClick={() => onResolve(comment.id)}
            >
              <Check size={12} />
              {t("comments.resolve")}
            </button>
          )}
          {canDelete && (
            <button
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-red-600 transition-colors"
              onClick={() => onDelete(comment.id)}
            >
              <Trash2 size={12} />
              {t("comments.delete")}
            </button>
          )}
        </div>
      </div>

      {/* Reply form */}
      {replyTo === comment.id && (
        <div className="ml-8 flex gap-2">
          <textarea
            value={replyContent}
            onChange={(e) => onReplyContentChange(e.target.value)}
            placeholder={t("comments.reply") + "..."}
            rows={2}
            className="flex-1 rounded-md border border-gray-300 p-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 resize-none"
          />
          <Button
            size="sm"
            onClick={() => onSubmitReply(comment.id)}
            disabled={!replyContent.trim() || submitting}
            className="self-end"
          >
            {submitting ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Send size={14} />
            )}
          </Button>
        </div>
      )}

      {/* Replies */}
      {comment.replies?.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          depth={depth + 1}
          userId={userId}
          isAdmin={isAdmin}
          isProcessOwner={isProcessOwner}
          replyTo={replyTo}
          replyContent={replyContent}
          submitting={submitting}
          onReply={onReply}
          onReplyContentChange={onReplyContentChange}
          onSubmitReply={onSubmitReply}
          onResolve={onResolve}
          onDelete={onDelete}
          t={t}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Thread builder
// ---------------------------------------------------------------------------

function buildThreads(comments: Comment[]): Comment[] {
  const map = new Map<string, Comment>();
  const roots: Comment[] = [];

  for (const c of comments) {
    map.set(c.id, { ...c, replies: [] });
  }

  for (const c of comments) {
    const node = map.get(c.id)!;
    if (c.parentCommentId && map.has(c.parentCommentId)) {
      map.get(c.parentCommentId)!.replies!.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}
