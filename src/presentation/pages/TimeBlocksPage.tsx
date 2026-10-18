import { useTranslation } from "react-i18next";

import { TimeBlocksPanel } from "@/presentation/components/time-blocks/TimeBlocksPanel";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";

/**
 * Owner surface for unavailability blocks: the whole centre (holidays) or one
 * professional's break. The panel owns the create/list/delete flow, shared with
 * the staff surface.
 */
export function TimeBlocksPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("web.blocks.meta_title"));

  return <TimeBlocksPanel owner />;
}
