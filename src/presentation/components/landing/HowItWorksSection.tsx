import { useTranslation } from "react-i18next";

import { Reveal } from "./Reveal";

interface Step {
  /** i18n key suffix: resolves to `step_{n}_title` and `step_{n}_body`. */
  index: number;
}

const STEPS: readonly Step[] = [{ index: 1 }, { index: 2 }, { index: 3 }];

export function HowItWorksSection() {
  const { t } = useTranslation();

  return (
    <section
      id="how-it-works"
      aria-labelledby="how-it-works-title"
      className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6"
    >
      <Reveal>
        <h2
          id="how-it-works-title"
          className="text-2xl font-bold tracking-tight text-text sm:text-3xl"
        >
          {t("web.home.how.title")}
        </h2>
        <p className="mt-2 max-w-2xl text-text-muted">{t("web.home.how.subtitle")}</p>
      </Reveal>

      <ol className="mt-8 grid gap-6 sm:grid-cols-3">
        {STEPS.map(({ index }, position) => (
          <li key={index}>
            <Reveal delay={position * 90} className="flex flex-col gap-3">
              <span
                aria-hidden="true"
                className="ytv-step-badge relative flex h-10 w-10 items-center justify-center rounded-full bg-accent text-base font-bold text-on-accent transition-transform duration-200 motion-reduce:transition-none hover:scale-105 motion-reduce:hover:scale-100"
              >
                {index}
              </span>
              <h3 className="text-lg font-semibold text-text">
                {t(`web.home.how.step_${index}_title`)}
              </h3>
              <p className="text-sm text-text-muted">{t(`web.home.how.step_${index}_body`)}</p>
            </Reveal>
          </li>
        ))}
      </ol>
    </section>
  );
}
