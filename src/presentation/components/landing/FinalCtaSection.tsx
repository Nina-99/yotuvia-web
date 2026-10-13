import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { buttonClasses } from "@/presentation/components/ui";
import { ROUTES } from "@/presentation/lib/routes";

import { Reveal } from "./Reveal";
import { IconArrowRight } from "./icons";

export function FinalCtaSection() {
  const { t } = useTranslation();

  return (
    <section id="contact" aria-labelledby="final-cta-title" className="px-4 py-16 sm:px-6">
      <Reveal className="mx-auto w-full max-w-6xl">
        <div className="flex flex-col items-center gap-6 rounded-xl bg-accent px-6 py-12 text-center">
          <h2
            id="final-cta-title"
            className="max-w-2xl text-2xl font-bold tracking-tight text-on-accent sm:text-3xl"
          >
            {t("web.home.final_cta.title")}
          </h2>
          <p className="max-w-xl text-on-accent/80">{t("web.home.final_cta.subtitle")}</p>
          <div className="flex flex-wrap justify-center gap-3">
            <Link
              to={ROUTES.centers.search}
              className={buttonClasses({
                variant: "secondary",
                size: "lg",
                className: "ytv-cta group",
              })}
            >
              {t("web.home.final_cta.cta_primary")}
              <IconArrowRight className="ytv-cta-arrow h-4 w-4" />
            </Link>
            <Link
              to={ROUTES.login}
              className={buttonClasses({
                variant: "outline",
                size: "lg",
                className: "ytv-cta border-on-accent/40 text-on-accent hover:bg-on-accent/10",
              })}
            >
              {t("web.home.final_cta.cta_secondary")}
            </Link>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
