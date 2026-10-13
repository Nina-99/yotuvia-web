import { useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";

import { useReveal } from "@/presentation/hooks/use-reveal";
import { cn } from "@/presentation/lib/cn";

import { Reveal } from "./Reveal";
import { IconChevronDown } from "./icons";

interface FaqEntry {
  /** i18n key suffix: resolves to `q{n}` and `a{n}`. */
  index: number;
}

const FAQ_ENTRIES: readonly FaqEntry[] = [
  { index: 1 },
  { index: 2 },
  { index: 3 },
  { index: 4 },
  { index: 5 },
];

interface FaqItemProps {
  index: number;
}

function FaqItem({ index }: FaqItemProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { ref, className: revealClassName } = useReveal<HTMLLIElement>();

  const buttonId = `faq-${index}-button`;
  const panelId = `faq-${index}-panel`;

  return (
    <li
      ref={ref}
      className={cn("border-b border-border transition-colors hover:border-accent/40", revealClassName)}
      style={{ "--ytv-reveal-delay": `${index * 50}ms` } as CSSProperties}
    >
      <h3>
        <button
          id={buttonId}
          type="button"
          aria-expanded={open}
          aria-controls={panelId}
          onClick={() => setOpen((current) => !current)}
          className="flex w-full items-center justify-between gap-4 py-4 text-left text-base font-semibold text-text transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {t(`web.home.faq.q${index}`)}
          <IconChevronDown
            className={cn(
              "h-5 w-5 shrink-0 transition-transform duration-200 motion-reduce:transition-none",
              open ? "rotate-180" : undefined,
            )}
          />
        </button>
      </h3>
      <div
        id={panelId}
        role="region"
        aria-labelledby={buttonId}
        hidden={!open}
        className={cn("pb-4 text-sm text-text-muted", open && "ytv-faq-panel--open")}
      >
        {t(`web.home.faq.a${index}`)}
      </div>
    </li>
  );
}

export function FaqSection() {
  const { t } = useTranslation();

  return (
    <section id="faq" aria-labelledby="faq-title" className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
      <Reveal>
        <h2 id="faq-title" className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
          {t("web.home.faq.title")}
        </h2>
        <p className="mt-2 text-text-muted">{t("web.home.faq.subtitle")}</p>
      </Reveal>

      <ul className="mt-6">
        {FAQ_ENTRIES.map(({ index }) => (
          <FaqItem key={index} index={index} />
        ))}
      </ul>
    </section>
  );
}
