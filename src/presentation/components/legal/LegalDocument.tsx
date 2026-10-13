import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { LEGAL_SECTION_IDS } from "@/presentation/components/legal/legal-sections";
import type { LegalPage } from "@/presentation/components/legal/legal-sections";
import { ROUTES } from "@/presentation/lib/routes";

export interface LegalDocumentProps {
  page: LegalPage;
}

/**
 * Shared shell for the public legal pages.
 *
 * Renders one language's document with a visible DRAFT notice (it must NOT be
 * presented as legally binding), a placeholder effective date, a table of
 * contents with in-page anchors and an `h1 → h2` heading order. Every string is
 * translated, so the copy lives in the locale files and both languages share the
 * exact same section ids (see {@link LEGAL_SECTION_IDS}).
 */
export function LegalDocument({ page }: LegalDocumentProps) {
  const { t } = useTranslation();
  const sectionIds = LEGAL_SECTION_IDS[page];
  const anchorFor = (id: string) => `${page}-${id}`;

  return (
    <article className="mx-auto w-full max-w-3xl px-4 py-10 sm:px-6 sm:py-14">
      <Link
        to={ROUTES.home}
        className="inline-flex items-center rounded text-sm font-semibold text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {t("web.legal.back_home")}
      </Link>

      <h1 className="mt-4 text-3xl font-bold tracking-tight text-text">
        {t(`web.legal.${page}.title`)}
      </h1>
      <p className="mt-2 text-text-muted">{t(`web.legal.${page}.subtitle`)}</p>

      {/*
        Draft notice. It is rendered as a labelled note (not by color alone) and
        is never hidden, so the document can never read as legally binding.
      */}
      <div
        role="note"
        aria-label={t("web.legal.draft_notice_title")}
        className="mt-6 rounded-lg border-2 border-warning bg-warning/10 p-4"
      >
        <p className="text-sm font-bold uppercase tracking-wide text-warning">
          {t("web.legal.draft_notice_title")}
        </p>
        <p className="mt-1 text-sm text-text">{t("web.legal.draft_notice_body")}</p>
      </div>

      <dl className="mt-6 flex flex-col gap-1 text-sm text-text-muted sm:flex-row sm:gap-6">
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-text">{t("web.legal.effective_date_label")}</dt>
          <dd>{t("web.legal.effective_date_value")}</dd>
        </div>
        <div className="flex flex-wrap gap-2">
          <dt className="font-medium text-text">{t("web.legal.last_updated_label")}</dt>
          <dd>{t("web.legal.last_updated_value")}</dd>
        </div>
      </dl>

      <nav
        aria-label={t("web.legal.toc_label")}
        className="mt-8 rounded-lg border border-border bg-card p-4"
      >
        <p className="text-sm font-semibold text-text">{t("web.legal.toc_label")}</p>
        <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 text-sm">
          {sectionIds.map((id) => (
            <li key={id}>
              <a
                href={`#${anchorFor(id)}`}
                className="rounded text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                {t(`web.legal.${page}.sections.${id}.title`)}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {sectionIds.map((id) => (
        <section
          key={id}
          id={anchorFor(id)}
          aria-labelledby={`${anchorFor(id)}-title`}
          className="mt-8 scroll-mt-20"
        >
          <h2 id={`${anchorFor(id)}-title`} className="text-lg font-semibold text-text">
            {t(`web.legal.${page}.sections.${id}.title`)}
          </h2>
          <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-text-muted">
            {t(`web.legal.${page}.sections.${id}.body`)}
          </p>
        </section>
      ))}
    </article>
  );
}
