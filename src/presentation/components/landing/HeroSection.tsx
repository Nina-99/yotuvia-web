import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Badge, Card, buttonClasses } from "@/presentation/components/ui";
import { useScrollParallax } from "@/presentation/hooks/use-scroll-effects";
import { ROUTES } from "@/presentation/lib/routes";

import { AnimatedNumber } from "./AnimatedNumber";
import { IconArrowRight, IconCheck } from "./icons";

/** Decorative product preview built from tokens only — no external images. */
function HeroPreview() {
  const { t } = useTranslation();
  const slots = [
    t("web.home.hero.visual.slot_1"),
    t("web.home.hero.visual.slot_2"),
    t("web.home.hero.visual.slot_3"),
  ];
  const trustSignals = [
    t("web.home.hero.trust_1"),
    t("web.home.hero.trust_2"),
    t("web.home.hero.trust_3"),
  ];

  return (
    <div
      className="ytv-hero-enter relative mx-auto w-full max-w-md"
      style={{ animationDelay: "220ms" }}
    >
      <div
        aria-hidden="true"
        className="absolute -inset-6 rounded-[2rem] bg-accent/20 blur-3xl"
      />
      <Card className="ytv-card-interactive group relative overflow-hidden p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              {t("web.home.hero.visual.subtitle")}
            </p>
            <p className="text-lg font-semibold text-text">{t("web.home.hero.visual.title")}</p>
          </div>
          <span className="ytv-icon-pop flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-sm font-bold text-on-accent">
            Y
          </span>
        </div>

        <div className="mt-5 rounded-lg border border-border bg-card2 p-4">
          <p className="text-xs font-medium text-text-muted">
            {t("web.home.hero.visual.metric_label")}
          </p>
          <p className="text-3xl font-bold text-text">
            <AnimatedNumber value={t("web.home.hero.visual.metric_value")} />
          </p>
          <p className="text-xs font-medium text-success">
            {t("web.home.hero.visual.metric_hint")}
          </p>
        </div>

        <ul className="mt-4 flex flex-col gap-2">
          {slots.map((slot) => (
            <li
              key={slot}
              className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 text-sm text-text transition-colors hover:border-accent/40"
            >
              <span className="h-8 w-1 rounded-full bg-accent" aria-hidden="true" />
              {slot}
            </li>
          ))}
        </ul>
      </Card>

      <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        {trustSignals.map((signal) => (
          <li key={signal} className="flex items-center gap-1.5 text-xs font-medium text-text-muted">
            <IconCheck className="h-3.5 w-3.5 text-success" />
            {signal}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function HeroSection() {
  const { t } = useTranslation();
  // Subtle transform-only drift tied to scroll position; disabled under reduced
  // motion and handed to CSS when scroll-driven animation is supported.
  const parallaxRef = useScrollParallax<HTMLDivElement>();

  return (
    <section aria-labelledby="hero-title" className="relative overflow-hidden border-b border-border">
      {/* Slow gold wash: transform-only drift, stood down under reduced motion. */}
      <div aria-hidden="true" className="ytv-hero-ambient" />

      <div
        ref={parallaxRef}
        className="ytv-hero-parallax relative z-10 mx-auto grid w-full max-w-6xl items-center gap-12 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:py-24"
      >
        <div className="flex flex-col items-start gap-6">
          <Badge variant="accent" className="ytv-hero-enter">
            {t("web.home.hero.eyebrow")}
          </Badge>
          <h1
            id="hero-title"
            className="ytv-hero-enter max-w-xl text-4xl font-bold tracking-tight text-text sm:text-5xl"
            style={{ animationDelay: "80ms" }}
          >
            {t("web.home.hero.title")}
          </h1>
          <p
            className="ytv-hero-enter max-w-xl text-lg text-text-muted"
            style={{ animationDelay: "160ms" }}
          >
            {t("web.home.hero.subtitle")}
          </p>
          <div className="ytv-hero-enter flex flex-wrap gap-3" style={{ animationDelay: "240ms" }}>
            <Link
              to={ROUTES.centers.search}
              className={buttonClasses({ size: "lg", className: "ytv-cta group" })}
            >
              {t("web.home.hero.cta_search")}
              <IconArrowRight className="ytv-cta-arrow h-4 w-4" />
            </Link>
            <Link
              to={ROUTES.login}
              className={buttonClasses({ variant: "outline", size: "lg", className: "ytv-cta" })}
            >
              {t("web.home.hero.cta_signin")}
            </Link>
          </div>
        </div>

        <HeroPreview />
      </div>
    </section>
  );
}
