import { describe, expect, it } from 'vitest'
import { gradeChecks } from './grade.ts'
import type { Check } from './types.ts'

function makeChecks(spec: {
  critical?: number
  important?: number
  recommended?: number
  unverified?: number
  httpsUnverified?: boolean
}): Check[] {
  const checks: Check[] = []
  for (let i = 0; i < (spec.critical ?? 0); i++) checks.push({ id: 'certificate', outcome: 'problem', urgency: 'critical' })
  for (let i = 0; i < (spec.important ?? 0); i++) checks.push({ id: 'hsts', outcome: 'problem', urgency: 'important' })
  for (let i = 0; i < (spec.recommended ?? 0); i++) checks.push({ id: 'cookies', outcome: 'problem', urgency: 'recommended' })
  let n = checks.length
  const unverifiedTarget = spec.unverified ?? 0
  for (let i = 0; i < unverifiedTarget; i++) {
    const isHttps = spec.httpsUnverified && i === 0
    checks.push({ id: isHttps ? 'https' : 'csp', outcome: 'unverified', reason: 'network' })
    n++
  }
  // riempi fino a 10 controlli con esiti superati, che non devono influenzare il voto
  while (n < 10) {
    checks.push({ id: 'referrer', outcome: 'passed', urgency: 'recommended' })
    n++
  }
  return checks
}

describe('gradeChecks', () => {
  it('un problema critico dà sempre F, anche con 7 non verificati', () => {
    expect(gradeChecks(makeChecks({ critical: 1, unverified: 7 }))).toBe('F')
  })

  it('due problemi importanti danno D', () => {
    expect(gradeChecks(makeChecks({ important: 2 }))).toBe('D')
  })

  it('un problema importante dà C', () => {
    expect(gradeChecks(makeChecks({ important: 1 }))).toBe('C')
  })

  it('tre problemi consigliati danno B', () => {
    expect(gradeChecks(makeChecks({ recommended: 3 }))).toBe('B')
  })

  it('due problemi consigliati danno A', () => {
    expect(gradeChecks(makeChecks({ recommended: 2 }))).toBe('A')
  })

  it('nessun problema dà A', () => {
    expect(gradeChecks(makeChecks({}))).toBe('A')
  })

  it('https non verificato senza critici non dà un voto', () => {
    expect(gradeChecks(makeChecks({ unverified: 1, httpsUnverified: true }))).toBeNull()
  })

  it('6 controlli non verificati su 10 non danno un voto', () => {
    expect(gradeChecks(makeChecks({ unverified: 6 }))).toBeNull()
  })

  it('5 controlli non verificati su 10 danno comunque un voto', () => {
    expect(gradeChecks(makeChecks({ unverified: 5 }))).not.toBeNull()
  })

  it('i controlli non verificati non contano come problemi', () => {
    // 1 importante + 4 non verificati: il voto deve essere C (solo l'importante conta), non peggiore
    expect(gradeChecks(makeChecks({ important: 1, unverified: 4 }))).toBe('C')
  })
})
