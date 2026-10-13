/**
 * Locale parity guard: es.json and en.json MUST expose the identical key set.
 *
 * A missing key silently renders the raw key string on the other language,
 * so both locales are asserted to stay in lockstep.
 */
import { describe, expect, it } from 'vitest'

import en from '../locales/en.json'
import es from '../locales/es.json'

/** Recursively flatten a nested locale tree into `a.b.c` -> value paths. */
function flatten(
  value: unknown,
  prefix = '',
  out: Record<string, string> = {},
): Record<string, string> {
  if (value !== null && typeof value === 'object') {
    for (const key of Object.keys(value as Record<string, unknown>)) {
      const child = (value as Record<string, unknown>)[key]
      const path = prefix ? `${prefix}.${key}` : key
      flatten(child, path, out)
    }
  } else {
    out[prefix] = String(value)
  }
  return out
}

function placeholders(value: string): string[] {
  return (value.match(/\{[a-zA-Z_][\w]*\}/g) ?? []).map((p) => p.slice(1, -1)).sort()
}

describe('i18n locale parity (es/en)', () => {
  const esFlat = flatten(es)
  const enFlat = flatten(en)

  it('exposes the same key set in both locales', () => {
    const missingInEn = Object.keys(esFlat)
      .filter((key) => !(key in enFlat))
      .sort()
    const missingInEs = Object.keys(enFlat)
      .filter((key) => !(key in esFlat))
      .sort()

    expect({ missingInEn, missingInEs }).toEqual({ missingInEn: [], missingInEs: [] })
  })

  it('uses identical interpolation placeholders in both locales', () => {
    const mismatches = Object.keys(esFlat)
      .filter((key) => key in enFlat)
      .filter(
        (key) => placeholders(esFlat[key]).join(',') !== placeholders(enFlat[key]).join(','),
      )
      .map((key) => `${key}: es="${esFlat[key]}" en="${enFlat[key]}"`)

    expect(mismatches).toEqual([])
  })
})
