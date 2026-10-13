import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import { Card, CardDescription, CardHeader, CardTitle } from "@/presentation/components/ui";

import { Reveal } from "./Reveal";
import { IconBell, IconClock, IconSparkles } from "./icons";
import type { IconProps } from "./icons";

interface ClientFeature {
  /** i18n key suffix: resolves to `{key}_title` and `{key}_body`. */
  key: string;
  icon: ComponentType<IconProps>;
}

const CLIENT_FEATURES: readonly ClientFeature[] = [
  { key: "discover", icon: IconSparkles },
  { key: "book", icon: IconClock },
  { key: "waitlist", icon: IconBell },
];

export function ClientFeaturesSection() {
  const { t } = useTranslation();

  return (
    <section
      aria-labelledby="client-features-title"
      className="border-y border-border bg-card"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <h2
            id="client-features-title"
            className="text-2xl font-bold tracking-tight text-text sm:text-3xl"
          >
            {t("web.home.clients.title")}
          </h2>
          <p className="mt-2 max-w-2xl text-text-muted">{t("web.home.clients.subtitle")}</p>
        </Reveal>

        <ul className="mt-8 grid gap-4 sm:grid-cols-3">
          {CLIENT_FEATURES.map(({ key, icon: FeatureIcon }, index) => (
            <li key={key} className="h-full">
              <Reveal delay={index * 80} className="h-full">
                <Card className="ytv-card-interactive group h-full">
                  <CardHeader>
                    <span className="ytv-icon-pop flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
                      <FeatureIcon className="h-5 w-5" />
                    </span>
                    <CardTitle>{t(`web.home.clients.${key}_title`)}</CardTitle>
                    <CardDescription>{t(`web.home.clients.${key}_body`)}</CardDescription>
                  </CardHeader>
                </Card>
              </Reveal>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
