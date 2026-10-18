import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button, Input } from "@/presentation/components/ui";
import { useJoinWaitlist } from "@/presentation/hooks/use-waitlist";

export interface WaitlistJoinPromptProps {
  centerId: number;
  /** Calendar day the client is looking at (`YYYY-MM-DD`). */
  date: string;
  /** The professional the client wants; the waitlist is PER professional. */
  personnelId: number | null;
  serviceIds: number[];
}

/**
 * Waitlist opt-in for a day with no free slots.
 *
 * The waitlist is per PER professional and per CONCRETE start time, so the
 * client has to name both: the professional comes from the schedule step's own
 * selector (this prompt only asks for the time) and the time defaults to a
 * plausible hour the client can adjust. Without a chosen professional there is
 * nothing to wait for, so the prompt explains that instead of failing.
 */
export function WaitlistJoinPrompt({
  centerId,
  date,
  personnelId,
  serviceIds,
}: WaitlistJoinPromptProps) {
  const { t } = useTranslation();
  const [startTime, setStartTime] = useState("10:00");
  const [joined, setJoined] = useState(false);
  const join = useJoinWaitlist();

  if (joined) {
    return (
      <p role="status" className="text-sm text-text">
        {t("web.waitlist.join_success")}
      </p>
    );
  }

  if (personnelId === null) {
    return (
      <p className="text-sm text-text-muted">{t("web.waitlist.join_pick_professional")}</p>
    );
  }

  const onJoin = async () => {
    try {
      await join.mutateAsync({
        beautyCenterId: centerId,
        date,
        startTime,
        personnelId,
        serviceIds,
      });
      setJoined(true);
    } catch {
      // The error key is rendered below; nothing else to do here.
    }
  };

  return (
    <div className="flex flex-col items-start gap-3 rounded-lg border border-border bg-card p-3">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-text">{t("web.waitlist.join_title")}</p>
        <p className="text-xs text-text-muted">{t("web.waitlist.join_body")}</p>
      </div>

      <Input
        type="time"
        label={t("web.waitlist.join_time")}
        value={startTime}
        onChange={(event) => setStartTime(event.target.value)}
      />

      {join.errorKey ? (
        <p role="alert" className="text-sm text-danger">
          {t(join.errorKey)}
        </p>
      ) : null}

      <Button
        variant="outline"
        loading={join.isPending}
        disabled={startTime === ""}
        onClick={() => void onJoin()}
      >
        {t("web.waitlist.join_action")}
      </Button>
    </div>
  );
}
