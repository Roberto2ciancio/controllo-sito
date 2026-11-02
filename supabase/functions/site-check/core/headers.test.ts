import { describe, expect, it } from 'vitest'
import { evaluateHeaders } from './headers.ts'

function find(headers: Headers, setCookies: string[], id: string) {
  return evaluateHeaders(headers, setCookies).find((c) => c.id === id)
}

describe('evaluateHeaders: hsts', () => {
  it('max-age=15552000 passa (180 giorni esatti)', () => {
    const h = new Headers({ 'Strict-Transport-Security': 'max-age=15552000' })
    expect(find(h, [], 'hsts')?.outcome).toBe('passed')
  })
  it('max-age=15551999 è un problema (un secondo sotto 180 giorni)', () => {
    const h = new Headers({ 'Strict-Transport-Security': 'max-age=15551999' })
    expect(find(h, [], 'hsts')?.outcome).toBe('problem')
  })
  it('MAX-AGE maiuscolo con includeSubDomains passa', () => {
    const h = new Headers({ 'Strict-Transport-Security': 'MAX-AGE=31536000; includeSubDomains' })
    expect(find(h, [], 'hsts')?.outcome).toBe('passed')
  })
  it('max-age tra virgolette passa', () => {
    const h = new Headers({ 'Strict-Transport-Security': 'max-age="31536000"' })
    expect(find(h, [], 'hsts')?.outcome).toBe('passed')
  })
  it('max-age non numerico è un problema', () => {
    const h = new Headers({ 'Strict-Transport-Security': 'max-age=abc' })
    expect(find(h, [], 'hsts')?.outcome).toBe('problem')
  })
  it('assente è un problema', () => {
    expect(find(new Headers(), [], 'hsts')?.outcome).toBe('problem')
  })
})

describe('evaluateHeaders: csp', () => {
  it('presente passa', () => {
    const h = new Headers({ 'Content-Security-Policy': "default-src 'self'" })
    expect(find(h, [], 'csp')?.outcome).toBe('passed')
  })
  it('solo Report-Only è un problema', () => {
    const h = new Headers({ 'Content-Security-Policy-Report-Only': "default-src 'self'" })
    expect(find(h, [], 'csp')?.outcome).toBe('problem')
  })
})

describe('evaluateHeaders: framing', () => {
  it("frame-ancestors 'self' nella CSP passa", () => {
    const h = new Headers({ 'Content-Security-Policy': "default-src 'self'; frame-ancestors 'self'" })
    expect(find(h, [], 'framing')?.outcome).toBe('passed')
  })
  it('X-Frame-Options: DENY passa', () => {
    const h = new Headers({ 'X-Frame-Options': 'DENY' })
    expect(find(h, [], 'framing')?.outcome).toBe('passed')
  })
  it('entrambi assenti è un problema', () => {
    expect(find(new Headers(), [], 'framing')?.outcome).toBe('problem')
  })
})

describe('evaluateHeaders: content-type', () => {
  it('nosniff passa', () => {
    const h = new Headers({ 'X-Content-Type-Options': 'nosniff' })
    expect(find(h, [], 'content-type')?.outcome).toBe('passed')
  })
  it('NoSniff (maiuscole miste) passa', () => {
    const h = new Headers({ 'X-Content-Type-Options': 'NoSniff' })
    expect(find(h, [], 'content-type')?.outcome).toBe('passed')
  })
  it('altro valore è un problema', () => {
    const h = new Headers({ 'X-Content-Type-Options': 'qualcosaltro' })
    expect(find(h, [], 'content-type')?.outcome).toBe('problem')
  })
})

describe('evaluateHeaders: referrer', () => {
  it('strict-origin passa', () => {
    const h = new Headers({ 'Referrer-Policy': 'strict-origin' })
    expect(find(h, [], 'referrer')?.outcome).toBe('passed')
  })
  it('unsafe-url è un problema', () => {
    const h = new Headers({ 'Referrer-Policy': 'unsafe-url' })
    expect(find(h, [], 'referrer')?.outcome).toBe('problem')
  })
  it('no-referrer, unsafe-url è un problema (contiene unsafe-url)', () => {
    const h = new Headers({ 'Referrer-Policy': 'no-referrer, unsafe-url' })
    expect(find(h, [], 'referrer')?.outcome).toBe('problem')
  })
  it('assente è un problema', () => {
    expect(find(new Headers(), [], 'referrer')?.outcome).toBe('problem')
  })
})

describe('evaluateHeaders: cookies', () => {
  it('nessun cookie passa con la nota', () => {
    const check = find(new Headers(), [], 'cookies')
    expect(check?.outcome).toBe('passed')
    expect(check?.observed).toContain('nessun cookie impostato da questa pagina')
  })
  it('a=1; Secure; SameSite=Lax passa', () => {
    expect(find(new Headers(), ['a=1; Secure; SameSite=Lax'], 'cookies')?.outcome).toBe('passed')
  })
  it('a=1; Secure (senza SameSite) è un problema', () => {
    expect(find(new Headers(), ['a=1; Secure'], 'cookies')?.outcome).toBe('problem')
  })
  it('a=1; SameSite=Lax (senza Secure) è un problema', () => {
    expect(find(new Headers(), ['a=1; SameSite=Lax'], 'cookies')?.outcome).toBe('problem')
  })
  it('un cookie buono e uno cattivo è un problema', () => {
    expect(find(new Headers(), ['a=1; Secure; SameSite=Lax', 'b=2; Secure'], 'cookies')?.outcome).toBe('problem')
  })
  it('a=1; secure; samesite=none (minuscolo) passa', () => {
    expect(find(new Headers(), ['a=1; secure; samesite=none'], 'cookies')?.outcome).toBe('passed')
  })
  it('HttpOnly assente non cambia l\'esito ma compare nei dettagli osservati', () => {
    const check = find(new Headers(), ['a=1; Secure; SameSite=Lax'], 'cookies')
    expect(check?.outcome).toBe('passed')
    expect(check?.observed).toContain('HttpOnly')
  })
})

describe('evaluateHeaders: urgenza', () => {
  it('tutti i controlli hanno urgenza recommended', () => {
    const checks = evaluateHeaders(new Headers(), [])
    for (const check of checks) {
      expect(check.urgency).toBe('recommended')
    }
  })
})
