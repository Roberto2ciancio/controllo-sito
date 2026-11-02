import { isForbiddenIp } from './address.ts'
import { gradeChecks } from './grade.ts'
import { evaluateHeaders } from './headers.ts'
import type { Check, CheckId, Report, UnverifiedReason } from './types.ts'

export type RequestFailure = 'refused' | 'timeout' | 'cert-expired' | 'cert-name' | 'cert-issuer' | 'tls-other' | 'network' | 'not-found'

export interface ProbeResponse {
  status: number
  headers: Headers
  setCookies: string[]
}

export class RequestError extends Error {
  constructor(public failure: RequestFailure) {
    super(failure)
  }
}

export interface ProbeDeps {
  resolve(host: string): Promise<string[]>
  /** Non segue i reindirizzamenti: restituisce la risposta grezza, oppure lancia RequestError. */
  request(url: string, timeoutMs: number): Promise<ProbeResponse>
  certificate(host: string, timeoutMs: number): Promise<{ notAfter: Date } | null>
  now(): Date
}

const TOTAL_BUDGET_MS = 20000
const ATTEMPT_BUDGET_MS = 8000
const MAX_REDIRECTS = 5
const EXPIRY_PASS_DAYS = 30
const EXPIRY_CRITICAL_DAYS = 7
const REJECTED_STATUSES = new Set([401, 403, 429, 503])
const CERT_FAILURES = new Set<RequestFailure>(['cert-expired', 'cert-name', 'cert-issuer'])

const HEADER_CHECK_IDS: readonly CheckId[] = ['hsts', 'csp', 'framing', 'content-type', 'referrer', 'cookies']

function timeLeftMs(deps: ProbeDeps, deadline: number): number {
  return deadline - deps.now().getTime()
}

function attemptTimeout(deps: ProbeDeps, deadline: number): number {
  return Math.min(ATTEMPT_BUDGET_MS, Math.max(timeLeftMs(deps, deadline), 0))
}

async function resolveOrBlock(deps: ProbeDeps, host: string): Promise<boolean> {
  const addresses = await deps.resolve(host)
  if (addresses.length === 0) return false
  if (addresses.some((a) => isForbiddenIp(a))) return false
  return true
}

function sameSite(hostA: string, hostB: string): boolean {
  const strip = (h: string) => (h.toLowerCase().startsWith('www.') ? h.toLowerCase().slice(4) : h.toLowerCase())
  return strip(hostA) === strip(hostB)
}

/** Risolve una Location (anche relativa) rispetto all'URL corrente; nessuna richiesta se non valida o su una porta non ammessa. */
function resolveRedirectTarget(location: string, currentUrl: string): URL | null {
  let next: URL
  try {
    next = new URL(location, currentUrl)
  } catch {
    return null
  }
  if (next.protocol !== 'http:' && next.protocol !== 'https:') return null
  const port = next.port || (next.protocol === 'https:' ? '443' : '80')
  if (port !== '80' && port !== '443') return null
  return next
}

/** Un gruppo di controlli "non verificato" con lo stesso motivo: usato quando https non si stabilisce affatto. */
function unverifiedGroup(reason: UnverifiedReason): Check[] {
  const checks: Check[] = [
    { id: 'https', outcome: 'unverified', reason },
    { id: 'certificate', outcome: 'unverified', reason },
    { id: 'expiry', outcome: 'unverified', reason },
  ]
  for (const id of HEADER_CHECK_IDS) {
    checks.push({ id, outcome: 'unverified', urgency: id === 'cookies' ? undefined : 'recommended', reason })
  }
  return checks
}

function expiryCheck(notAfter: Date, now: Date): Check {
  const diffDays = (notAfter.getTime() - now.getTime()) / 86_400_000
  if (diffDays > EXPIRY_PASS_DAYS) return { id: 'expiry', outcome: 'passed', observed: notAfter.toISOString() }
  const urgency = diffDays <= EXPIRY_CRITICAL_DAYS ? 'critical' : 'important'
  return { id: 'expiry', outcome: 'problem', urgency, observed: notAfter.toISOString() }
}

