import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { Reservation } from "yotuvia-core";

import { FormAlert } from "@/presentation/components/form";
import { Button, Input, Modal } from "@/presentation/components/ui";

export interface StaffRescheduleDialogProps {
  /** The appointment being moved. Non-null: the caller mounts this only then. */
  reservation: Reservation;
  /** True while the reschedule request is in flight. */
  saving: boolean;
  /** i18n key of the failure, or `null`. */
  errorKey: string | null;
  onSubmit: (date: string, startTime: string) => void;
  onClose: () => void;
}

/**
 * Move ONE of the professional's own appointments to a new day/slot.
 *
 * Date + start time only: the payload keeps the same services and professional,
 * because the backend refuses to move the lead (a staff member reschedules, they
 * do not reassign).
 *
 * The caller mounts this per reservation (keyed), so the fields seed from the
 * row at mount — no state sync effect.
 */
export function StaffRescheduleDialog({
  reservation,
  saving,
  errorKey,
  onSubmit,
  onClose,
}: StaffRescheduleDialogProps) {
  const { t } = useTranslation();
  const [date, setDate] = useState(() => (reservation.date ?? "").split("T")[0]);
  const [startTime, setStartTime] = useState(() => reservation.startTime.slice(0, 5));

  return (
    <Modal
      open
      onClose={saving ? () => undefined : onClose}
      closeLabel={t("common.close")}
      title={t("staff.agenda.reschedule_title")}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {t("common.cancel")}
          </Button>
          <Button
            onClick={() => onSubmit(date, startTime)}
            loading={saving}
            disabled={date === "" || startTime === ""}
          >
            {t("staff.agenda.reschedule_submit")}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <Input
          label={t("staff.agenda.reschedule_date")}
          type="date"
          value={date}
          disabled={saving}
          onChange={(event) => setDate(event.target.value)}
        />
        <Input
          label={t("staff.agenda.reschedule_time")}
          type="time"
          value={startTime}
          disabled={saving}
          onChange={(event) => setStartTime(event.target.value)}
        />
        <FormAlert message={errorKey} variant="error" />
      </div>
    </Modal>
  );
}
