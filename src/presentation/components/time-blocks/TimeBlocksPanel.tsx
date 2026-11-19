import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TimeBlock } from "yotuvia-core";

import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  Input,
  Select,
  Skeleton,
} from "@/presentation/components/ui";
import { useAuthSession } from "@/presentation/hooks/use-auth-session";
import { useCenterPersonnel } from "@/presentation/hooks/use-personnel";
import {
  useCreateTimeBlock,
  useDeleteTimeBlock,
  useTimeBlocks,
} from "@/presentation/hooks/use-time-blocks";
import { addDays, toDateKey } from "@/presentation/lib/dates";
import { useErrorMessage } from "@/presentation/lib/errors";
import { formatDate, formatTime } from "@/presentation/lib/format";

/** How far ahead the list reaches from today. */
const HORIZON_DAYS = 30;

interface TimeBlocksPanelProps {
  /**
   * Owner mode: the actor may block the WHOLE centre or pick any professional.
   * Staff mode blocks only the caller's own time (the backend enforces this).
   */
  owner: boolean;
}

/**
 * Unavailability blocks (breaks, holidays): create and list.
 *
 * Shared by the owner (`/app/blocks`) and staff (`/app/staff/blocks`) surfaces —
 * the only difference is the professional scope, driven by the `owner` flag.
 */
export function TimeBlocksPanel({ owner }: TimeBlocksPanelProps) {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  const { user } = useAuthSession();
  const centerId = Number(user?.id ?? 0);

  const today = useMemo(() => toDateKey(new Date()), []);
  const horizon = useMemo(() => addDays(today, HORIZON_DAYS), [today]);

  const [date, setDate] = useState(today);
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("13:00");
  const [reason, setReason] = useState("");
  // "" = centre-wide (owner only); otherwise the professional's id as a string.
  const [personnel, setPersonnel] = useState("");
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TimeBlock | null>(null);

  const blocksQuery = useTimeBlocks(today, horizon);
  const personnelQuery = useCenterPersonnel(centerId, { enabled: owner });
  const createBlock = useCreateTimeBlock();
  const deleteBlock = useDeleteTimeBlock();

  const listError = useErrorMessage(blocksQuery.error, "web.blocks.error_fetch");
  const createError = createBlock.errorKey ? t(createBlock.errorKey) : null;
  const deleteError = deleteBlock.errorKey ? t(deleteBlock.errorKey) : null;

  const blocks = useMemo(
    () =>
      [...(blocksQuery.data ?? [])].sort((a, b) =>
        a.date === b.date ? a.startTime.localeCompare(b.startTime) : a.date.localeCompare(b.date),
      ),
    [blocksQuery.data],
  );

  const professionalName = (personnelId: number | null) => {
    if (personnelId === null) return t("web.blocks.centre_wide");
    const found = personnelQuery.data?.find((p) => p.id === personnelId);
    if (!found) return t("web.blocks.professional_fallback", { id: personnelId });
    return `${found.firstName} ${found.lastName}`.trim();
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    setRangeError(null);
    if (end <= start) {
      setRangeError(t("web.blocks.error_range"));
      return;
    }
    createBlock.mutate(
      {
        date,
        startTime: start,
        endTime: end,
        reason: reason.trim() || undefined,
        // Owner: "" is a centre-wide block; staff always omit the field so the
        // backend forces the caller's own id.
        personnelId: owner && personnel !== "" ? Number(personnel) : null,
      },
      { onSuccess: () => setReason("") },
    );
  };

  return (
    <div className="flex flex-col gap-6">
      <h2 className="ytv-display text-3xl font-bold text-text">{t("web.blocks.title")}</h2>

      <Card>
        <CardHeader>
          <CardTitle>{t("web.blocks.form_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="flex flex-col gap-4" onSubmit={onSubmit}>
            {!owner ? <p className="text-sm text-text-muted">{t("web.blocks.staff_notice")}</p> : null}

            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                type="date"
                label={t("web.blocks.date")}
                value={date}
                min={today}
                onChange={(event) => setDate(event.target.value)}
                required
              />
              <Input
                type="time"
                label={t("web.blocks.start")}
                value={start}
                onChange={(event) => setStart(event.target.value)}
                required
              />
              <Input
                type="time"
                label={t("web.blocks.end")}
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                error={rangeError ?? undefined}
                required
              />
            </div>

            {owner ? (
              <Select
                label={t("web.blocks.professional")}
                value={personnel}
                onChange={(event) => setPersonnel(event.target.value)}
              >
                <option value="">{t("web.blocks.centre_wide")}</option>
                {(personnelQuery.data ?? []).map((p) => (
                  <option key={p.id} value={String(p.id)}>
                    {`${p.firstName} ${p.lastName}`.trim()}
                  </option>
                ))}
              </Select>
            ) : null}

            <Input
              label={t("web.blocks.reason")}
              value={reason}
              maxLength={255}
              placeholder={t("web.blocks.reason_placeholder")}
              onChange={(event) => setReason(event.target.value)}
            />

            {createError ? (
              <p role="alert" className="text-sm text-danger">
                {createError}
              </p>
            ) : null}

            <Button type="submit" className="self-start" loading={createBlock.isPending}>
              {t("web.blocks.submit")}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t("web.blocks.list_title")}</CardTitle>
        </CardHeader>
        <CardContent>
          {blocksQuery.isPending ? (
            <div role="status" aria-live="polite" aria-label={t("common.loading")} className="flex flex-col gap-3">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : blocksQuery.isError ? (
            <div role="alert" className="flex flex-col gap-4">
              <p className="text-sm text-text-muted">{listError}</p>
              <Button variant="outline" className="self-start" onClick={() => void blocksQuery.refetch()}>
                {t("common.retry")}
              </Button>
            </div>
          ) : blocks.length === 0 ? (
            <EmptyState title={t("web.blocks.empty")} body={t("web.blocks.empty_sub")} />
          ) : (
            <ul className="flex flex-col gap-3">
              {blocks.map((block) => (
                <li
                  key={block.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card p-4"
                >
                  <div className="flex flex-col gap-1">
                    <span className="text-sm font-semibold text-text">
                      {formatDate(block.date, language)} · {formatTime(block.startTime)} –{" "}
                      {formatTime(block.endTime)}
                    </span>
                    <span className="flex flex-wrap gap-x-3 text-xs text-text-muted">
                      <span>{professionalName(block.personnelId)}</span>
                      {block.reason ? <span>{block.reason}</span> : null}
                    </span>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => setDeleteTarget(block)}>
                    {t("common.delete")}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("web.blocks.delete_title")}
        description={t("web.blocks.delete_body")}
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        closeLabel={t("common.close")}
        loading={deleteBlock.isPending}
        error={deleteError}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget === null) return;
          deleteBlock.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}
      />
    </div>
  );
}