type ChainOutcome =
  | { kind: 'response'; response: ProbeResponse; finalHost: string }
  | { kind: 'failure'; failure: RequestFailure; finalHost: string }
  | { kind: 'unverified'; reason: UnverifiedReason } // ciclo, troppi salti, Location non valida, indirizzo vietato, rete
  | { kind: 'timeout' }

/** Segue manualmente i reindirizzamenti di una richiesta, entro il budget di tempo e i limiti di sicurezza. */
async function followChain(deps: ProbeDeps, deadline: number, startUrl: string, startHost: string, startHostAlreadyResolved: boolean): Promise<ChainOutcome> {
  let currentUrl = startUrl
  let currentHost = startHost
  let hostResolved = startHostAlreadyResolved
  const visited = new Set<string>()
  let hops = 0

  while (true) {
    if (timeLeftMs(deps, deadline) <= 0) return { kind: 'timeout' }

    if (!hostResolved) {
      const ok = await resolveOrBlock(deps, currentHost)
      if (!ok) return { kind: 'unverified', reason: 'network' }
    }
    hostResolved = false

    if (visited.has(currentUrl)) return { kind: 'unverified', reason: 'network' } // ciclo
    visited.add(currentUrl)

    const timeout = attemptTimeout(deps, deadline)
    if (timeout <= 0) return { kind: 'timeout' }

    let response: ProbeResponse
    try {
      response = await deps.request(currentUrl, timeout)
    } catch (err) {
      if (err instanceof RequestError) return { kind: 'failure', failure: err.failure, finalHost: currentHost }
      return { kind: 'unverified', reason: 'network' }
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location')
      const next = location ? resolveRedirectTarget(location, currentUrl) : null
      if (!next) return { kind: 'unverified', reason: 'network' }

      hops++
      if (hops > MAX_REDIRECTS) return { kind: 'unverified', reason: 'network' }

      currentHost = next.hostname
      currentUrl = next.toString()
      continue
    }

    return { kind: 'response', response, finalHost: currentHost }
  }
}

function isUpgradeToHttps(response: ProbeResponse, requestUrl: string, domain: string): boolean {
  if (response.status < 300 || response.status >= 400) return false
  const location = response.headers.get('location')
  const next = location ? resolveRedirectTarget(location, requestUrl) : null
  return !!next && next.protocol === 'https:' && sameSite(next.hostname, domain)
}

function redirectCheckFromResponse(response: ProbeResponse, requestUrl: string, domain: string): Check {
  const location = response.headers.get('location')
  return isUpgradeToHttps(response, requestUrl, domain)
    ? { id: 'redirect', outcome: 'passed', urgency: 'important', observed: location ?? undefined }
    : { id: 'redirect', outcome: 'problem', urgency: 'important', observed: `resta su http://, stato ${response.status}` }
}

/** Il controllo "redirect": http://dominio/ sale a https:// dello stesso sito? Richiesta indipendente, non segue oltre un salto. */
async function evaluateRedirectCheck(deps: ProbeDeps, domain: string, deadline: number): Promise<Check> {
  const timeout = attemptTimeout(deps, deadline)
  if (timeout <= 0) return { id: 'redirect', outcome: 'unverified', reason: 'timeout' }

  const requestUrl = `http://${domain}/`
  try {
    const response = await deps.request(requestUrl, timeout)
    return redirectCheckFromResponse(response, requestUrl, domain)
  } catch (err) {
    const failure = err instanceof RequestError ? err.failure : 'network'
    return { id: 'redirect', outcome: 'unverified', reason: failure === 'timeout' ? 'timeout' : 'network' }
  }
}

