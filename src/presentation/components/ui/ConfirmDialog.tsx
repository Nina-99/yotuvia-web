import type { ReactNode } from "react";

import { FormAlert } from "@/presentation/components/form";

import { Button } from "./Button";
import type { ButtonVariant } from "./button-variants";
import { Modal } from "./Modal";

export interface ConfirmDialogProps {
  open: boolean;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  /** Accessible label for the modal close button (pass a translated string). */
  closeLabel: string;
  confirmVariant?: ButtonVariant;
  loading?: boolean;
  /** i18n key or literal message shown inside the dialog when the action failed. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation dialog for destructive or hard-to-undo actions.
 *
 * Built on `Modal`, so it inherits focus trapping, Escape handling, focus
 * restore and `role="dialog"` labelling. Destructive confirmations render a
 * `danger` button (never a primary one) and a failure keeps the dialog open so
 * the user can retry instead of losing context.
 */
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  closeLabel,
  confirmVariant = "danger",
  loading = false,
  error,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onCancel}
      closeLabel={closeLabel}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button variant={confirmVariant} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <FormAlert message={error} variant="error" />
    </Modal>
  );
}
