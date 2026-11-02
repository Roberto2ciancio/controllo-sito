import type { Check } from './types.ts'

/** Analizza "nome=valore; nome2; nome3=valore3" (sintassi di HSTS), chiavi in minuscolo. */
function parseAttributeList(value: string): Map<string, string | true> {
  const map = new Map<string, string | true>()
  for (const part of value.split(';')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) {
      map.set(trimmed.toLowerCase(), true)
    } else {
      const key = trimmed.slice(0, eq).trim().toLowerCase()
      let val = trimmed.slice(eq + 1).trim()
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1)
      map.set(key, val)
    }
  }
  return map
}

/** Una direttiva CSP è "nome valore1 valore2 ...", separate da ';' (non da '='). */
function cspHasDirective(csp: string, name: string): boolean {
  return csp.split(';').some((part) => part.trim().split(/\s+/)[0]?.toLowerCase() === name)
}

function evaluateHsts(headers: Headers): Check {
  const value = headers.get('strict-transport-security')
  if (!value) return { id: 'hsts', outcome: 'problem', urgency: 'recommended' }
  const directives = parseAttributeList(value)
  const maxAgeRaw = directives.get('max-age')
  const maxAge = typeof maxAgeRaw === 'string' ? Number(maxAgeRaw) : NaN
  const passed = Number.isFinite(maxAge) && maxAge >= 15552000 // 180 giorni
  return { id: 'hsts', outcome: passed ? 'passed' : 'problem', urgency: 'recommended', observed: value }
}

function evaluateCsp(headers: Headers): Check {
  const value = headers.get('content-security-policy')
  return { id: 'csp', outcome: value ? 'passed' : 'problem', urgency: 'recommended', observed: value ?? undefined }
}

function evaluateFraming(headers: Headers): Check {
  const csp = headers.get('content-security-policy')
  const xfo = headers.get('x-frame-options')
  const hasFrameAncestors = csp ? cspHasDirective(csp, 'frame-ancestors') : false
  const passed = hasFrameAncestors || !!xfo
  const parts: string[] = []
  if (hasFrameAncestors) parts.push("frame-ancestors nella CSP")
  if (xfo) parts.push(`X-Frame-Options: ${xfo}`)
  return { id: 'framing', outcome: passed ? 'passed' : 'problem', urgency: 'recommended', observed: parts.join('; ') || undefined }
}

function evaluateContentType(headers: Headers): Check {
  const value = headers.get('x-content-type-options')
  const passed = value?.trim().toLowerCase() === 'nosniff'
  return { id: 'content-type', outcome: passed ? 'passed' : 'problem', urgency: 'recommended', observed: value ?? undefined }
}

function evaluateReferrer(headers: Headers): Check {
  const value = headers.get('referrer-policy')
  if (!value) return { id: 'referrer', outcome: 'problem', urgency: 'recommended' }
  const tokens = value.split(',').map((t) => t.trim().toLowerCase())
  const hasUnsafe = tokens.includes('unsafe-url')
  return { id: 'referrer', outcome: hasUnsafe ? 'problem' : 'passed', urgency: 'recommended', observed: value }
}

function evaluateCookies(setCookies: string[]): Check {
  if (setCookies.length === 0) {
    return { id: 'cookies', outcome: 'passed', urgency: 'recommended', observed: 'nessun cookie impostato da questa pagina' }
  }
  let allGood = true
  const parts: string[] = []
  for (const cookie of setCookies) {
    const attrs = cookie
      .split(';')
      .slice(1)
      .map((a) => a.trim().toLowerCase())
    const hasSecure = attrs.some((a) => a === 'secure')
    const hasSameSite = attrs.some((a) => a.startsWith('samesite='))
    const hasHttpOnly = attrs.some((a) => a === 'httponly')
    const name = cookie.split('=')[0]?.trim() || cookie
    if (!hasSecure || !hasSameSite) allGood = false
    parts.push(`${name}: Secure=${hasSecure}, SameSite=${hasSameSite}, HttpOnly=${hasHttpOnly}`)
  }
  return { id: 'cookies', outcome: allGood ? 'passed' : 'problem', urgency: 'recommended', observed: parts.join('; ') }
}

export function evaluateHeaders(headers: Headers, setCookies: string[]): Check[] {
  return [
    evaluateHsts(headers),
    evaluateCsp(headers),
    evaluateFraming(headers),
    evaluateContentType(headers),
    evaluateReferrer(headers),
    evaluateCookies(setCookies),
  ]
}
