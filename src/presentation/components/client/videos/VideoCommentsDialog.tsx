import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import type { CommentItem } from "yotuvia-core";

import { Button, Modal, Skeleton } from "@/presentation/components/ui";

export interface VideoCommentsDialogProps {
  open: boolean;
  postId: number | null;
  comments: CommentItem[];
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  onLoadMore: (postId: number) => void;
  onAdd: (postId: number, body: string) => Promise<void>;
  onReply: (postId: number, commentId: number, body: string) => Promise<void>;
  onDelete: (postId: number, commentId: number) => Promise<void>;
  onClose: () => void;
}

interface CommentRowProps {
  comment: CommentItem;
  onReply: (commentId: number) => void;
  onDelete: (commentId: number) => void;
  depth?: number;
}

function CommentRow({ comment, onReply, onDelete, depth = 0 }: CommentRowProps) {
  const { t } = useTranslation();
  return (
    <li className={depth > 0 ? "ml-6 border-l border-border pl-3" : undefined}>
      <div className="flex flex-col gap-0.5 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-text">{comment.author.name}</span>
          {comment.is_official ? (
            <span className="rounded bg-accent/15 px-1.5 py-0.5 text-[10px] font-bold uppercase text-accent">
              {t("client.feed.official_reply")}
            </span>
          ) : null}
        </div>
        <p className="text-sm text-text-muted">
          {comment.is_hidden ? t("client.feed.comment_hidden") : comment.body}
        </p>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onReply(comment.id)}
            className="rounded text-xs font-semibold text-text-muted hover:text-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("client.feed.reply")}
          </button>
          <button
            type="button"
            onClick={() => onDelete(comment.id)}
            className="rounded text-xs font-semibold text-text-muted hover:text-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {t("common.delete", "Delete")}
          </button>
        </div>
      </div>
      {comment.replies && comment.replies.length > 0 ? (
        <ul>
          {comment.replies.map((reply) => (
            <CommentRow key={reply.id} comment={reply} onReply={onReply} onDelete={onDelete} depth={depth + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

/**
 * Comments panel for one reel video. The page owns the data (via
 * `useVideoComments`); this component only renders and collects input.
 */
export function VideoCommentsDialog({
  open,
  postId,
  comments,
  loading,
  loadingMore,
  hasMore,
  onLoadMore,
  onAdd,
  onReply,
  onDelete,
  onClose,
}: VideoCommentsDialogProps) {
  const { t } = useTranslation();
  const fieldId = useId();
  const [body, setBody] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!postId || body.trim().length === 0 || submitting) return;
    setSubmitting(true);
    try {
      if (replyTo !== null) await onReply(postId, replyTo, body.trim());
      else await onAdd(postId, body.trim());
      setBody("");
      setReplyTo(null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} closeLabel={t("common.close")} title={t("client.feed.comments")}>
      <div className="flex max-h-[60vh] flex-col gap-3">
        {loading ? (
          <div className="flex flex-col gap-2" role="status" aria-live="polite">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : comments.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-muted">{t("client.feed.comments_empty")}</p>
        ) : (
          <ul className="flex-1 overflow-y-auto">
            {comments.map((comment) => (
              <CommentRow
                key={comment.id}
                comment={comment}
                onReply={setReplyTo}
                onDelete={(commentId) => {
                  if (postId) void onDelete(postId, commentId);
                }}
              />
            ))}
          </ul>
        )}

        {hasMore ? (
          <Button
            variant="outline"
            size="sm"
            className="self-center"
            disabled={loadingMore}
            onClick={() => postId && onLoadMore(postId)}
          >
            {t("common.load_more", "Load more")}
          </Button>
        ) : null}

        {replyTo !== null ? (
          <p className="text-xs text-text-muted">{t("client.feed.replying_to")}…</p>
        ) : null}

        <div className="flex items-end gap-2 border-t border-border pt-3">
          <label htmlFor={fieldId} className="sr-only">
            {t("client.feed.comment_placeholder")}
          </label>
          <textarea
            id={fieldId}
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              replyTo !== null ? t("client.feed.reply_placeholder") : t("client.feed.comment_placeholder")
            }
            rows={2}
            className="flex-1 resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-input-text placeholder:text-input-placeholder focus:outline-none focus:ring-2 focus:ring-accent"
          />
          <Button disabled={body.trim().length === 0 || submitting} onClick={() => void submit()}>
            {t("client.feed.reply", "Send")}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
