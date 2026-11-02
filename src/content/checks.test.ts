import { describe, expect, it } from 'vitest'
import { CHECK_COPY, SITE_ISSUE_COPY, UNVERIFIED_COPY } from './checks.ts'
import type { CheckId, UnverifiedReason } from '../../supabase/functions/site-check/core/types.ts'

const CHECK_IDS: CheckId[] = ['https', 'certificate', 'redirect', 'hsts', 'csp', 'framing', 'content-type', 'referrer', 'cookies']
const UNVERIFIED_REASONS: UnverifiedReason[] = ['network', 'rejected', 'error-page', 'fix-https-first', 'timeout']
const JARGON = /\b(CSP|HSTS|TLS|header)\b/i

describe('CHECK_COPY', () => {
  it.each(CHECK_IDS)('%s ha titolo, conseguenza e docUrl su https://', (id) => {
    const copy = CHECK_COPY[id]
    expect(copy.title.length).toBeGreaterThan(0)
    expect(copy.passedTitle.length).toBeGreaterThan(0)
    expect(copy.consequence.length).toBeGreaterThan(0)
    expect(copy.docUrl.startsWith('https://')).toBe(true)
  })

  it.each(CHECK_IDS)('%s non usa gergo tecnico nel titolo o nella conseguenza', (id) => {
    const copy = CHECK_COPY[id]
    expect(copy.title).not.toMatch(JARGON)
    expect(copy.passedTitle).not.toMatch(JARGON)
    expect(copy.consequence).not.toMatch(JARGON)
  })

  it.each(CHECK_IDS)('%s ha tutte e tre le guide (altro, wordpress, wix) con almeno un passaggio', (id) => {
    const { guides } = CHECK_COPY[id]
    for (const platform of ['altro', 'wordpress', 'wix'] as const) {
      expect(guides[platform].steps.length).toBeGreaterThan(0)
    }
  })

  it.each(CHECK_IDS)('%s: le guide WordPress e Wix hanno una fonte verificata, oppure rimandano a chi gestisce il sito', (id) => {
    const { guides } = CHECK_COPY[id]
    for (const platform of ['wordpress', 'wix'] as const) {
      const guide = guides[platform]
      const hasSource = typeof guide.sourceUrl === 'string' && guide.sourceUrl.startsWith('https://')
      const mentionsContact = guide.steps.some((s) => /assistenza|supporto|chi gestisce il sito|contattare/i.test(s))
      expect(hasSource || mentionsContact).toBe(true)
    }
  })
})

describe('UNVERIFIED_COPY', () => {
  it.each(UNVERIFIED_REASONS)('%s ha un testo', (reason) => {
    expect(UNVERIFIED_COPY[reason].length).toBeGreaterThan(0)
  })
})

describe('SITE_ISSUE_COPY', () => {
  it.each(['rejected', 'error-page', 'network'] as const)('%s ha un testo', (issue) => {
    expect(SITE_ISSUE_COPY[issue].length).toBeGreaterThan(0)
  })
})
