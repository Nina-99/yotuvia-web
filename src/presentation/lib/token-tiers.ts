/**
 * YOTUVIA token bonus ladder (public pricing source).
 *
 * SOURCE OF TRUTH: `yotuvia-api/configs/tiers.json`, loaded by
 * `yotuvia-api/utils/tier_config.go`. `CalculateTier` converts 1:1 and applies
 * the BEST threshold the amount reaches, so loading the minimum of a tier grants
 * that amount in tokens PLUS the tier's bonus:
 *
 *   tokens = amount
 *   bonus  = amount * bestBonusPct   // bestBonusPct of the highest tier with min <= amount
 *
 * WHY THESE VALUES ARE MIRRORED HERE INSTEAD OF FETCHED
 * There is a public, auth-free endpoint — `GET /config/tiers?beauty_center_id=
 * &currency=` (see `yotuvia-api/router/payment_config.router.go`) — but it needs
 * a specific center id and returns THAT CENTER's overrides (a center that never
 * configured tiers gets an empty ladder); it does not serve the global ladder
 * this public page needs. The controller that reads the global `tiers.json`
 * (`TokenController.GetTierConfig`) is defined but not registered on any route,
 * and every token route sits behind `JWTAuthMiddleware`. There is therefore no
 * auth-free endpoint that exposes the GLOBAL ladder, so the ladder is mirrored
 * below and MUST be re-synced when `configs/tiers.json` changes.
 *
 * VERIFIED 2026-10-01 against `yotuvia-api/configs/tiers.json`:
 *   USD: 10 -> +5% | 25 -> +9% | 50 -> +15% | 100 -> +25%
 *   VES: 100 -> +5% | 275 -> +9% | 500 -> +15% | 1000 -> +25%
 */

/** Currencies the public ladder is published in. */
export type TokenCurrency = "USD" | "VES";

export interface TokenTier {
  /** Minimum load amount, in the currency's own units. */
  min: number;
  /** Bonus unlocked at this threshold, as a fraction (`0.05` = +5%). */
  bonusPct: number;
}

/** Render order of the currency blocks. */
export const TOKEN_TIER_CURRENCIES: readonly TokenCurrency[] = ["USD", "VES"];

/** The full ladder, mirroring `yotuvia-api/configs/tiers.json`. */
export const TOKEN_TIERS: Readonly<Record<TokenCurrency, readonly TokenTier[]>> = {
  USD: [
    { min: 10, bonusPct: 0.05 },
    { min: 25, bonusPct: 0.09 },
    { min: 50, bonusPct: 0.15 },
    { min: 100, bonusPct: 0.25 },
  ],
  VES: [
    { min: 100, bonusPct: 0.05 },
    { min: 275, bonusPct: 0.09 },
    { min: 500, bonusPct: 0.15 },
    { min: 1000, bonusPct: 0.25 },
  ],
};

/**
 * Best bonus percentage an amount reaches, or `0` below the first threshold.
 *
 * Mirrors `CalculateTier`: the highest tier the amount meets wins, never a sum.
 */
export function bestBonusPct(currency: TokenCurrency, amount: number): number {
  let best = 0;
  for (const tier of TOKEN_TIERS[currency]) {
    if (amount >= tier.min && tier.bonusPct > best) best = tier.bonusPct;
  }
  return best;
}

export interface TokenGrant {
  /** Tokens credited before the bonus (always 1:1 with the amount). */
  tokens: number;
  /** Bonus tokens credited on top of `tokens`. */
  bonus: number;
}

/** Tokens the API credits for loading `amount` in `currency`. */
export function tokenGrant(currency: TokenCurrency, amount: number): TokenGrant {
  return { tokens: amount, bonus: amount * bestBonusPct(currency, amount) };
}
