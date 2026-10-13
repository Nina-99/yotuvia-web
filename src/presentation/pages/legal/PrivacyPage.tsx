import { useTranslation } from "react-i18next";

import { LegalDocument } from "@/presentation/components/legal/LegalDocument";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { PublicLayout } from "@/presentation/layouts/PublicLayout";

/** Public Privacy Policy (`/privacy`). DRAFT — pending legal review. */
export function PrivacyPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("web.legal.privacy.meta_title"));

  return (
    <PublicLayout>
      <LegalDocument page="privacy" />
    </PublicLayout>
  );
}
