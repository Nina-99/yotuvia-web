import { useTranslation } from "react-i18next";

import { LegalDocument } from "@/presentation/components/legal/LegalDocument";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { PublicLayout } from "@/presentation/layouts/PublicLayout";

/** Public Terms and Conditions (`/terms`). DRAFT — pending legal review. */
export function TermsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("web.legal.terms.meta_title"));

  return (
    <PublicLayout>
      <LegalDocument page="terms" />
    </PublicLayout>
  );
}
