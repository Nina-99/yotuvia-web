import type { ComponentType } from "react";
import { useTranslation } from "react-i18next";

import { Card, CardDescription, CardHeader, CardTitle } from "@/presentation/components/ui";

import { Reveal } from "./Reveal";
import {
  IconBadge,
  IconCalendar,
  IconCoin,
  IconGift,
  IconImage,
  IconScissors,
  IconUsers,
} from "./icons";
import type { IconProps } from "./icons";

interface OwnerFeature {
  /** i18n key suffix: resolves to `{key}_title` and `{key}_body`. */
  key: string;
  icon: ComponentType<IconProps>;
}

const OWNER_FEATURES: readonly OwnerFeature[] = [
  { key: "agenda", icon: IconCalendar },
  { key: "clients", icon: IconUsers },
  { key: "services", icon: IconScissors },
  { key: "personnel", icon: IconBadge },
  { key: "loyalty", icon: IconGift },
  { key: "tokens", icon: IconCoin },
  { key: "content", icon: IconImage },
];

export function OwnerFeaturesSection() {
  const { t } = useTranslation();

  return (
    <section id="features" aria-labelledby="features-title" className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
      <Reveal>
        <h2 id="features-title" className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
          {t("web.home.owners.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-text-muted">{t("web.home.owners.subtitle")}</p>
      </Reveal>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {OWNER_FEATURES.map(({ key, icon: FeatureIcon }, index) => (
          <li key={key} className="h-full">
            <Reveal delay={index * 70} className="h-full">
              <Card className="ytv-card-interactive group h-full">
                <CardHeader>
                  <span className="ytv-icon-pop flex h-10 w-10 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <FeatureIcon className="h-5 w-5" />
                  </span>
                  <CardTitle>{t(`web.home.owners.${key}_title`)}</CardTitle>
                  <CardDescription>{t(`web.home.owners.${key}_body`)}</CardDescription>
                </CardHeader>
              </Card>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}
