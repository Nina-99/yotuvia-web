import { useTranslation } from "react-i18next";

import { TimeBlocksPanel } from "@/presentation/components/time-blocks/TimeBlocksPanel";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";

/**
 * Staff surface for the professional's OWN unavailability blocks (breaks). The
 * backend forces the block onto the caller, so no professional picker is shown.
 */
export function StaffBlocksPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("web.blocks.meta_title"));

  return <TimeBlocksPanel owner={false} />;
}
