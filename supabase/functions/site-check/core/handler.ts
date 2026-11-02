import { normalizeAddress } from './address.ts'
import type { Report } from './types.ts'

export type ClaimResult = 'ok' | 'limit-ip' | 'limit-domain' | 'limit-global'

export interface HandlerDeps {
  getIp(request: Request): string
  salt: string
  hashIp(ip: string, salt: string): Promise<string>
  claim(ipHash: string, domain: string): Promise<ClaimResult>
  probe(domain: string): Promise<Report>
  allowedOrigins: string[]
}

export async function hashIp(ip: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${ip}`)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function corsHeaders(request: Request, allowedOrigins: string[]): HeadersInit {
  const origin = request.headers.get('origin')
  const allowed = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
  }
}

function respond(request: Request, deps: Pick<HandlerDeps, 'allowedOrigins'>, body: Partial<Report>, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(request, deps.allowedOrigins) })
}

export async function handleCheck(request: Request, deps: HandlerDeps): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(request, deps.allowedOrigins) })
  }
  if (request.method !== 'POST') {
    return respond(request, deps, { status: 'error' }, 405)
  }

  try {
    const body = await request.json().catch(() => null)
    const address = typeof body?.address === 'string' ? body.address : ''
    const normalized = normalizeAddress(address)
    if ('error' in normalized) {
      return respond(request, deps, { status: 'invalid-address' })
    }

    let claimResult: ClaimResult
    try {
      const ip = deps.getIp(request)
      const ipHash = await deps.hashIp(ip, deps.salt)
      claimResult = await deps.claim(ipHash, normalized.domain)
    } catch {
      // Se il controllo dei limiti fallisce, si rifiuta il controllo: niente richieste senza limiti attivi.
      return respond(request, deps, { status: 'error' })
    }

    if (claimResult !== 'ok') {
      return respond(request, deps, { status: 'rate-limited' })
    }

    const report = await deps.probe(normalized.domain)
    return respond(request, deps, report)
  } catch {
    // Mai l'indirizzo controllato nei registri applicativi, nemmeno negli errori imprevisti.
    console.error('controllo-sito: errore imprevisto nella richiesta')
    return respond(request, deps, { status: 'error' })
  }
}
