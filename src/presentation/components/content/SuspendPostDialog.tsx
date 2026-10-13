import { useTranslation } from "react-i18next";

import { Form, FormAlert, FormField, useZodForm } from "@/presentation/components/form";
import { Button, ConfirmDialog, Modal, Textarea } from "@/presentation/components/ui";
import { suspendNoteSchema } from "@/presentation/schemas/content.schemas";
import type { SuspendNoteValues } from "@/presentation/schemas/content.schemas";

export interface SuspendPostDialogProps {
  open: boolean;
  /** `suspend` demands a moderation note; `reenable` sends an empty one. */
  mode: "suspend" | "reenable";
  /** Human label of the target post (caption or fallback id). */
  postLabel: string;
  loading: boolean;
  /** i18n key of the last failed action, or `null`. */
  errorKey: string | null;
  onConfirm: (note: string) => void;
  onCancel: () => void;
}

/**
 * Center moderation dialog for a staff-authored feed post.
 *
 * Contract (`controller/feed_post.controller.go` + `SetSuspended`): a NON-empty
 * `note` suspends the post, an EMPTY note re-enables it. The dialog therefore
 * requires a note when suspending (so the intent is explicit and the author can
 * see why) and sends `""` when re-enabling.
 */
export function SuspendPostDialog({
  open,
  mode,
  postLabel,
  loading,
  errorKey,
  onConfirm,
  onCancel,
}: SuspendPostDialogProps) {
  const { t } = useTranslation();
  const form = useZodForm<SuspendNoteValues>({
    schema: suspendNoteSchema,
    defaultValues: { note: "" },
  });

  if (!open) return null;

  if (mode === "reenable") {
    return (
      <ConfirmDialog
        open
        title={t("web.app.content.suspend.reenable_title")}
        description={t("web.app.content.suspend.reenable_body", { name: postLabel })}
        confirmLabel={t("web.app.content.suspend.reenable_confirm")}
        cancelLabel={t("common.cancel")}
        closeLabel={t("common.close")}
        confirmVariant="primary"
        loading={loading}
        error={errorKey}
        onConfirm={() => onConfirm("")}
        onCancel={onCancel}
      />
    );
  }

  return (
    <Modal
      open
      onClose={onCancel}
      closeLabel={t("common.close")}
      title={t("web.app.content.suspend.title")}
      description={t("web.app.content.suspend.body", { name: postLabel })}
    >
      <Form
        form={form}
        id="feed-post-suspend-form"
        className="flex flex-col gap-4"
        onSubmit={(values) => onConfirm(values.note.trim())}
      >
        <FormAlert message={errorKey} variant="error" />

        <FormField name="note" label={t("web.app.content.suspend.note_label")}>
          {({ field, invalid, describedBy, id }) => (
            <Textarea
              {...field}
              id={id}
              rows={3}
              maxLength={255}
              aria-invalid={invalid || undefined}
              aria-describedby={describedBy}
            />
          )}
        </FormField>

        <div className="flex items-center justify-end gap-3">
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" variant="danger" loading={loading}>
            {t("web.app.content.suspend.confirm")}
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
