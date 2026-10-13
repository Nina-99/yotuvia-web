import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AdminLoyaltySettings } from "yotuvia-core";

import { Button } from "@/presentation/components/ui";

export interface LoyaltySettingsFormProps {
  /** Server settings; the form seeds its local draft from these on mount. */
  settings: AdminLoyaltySettings;
  saving: boolean;
  onSave: (data: Partial<AdminLoyaltySettings>) => void;
}

/**
 * Center loyalty switches.
 *
 * The draft seeds from the server values via `useState` initialisers and is
 * only mounted once the query has data (the parent gates it), so no effect has
 * to sync server state into local state. `per_personnel` is disabled while
 * loyalty itself is off, mirroring what the value means.
 */
export function LoyaltySettingsForm({ settings, saving, onSave }: LoyaltySettingsFormProps) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(settings.loyalty_enabled);
  const [perPersonnel, setPerPersonnel] = useState(settings.loyalty_per_personnel);

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-text">
            {t("web.app.loyalty.settings.enabled")}
          </span>
          <span className="text-xs text-text-muted">
            {t("web.app.loyalty.settings.enabled_hint")}
          </span>
        </span>
      </label>

      <label className="flex items-start gap-3">
        <input
          type="checkbox"
          checked={perPersonnel}
          disabled={!enabled}
          onChange={(event) => setPerPersonnel(event.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-border accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-60"
        />
        <span className="flex flex-col">
          <span className="text-sm font-medium text-text">
            {t("web.app.loyalty.settings.per_personnel")}
          </span>
          <span className="text-xs text-text-muted">
            {t("web.app.loyalty.settings.per_personnel_hint")}
          </span>
        </span>
      </label>

      <Button
        className="self-start"
        onClick={() =>
          onSave({ loyalty_enabled: enabled, loyalty_per_personnel: perPersonnel })
        }
        loading={saving}
      >
        {t("web.app.loyalty.settings.save")}
      </Button>
    </div>
  );
}
