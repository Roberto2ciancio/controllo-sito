// Collega la logica pura di ./core a DNS, fetch e certificato TLS veri (Deno Edge Function).
// La logica stessa resta in core/ e non importa nulla di specifico di Deno: è lì che vivono i test.
import { createClient } from 'npm:@supabase/supabase-js@2'
import tls from 'node:tls'
import { handleCheck, hashIp, type ClaimResult, type HandlerDeps } from './core/handler.ts'
import { probeSite, RequestError, type ProbeDeps, type ProbeResponse, type RequestFailure } from './core/probe.ts'

const ALLOWED_ORIGINS = ['https://roberto2ciancio.github.io', 'http://localhost:5173']
const USER_AGENT = 'ControlloSito/1.0 (+https://roberto2ciancio.github.io/controllo-sito/)'
const MAX_RESPONSE_BYTES = 256 * 1024

const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
const salt = Deno.env.get('SITE_CHECK_SALT') ?? ''

async function resolve(host: string): Promise<string[]> {
  const addresses: string[] = []
  for (const recordType of ['A', 'AAAA'] as const) {
    try {
      const records = await Deno.resolveDns(host, recordType)
      addresses.push(...records)
    } catch {
      // nessun record di questo tipo: non è un errore, può semplicemente non averne
    }
  }
  return addresses
}

function classifyFetchError(err: unknown): RequestFailure {
  if (err instanceof Error && err.name === 'AbortError') return 'timeout'
  const message = [err instanceof Error ? err.message : '', err instanceof Error && err.cause instanceof Error ? err.cause.message : String(err instanceof Error ? err.cause : '')]
    .join(' ')
    .toLowerCase()
  if (message.includes('certificate expired')) return 'cert-expired'
  if (message.includes('certificate not valid for name') || message.includes('hostname mismatch')) return 'cert-name'
  if (message.includes('self signed') || message.includes('unknown issuer') || message.includes('unable to get local issuer') || message.includes('untrusted')) return 'cert-issuer'
  if (message.includes('refused')) return 'refused'
  if (message.includes('dns') || message.includes('no address')) return 'not-found'
  if (message.includes('certificate') || message.includes('tls') || message.includes('ssl')) return 'tls-other'
  return 'network'
}

async function request(url: string, timeoutMs: number): Promise<ProbeResponse> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      credentials: 'omit',
      signal: controller.signal,
      headers: { 'user-agent': USER_AGENT },
    })
    // Non si legge più di 256 KB, e il corpo non serve: ci interessano solo stato e intestazioni.
    if (response.body) {
      const reader = response.body.getReader()
      let readBytes = 0
      while (readBytes < MAX_RESPONSE_BYTES) {
        const { done, value } = await reader.read()
        if (done) break
        readBytes += value?.byteLength ?? 0
      }
      await reader.cancel().catch(() => {})
    }
    const setCookies = typeof (response.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === 'function' ? (response.headers as unknown as { getSetCookie: () => string[] }).getSetCookie() : []
    return { status: response.status, headers: response.headers, setCookies }
  } catch (err) {
    throw new RequestError(classifyFetchError(err))
  } finally {
    clearTimeout(timer)
  }
}

// TEMPORANEO (diagnosi Task 9): ultimo codice d'errore di certificate(), mai l'host. Da rimuovere dopo la diagnosi.
let lastCertDebug: string | undefined

function certificate(host: string, timeoutMs: number): Promise<{ notAfter: Date } | null> {
  return new Promise((resolvePromise) => {
    let settled = false
    const finish = (value: { notAfter: Date } | null) => {
      if (settled) return
      settled = true
      resolvePromise(value)
    }
    const timer = setTimeout(() => {
      socket.destroy()
      lastCertDebug = 'timeout'
      finish(null)
    }, timeoutMs)
    const socket = tls.connect({ host, port: 443, servername: host, timeout: timeoutMs }, () => {
      clearTimeout(timer)
      const cert = socket.getPeerCertificate()
      socket.end()
      finish(cert?.valid_to ? { notAfter: new Date(cert.valid_to) } : null)
    })
    socket.on('error', (err) => {
      clearTimeout(timer)
      // Solo il codice d'errore, mai err.message: può contenere l'host controllato.
      const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined
      lastCertDebug = String(code ?? err?.name ?? 'sconosciuto')
      finish(null)
    })
  })
}

const probeDeps: ProbeDeps = { resolve, request, certificate, now: () => new Date() }

function getIp(request: Request): string {
  const cf = request.headers.get('cf-connecting-ip')
  if (cf) return cf
  const forwarded = request.headers.get('x-forwarded-for')
  return forwarded?.split(',')[0]?.trim() ?? 'unknown'
}

async function claim(ipHash: string, domain: string): Promise<ClaimResult> {
  const { data, error } = await db.rpc('controllo_sito_claim', { p_ip_hash: ipHash, p_domain: domain })
  if (error) throw new Error(error.message)
  return data as ClaimResult
}

const handlerDeps: HandlerDeps = {
  getIp,
  salt,
  hashIp,
  claim,
  probe: (domain) => probeSite(probeDeps, domain),
  allowedOrigins: ALLOWED_ORIGINS,
}

Deno.serve(async (request) => {
  lastCertDebug = undefined
  const response = await handleCheck(request, handlerDeps)
  if (!lastCertDebug) return response
  // TEMPORANEO: espone solo un codice d'errore tecnico, mai l'indirizzo controllato. Da rimuovere dopo la diagnosi.
  const headers = new Headers(response.headers)
  headers.set('x-debug-cert', lastCertDebug)
  return new Response(response.body, { status: response.status, headers })
})
