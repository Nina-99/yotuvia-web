import { useTranslation } from "react-i18next";

import {
  CenterSearchSection,
  ClientFeaturesSection,
  FaqSection,
  FinalCtaSection,
  HeroSection,
  HowItWorksSection,
  OwnerFeaturesSection,
  PricingSection,
  ScrollProgress,
} from "@/presentation/components/landing";
// Landing-only motion: travels with the lazy landing chunk, never the entry CSS.
import "@/presentation/components/landing/landing-motion.css";
import { useDocumentTitle } from "@/presentation/hooks/use-document-title";
import { useHashScroll } from "@/presentation/hooks/use-hash-scroll";
import { PublicLayout } from "@/presentation/layouts/PublicLayout";

/**
 * Public landing page.
 *
 * Composes the landing sections inside `PublicLayout` (header, footer and the
 * language control). Every string is resolved through i18n under the
 * `web.home` namespace.
 */
export function HomePage() {
  const { t } = useTranslation();
  useDocumentTitle(t("web.home.meta.title"));
  // Smooth-scrolls to the section named by the URL hash (see the hook docs).
  useHashScroll();

  return (
    <PublicLayout>
      <ScrollProgress />
      <HeroSection />
      <CenterSearchSection />
      <OwnerFeaturesSection />
      <ClientFeaturesSection />
      <HowItWorksSection />
      <PricingSection />
      <FaqSection />
      <FinalCtaSection />
    </PublicLayout>
  );
}