export async function probeSite(deps: ProbeDeps, domain: string): Promise<Report> {
  const deadline = deps.now().getTime() + TOTAL_BUDGET_MS
  const checkedAt = deps.now().toISOString()

  const initialOk = await resolveOrBlock(deps, domain)
  if (!initialOk) return { status: 'not-found', checkedAt }

  const httpsOutcome = await followChain(deps, deadline, `https://${domain}/`, domain, true)

  let finalHost = domain
  let httpStatus: number | undefined
  let siteIssue: Report['siteIssue']
  const checks: Check[] = []
  let reuseForRedirect: { response: ProbeResponse; requestUrl: string } | undefined

  if (httpsOutcome.kind === 'response') {
    finalHost = httpsOutcome.finalHost
    const { response } = httpsOutcome
    httpStatus = response.status
    const rejected = REJECTED_STATUSES.has(response.status) || (response.headers.get('cf-mitigated')?.toLowerCase().includes('challenge') ?? false)
    const errorPage = !rejected && response.status >= 400 && response.status < 600

    checks.push({ id: 'https', outcome: 'passed' })

    const certTimeout = attemptTimeout(deps, deadline)
    const cert = certTimeout > 0 ? await deps.certificate(finalHost, certTimeout) : null
    checks.push({ id: 'certificate', outcome: 'passed' })
    checks.push(cert ? expiryCheck(cert.notAfter, deps.now()) : { id: 'expiry', outcome: 'unverified', reason: 'unavailable' })

    if (rejected || errorPage) {
      siteIssue = rejected ? 'rejected' : 'error-page'
      const reason: UnverifiedReason = rejected ? 'rejected' : 'error-page'
      for (const id of HEADER_CHECK_IDS) {
        checks.push({ id, outcome: 'unverified', urgency: id === 'cookies' ? undefined : 'recommended', reason })
      }
    } else {
      checks.push(...evaluateHeaders(response.headers, response.setCookies))
    }
  } else if (httpsOutcome.kind === 'failure' && CERT_FAILURES.has(httpsOutcome.failure)) {
    finalHost = httpsOutcome.finalHost
    checks.push({ id: 'https', outcome: 'passed' })
    checks.push({ id: 'certificate', outcome: 'problem', urgency: 'critical', observed: httpsOutcome.failure })
    checks.push({ id: 'expiry', outcome: 'unverified', reason: 'fix-https-first' })
    for (const id of HEADER_CHECK_IDS) {
      checks.push({ id, outcome: 'unverified', urgency: id === 'cookies' ? undefined : 'recommended', reason: 'fix-https-first' })
    }
  } else if (httpsOutcome.kind === 'failure' && httpsOutcome.failure === 'refused') {
    finalHost = httpsOutcome.finalHost
    const fallbackTimeout = attemptTimeout(deps, deadline)
    const requestUrl = `http://${domain}/`
    let fallback: ProbeResponse | null = null
    if (fallbackTimeout > 0) {
      try {
        fallback = await deps.request(requestUrl, fallbackTimeout)
      } catch {
        fallback = null
      }
    }

    if (fallback && fallback.status >= 200 && fallback.status < 400) {
      checks.push({ id: 'https', outcome: 'problem', urgency: 'critical' })
      checks.push({ id: 'certificate', outcome: 'unverified', reason: 'fix-https-first' })
      checks.push({ id: 'expiry', outcome: 'unverified', reason: 'fix-https-first' })
      for (const id of HEADER_CHECK_IDS) {
        checks.push({ id, outcome: 'unverified', urgency: id === 'cookies' ? undefined : 'recommended', reason: 'fix-https-first' })
      }
      reuseForRedirect = { response: fallback, requestUrl }
    } else {
      siteIssue = 'network'
      checks.push(...unverifiedGroup('network'))
    }
  } else if (httpsOutcome.kind === 'timeout') {
    checks.push(...unverifiedGroup('timeout'))
  } else {
    const reason: UnverifiedReason = httpsOutcome.kind === 'failure' && httpsOutcome.failure === 'timeout' ? 'timeout' : (httpsOutcome.kind === 'unverified' ? httpsOutcome.reason : 'network')
    checks.push(...unverifiedGroup(reason))
  }

  const redirectCheck = reuseForRedirect
    ? redirectCheckFromResponse(reuseForRedirect.response, reuseForRedirect.requestUrl, domain)
    : await evaluateRedirectCheck(deps, domain, deadline)
  checks.push(redirectCheck)

  const grade = gradeChecks(checks)

  const report: Report = { status: 'ok', domain: finalHost, grade, checks, checkedAt }
  if (httpStatus !== undefined) report.httpStatus = httpStatus
  if (siteIssue) report.siteIssue = siteIssue
  if (!sameSite(finalHost, domain)) report.startedFrom = domain

  return report
}
