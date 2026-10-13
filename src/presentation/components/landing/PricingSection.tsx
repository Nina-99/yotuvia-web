import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";

import { Card, buttonClasses } from "@/presentation/components/ui";
import { formatNumber } from "@/presentation/lib/format";
import { ROUTES } from "@/presentation/lib/routes";
import { TOKEN_TIER_CURRENCIES, TOKEN_TIERS, tokenGrant } from "@/presentation/lib/token-tiers";

import { Reveal } from "./Reveal";
import { IconArrowRight } from "./icons";

/**
 * Public pricing section.
 *
 * The product is prepaid with YOTUVIA tokens, so this section shows the REAL
 * bonus ladder instead of invented plans. The numbers live in
 * `presentation/lib/token-tiers.ts` (mirrored from
 * `yotuvia-api/configs/tiers.json`), and every label/heading is translated, so
 * neither the amounts nor the copy are hardcoded in JSX.
 *
 * There is NO payment gateway: the visitor loads tokens by transfer and the
 * center confirms the receipt, which is why the section talks about tokens and
 * explicitly states there is no card checkout or subscription.
 *
 * The ladder amounts are intentionally NOT count-up animated: they are exact
 * financial figures and the test suite asserts their exact rendered text.
 */
export function PricingSection() {
  const { t, i18n } = useTranslation();
  const language = i18n.resolvedLanguage ?? i18n.language;

  return (
    <section
      id="pricing"
      aria-labelledby="pricing-title"
      className="border-y border-border bg-card"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6">
        <Reveal>
          <h2 id="pricing-title" className="text-2xl font-bold tracking-tight text-text sm:text-3xl">
            {t("web.home.pricing.title")}
          </h2>
          <p className="mt-2 max-w-2xl text-text-muted">{t("web.home.pricing.subtitle")}</p>
        </Reveal>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {TOKEN_TIER_CURRENCIES.map((currency, index) => (
            <Reveal key={currency} delay={index * 90} className="h-full">
              <Card className="ytv-card-interactive flex h-full flex-col p-6">
                <h3 className="text-lg font-semibold text-text">
                  {t(`web.home.pricing.currencies.${currency.toLowerCase()}`)}
                </h3>
                <p className="mt-1 text-sm text-text-muted">
                  {t("web.home.pricing.currency_hint")}
                </p>

                <table className="mt-4 w-full border-collapse text-sm">
                  <caption className="sr-only">
                    {t("web.home.pricing.ladder_caption", { currency })}
                  </caption>
                  <thead>
                    <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-text-muted">
                      <th scope="col" className="py-2 pr-3 font-semibold">
                        {t("web.home.pricing.amount_column")}
                      </th>
                      <th scope="col" className="py-2 pr-3 font-semibold">
                        {t("web.home.pricing.bonus_column")}
                      </th>
                      <th scope="col" className="py-2 font-semibold">
                        {t("web.home.pricing.total_column")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {TOKEN_TIERS[currency].map((tier) => {
                      const grant = tokenGrant(currency, tier.min);
                      return (
                        <tr key={tier.min} className="border-b border-border/60 last:border-0">
                          <th scope="row" className="py-2 pr-3 text-left font-medium text-text">
                            {t("web.home.pricing.amount_value", {
                              amount: formatNumber(tier.min, language),
                              currency,
                            })}
                          </th>
                          <td className="py-2 pr-3 font-semibold text-success">
                            {t("web.home.pricing.bonus_value", {
                              percent: formatNumber(tier.bonusPct * 100, language),
                            })}
                          </td>
                          <td className="py-2 text-text">
                            {t("web.home.pricing.total_value", {
                              tokens: formatNumber(grant.tokens + grant.bonus, language),
                            })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
            </Reveal>
          ))}
        </div>

        <p className="mt-6 max-w-3xl text-sm text-text-muted">{t("web.home.pricing.note")}</p>
        <p className="mt-2 max-w-3xl text-xs text-text-muted">
          {t("web.home.pricing.source_note")}
        </p>

        <p className="mt-6">
          <Link
            to={ROUTES.register}
            className={buttonClasses({ size: "lg", className: "ytv-cta group" })}
          >
            {t("web.home.pricing.cta")}
            <IconArrowRight className="ytv-cta-arrow h-4 w-4" />
          </Link>
        </p>
      </div>
    </section>
  );
}
