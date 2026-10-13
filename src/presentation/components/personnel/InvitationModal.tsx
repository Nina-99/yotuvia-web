import { useTranslation } from "react-i18next";

import { Form, FormAlert, FormField, useZodForm } from "@/presentation/components/form";
import { Badge, Button, Input, Modal, useToast } from "@/presentation/components/ui";
import { EMPTY_INVITATION_FORM, invitationSchema } from "@/presentation/schemas/personnel.schemas";
import type { InvitationFormValues } from "@/presentation/schemas/personnel.schemas";

export interface InvitationModalProps {
  /** Result of the last successful generation, or `null` before the first call. */
  result: { token: string; link: string } | null;
  generating: boolean;
  /** i18n key of the last failed generation, or `null`. */
  errorKey: string | null;
  onClose: () => void;
  onGenerate: (values: InvitationFormValues) => void;
}

/**
 * Invitation dialog: generates a `{ token, link }` pair and shows both.
 *
 * The API builds `link` from `INVITE_BASE_URL` — `https://yotuvia.com/join/`
 * in production — so it is a real, openable web URL: the invitation renders as
 * an anchor and can also be copied. The token stays as read-only copyable text.
 * When the Clipboard API is unavailable (insecure context, older browser) the
 * value is selected on focus and the failure is surfaced instead of failing
 * silently.
 */
export function InvitationModal({
  result,
  generating,
  errorKey,
  onClose,
  onGenerate,
}: InvitationModalProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const form = useZodForm<InvitationFormValues>({
    schema: invitationSchema,
    defaultValues: EMPTY_INVITATION_FORM,
  });

  const copy = async (value: string) => {
    try {
      if (typeof navigator === "undefined" || !navigator.clipboard?.writeText) {
        throw new Error("Clipboard API unavailable");
      }
      await navigator.clipboard.writeText(value);
      toast(t("web.app.personnel.invite.copied"), { variant: "success" });
    } catch {
      toast(t("web.app.personnel.invite.copy_failed"), { variant: "error" });
    }
  };

  const field = (label: string, value: string, testId: string) => (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={testId} className="text-sm font-medium text-text">
        {label}
      </label>
      <div className="flex items-center gap-2">
        <Input
          id={testId}
          readOnly
          value={value}
          className="text-xs"
          onFocus={(event) => event.currentTarget.select()}
        />
        <Button size="sm" variant="outline" onClick={() => void copy(value)}>
          {t("web.app.personnel.invite.copy")}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open
      onClose={onClose}
      closeLabel={t("common.close")}
      title={t("web.app.personnel.invite.title")}
      description={t("web.app.personnel.invite.subtitle")}
      footer={
        result ? (
          <Button onClick={onClose}>{t("web.app.personnel.invite.close")}</Button>
        ) : (
          <>
            <Button variant="outline" onClick={onClose} disabled={generating}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="invitation-form" loading={generating}>
              {t("web.app.personnel.invite.submit")}
            </Button>
          </>
        )
      }
    >
      {result ? (
        <div className="flex flex-col gap-4">
          <div>
            <Badge variant="success">{t("web.app.personnel.invite.success_title")}</Badge>
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="invitation-link" className="text-sm font-medium text-text">
              {t("web.app.personnel.invite.link_label")}
            </label>
            <div className="flex items-center gap-2">
              <a
                id="invitation-link"
                href={result.link}
                target="_blank"
                rel="noopener noreferrer"
                className="min-w-0 flex-1 truncate text-xs font-medium text-link hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {result.link}
              </a>
              <Button size="sm" variant="outline" onClick={() => void copy(result.link)}>
                {t("web.app.personnel.invite.copy")}
              </Button>
            </div>
          </div>
          {field(t("web.app.personnel.invite.token_label"), result.token, "invitation-token")}
          <FormAlert message={t("web.app.personnel.invite.link_hint")} variant="info" />
          <p className="text-xs text-text-muted">{t("web.app.personnel.invite.expires_hint")}</p>
        </div>
      ) : (
        <Form
          form={form}
          id="invitation-form"
          className="flex flex-col gap-4"
          onSubmit={onGenerate}
        >
          <FormAlert message={errorKey} variant="error" />
          <FormField name="email" label={t("web.app.personnel.invite.email")}>
            {({ field: boundField, invalid, describedBy, id }) => (
              <Input
                {...boundField}
                id={id}
                type="email"
                autoComplete="off"
                placeholder={t("web.app.personnel.invite.email_placeholder")}
                aria-invalid={invalid || undefined}
                aria-describedby={describedBy}
              />
            )}
          </FormField>
        </Form>
      )}
    </Modal>
  );
}
