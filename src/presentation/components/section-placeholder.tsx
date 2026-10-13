import { useTranslation } from "react-i18next";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/presentation/components/ui";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";

export interface SectionPlaceholderProps {
  /** i18n key for the section name (usually the nav label key). */
  titleKey: string;
}

/**
 * Clearly-marked stand-in for an app section whose real screen ships in a later
 * work unit.
 *
 * Every sidebar route resolves to one of these so navigation works end to end
 * (no dead links). Replacing a placeholder means swapping the route element in
 * `routes/router.tsx` — nothing else.
 */
export function SectionPlaceholder({ titleKey }: SectionPlaceholderProps) {
  const { t } = useTranslation();
  useDocumentTitle(t(titleKey));

  return (
    <Card data-testid="section-placeholder">
      <CardHeader>
        <div className="flex items-center gap-3">
          <CardTitle>{t(titleKey)}</CardTitle>
          <Badge variant="warning">{t("web.app.placeholder.badge")}</Badge>
        </div>
        <CardDescription>{t("web.app.placeholder.body")}</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-text-muted">{t("web.app.placeholder.hint")}</p>
      </CardContent>
    </Card>
  );
}
