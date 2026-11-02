import { describe, expect, it } from 'vitest'
import { probeSite, RequestError, type ProbeDeps, type ProbeResponse, type RequestFailure } from './probe.ts'

const PUBLIC_IP = ['93.184.216.34']

function resp(status: number, headers: Record<string, string> = {}, setCookies: string[] = []): ProbeResponse {
  return { status, headers: new Headers(headers), setCookies }
}

interface FakeOptions {
  resolve?: Record<string, string[]>
  requests?: Record<string, ProbeResponse | RequestFailure>
  now?: Date
  /** Avanza l'orologio di questi millisecondi a ogni chiamata a request(), per simulare un controllo lento. */
  advanceMsPerRequest?: number
}

function makeDeps(opts: FakeOptions): ProbeDeps {
  let clock = opts.now ?? new Date('2026-01-01T00:00:00Z')
  const resolveCalls: string[] = []
  const requestCalls: string[] = []
  const deps: ProbeDeps & { resolveCalls: string[]; requestCalls: string[] } = {
    resolveCalls,
    requestCalls,
    async resolve(host: string) {
      resolveCalls.push(host)
      return opts.resolve?.[host] ?? PUBLIC_IP
    },
    async request(url: string) {
      requestCalls.push(url)
      if (opts.advanceMsPerRequest) clock = new Date(clock.getTime() + opts.advanceMsPerRequest)
      const entry = opts.requests?.[url]
      if (entry === undefined) throw new RequestError('network')
      if (typeof entry === 'string') throw new RequestError(entry)
      return entry
    },
    now() {
      return clock
    },
  }
  return deps
}

describe('probeSite: sito sano', () => {
  it('restituisce 9 controlli e voto A, senza startedFrom', async () => {
    const deps = makeDeps({
      requests: {
        'https://esempio.it/': resp(200, {
          'strict-transport-security': 'max-age=31536000; includeSubDomains',
          'content-security-policy': "default-src 'self'; frame-ancestors 'self'",
          'x-content-type-options': 'nosniff',
          'referrer-policy': 'strict-origin',
        }),
        'http://esempio.it/': resp(301, { location: 'https://esempio.it/' }),
      },
    })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.status).toBe('ok')
    expect(report.domain).toBe('esempio.it')
    expect(report.startedFrom).toBeUndefined()
    expect(report.checks).toHaveLength(9)
    expect(report.grade).toBe('A')
  })
})

describe('probeSite: indirizzo non raggiungibile', () => {
  it('resolve senza risultati dà not-found', async () => {
    const deps = makeDeps({ resolve: { 'esempio.it': [] } })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.status).toBe('not-found')
  })
})

describe('probeSite: https rifiutato sulla 443', () => {
  it('refused su 443 e 200 su http:// dà https critico, voto F, intestazioni non verificate fix-https-first', async () => {
    const deps = makeDeps({
      requests: {
        'https://esempio.it/': 'refused',
        'http://esempio.it/': resp(200),
      },
    })
    const report = await probeSite(deps, 'esempio.it')
    const https = report.checks?.find((c) => c.id === 'https')
    expect(https).toEqual({ id: 'https', outcome: 'problem', urgency: 'critical' })
    expect(report.grade).toBe('F')
    const hsts = report.checks?.find((c) => c.id === 'hsts')
    expect(hsts?.outcome).toBe('unverified')
    expect(hsts?.reason).toBe('fix-https-first')
  })

  it('refused su 443 e http:// che non risponde dà https non verificato, nessun voto, siteIssue network', async () => {
    const deps = makeDeps({
      requests: {
        'https://esempio.it/': 'refused',
        'http://esempio.it/': 'network',
      },
    })
    const report = await probeSite(deps, 'esempio.it')
    const https = report.checks?.find((c) => c.id === 'https')
    expect(https?.outcome).toBe('unverified')
    expect(report.grade).toBeNull()
    expect(report.siteIssue).toBe('network')
  })
})

describe('probeSite: https non verificabile', () => {
  it('timeout su 443 dà https non verificato, nessun voto', async () => {
    const deps = makeDeps({ requests: { 'https://esempio.it/': 'timeout', 'http://esempio.it/': resp(200) } })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.checks?.find((c) => c.id === 'https')?.outcome).toBe('unverified')
    expect(report.grade).toBeNull()
  })

  it('tls-other su 443 dà https non verificato, nessun voto', async () => {
    const deps = makeDeps({ requests: { 'https://esempio.it/': 'tls-other', 'http://esempio.it/': resp(200) } })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.checks?.find((c) => c.id === 'https')?.outcome).toBe('unverified')
    expect(report.grade).toBeNull()
  })
})

describe('probeSite: errori di certificato', () => {
  it.each<RequestFailure>(['cert-expired', 'cert-name', 'cert-issuer'])('%s dà certificato critico, voto F, intestazioni fix-https-first, senza altri tentativi https', async (failure) => {
    const deps = makeDeps({ requests: { 'https://esempio.it/': failure, 'http://esempio.it/': resp(200) } })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.checks?.find((c) => c.id === 'https')?.outcome).toBe('passed')
    const cert = report.checks?.find((c) => c.id === 'certificate')
    expect(cert?.outcome).toBe('problem')
    expect(cert?.urgency).toBe('critical')
    expect(report.grade).toBe('F')
    expect(report.checks?.find((c) => c.id === 'hsts')?.reason).toBe('fix-https-first')
  })
})

describe('probeSite: da http a https', () => {
  it('http:// che porta a https:// dello stesso sito passa', async () => {
    const deps = makeDeps({
      requests: { 'https://esempio.it/': resp(200), 'http://esempio.it/': resp(301, { location: 'https://esempio.it/' }) },
    })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.checks?.find((c) => c.id === 'redirect')?.outcome).toBe('passed')
  })

  it('http:// che resta su http è un problema importante', async () => {
    const deps = makeDeps({ requests: { 'https://esempio.it/': resp(200), 'http://esempio.it/': resp(200) } })
    const report = await probeSite(deps, 'esempio.it')
    const redirect = report.checks?.find((c) => c.id === 'redirect')
    expect(redirect?.outcome).toBe('problem')
    expect(redirect?.urgency).toBe('important')
  })

  it('http:// che non risponde è non verificato', async () => {
    const deps = makeDeps({ requests: { 'https://esempio.it/': resp(200), 'http://esempio.it/': 'network' } })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.checks?.find((c) => c.id === 'redirect')?.outcome).toBe('unverified')
  })
})

describe('probeSite: sito che rifiuta o pagina di errore', () => {
  it.each([401, 403, 429, 503])('%i dà siteIssue rejected, intestazioni non verificate, certificato e voto normali', async (status) => {
    const deps = makeDeps({ requests: { 'https://esempio.it/': resp(status), 'http://esempio.it/': resp(301, { location: 'https://esempio.it/' }) } })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.siteIssue).toBe('rejected')
    expect(report.checks?.find((c) => c.id === 'cookies')?.reason).toBe('rejected')
    expect(report.checks?.find((c) => c.id === 'certificate')?.outcome).toBe('passed')
  })

  it('cf-mitigated: challenge dà siteIssue rejected anche con stato 200', async () => {
    const deps = makeDeps({
      requests: { 'https://esempio.it/': resp(200, { 'cf-mitigated': 'challenge' }), 'http://esempio.it/': resp(301, { location: 'https://esempio.it/' }) },
    })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.siteIssue).toBe('rejected')
  })

  it.each([404, 500, 502])('%i dà siteIssue error-page, intestazioni non verificate', async (status) => {
    const deps = makeDeps({ requests: { 'https://esempio.it/': resp(status), 'http://esempio.it/': resp(301, { location: 'https://esempio.it/' }) } })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.siteIssue).toBe('error-page')
    expect(report.checks?.find((c) => c.id === 'cookies')?.reason).toBe('error-page')
  })
})

describe('probeSite: dominio di arrivo', () => {
  it('www.esempio.it che arriva a esempio.it non ha startedFrom', async () => {
    const deps = makeDeps({
      resolve: { 'www.esempio.it': PUBLIC_IP, 'esempio.it': PUBLIC_IP },
      requests: {
        'https://www.esempio.it/': resp(301, { location: 'https://esempio.it/' }),
        'https://esempio.it/': resp(200),
        'http://www.esempio.it/': resp(301, { location: 'https://www.esempio.it/' }),
      },
    })
    const report = await probeSite(deps, 'www.esempio.it')
    expect(report.domain).toBe('esempio.it')
    expect(report.startedFrom).toBeUndefined()
  })

  it('esempio.it che arriva ad altro.it ha startedFrom e domain è quello di arrivo', async () => {
    const deps = makeDeps({
      resolve: { 'esempio.it': PUBLIC_IP, 'altro.it': PUBLIC_IP },
      requests: {
        'https://esempio.it/': resp(301, { location: 'https://altro.it/' }),
        'https://altro.it/': resp(200),
        'http://esempio.it/': resp(301, { location: 'https://esempio.it/' }),
      },
    })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.domain).toBe('altro.it')
    expect(report.startedFrom).toBe('esempio.it')
  })
})

describe('probeSite: reindirizzamenti anomali (Review Focus)', () => {
  it('un ciclo di reindirizzamenti non blocca, dà un esito non verificato', async () => {
    const deps = makeDeps({
      requests: {
        'https://esempio.it/': resp(302, { location: 'https://esempio.it/b' }),
        'https://esempio.it/b': resp(302, { location: 'https://esempio.it/' }),
        'http://esempio.it/': resp(301, { location: 'https://esempio.it/' }),
      },
    })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.status).toBe('ok')
    expect(report.checks?.find((c) => c.id === 'https')?.outcome).toBe('unverified')
  })

  it('oltre 5 salti dà un esito non verificato', async () => {
    const requests: Record<string, ProbeResponse> = {}
    for (let i = 0; i < 7; i++) {
      requests[`https://esempio.it/${i}`] = resp(302, { location: `https://esempio.it/${i + 1}` })
    }
    requests['https://esempio.it/'] = resp(302, { location: 'https://esempio.it/0' })
    requests['http://esempio.it/'] = resp(301, { location: 'https://esempio.it/' })
    const deps = makeDeps({ requests })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.checks?.find((c) => c.id === 'https')?.outcome).toBe('unverified')
  })

  it('un reindirizzamento da https a http non blocca e non verifica inventando dati', async () => {
    const deps = makeDeps({
      requests: {
        'https://esempio.it/': resp(302, { location: 'http://esempio.it/pagina' }),
        'http://esempio.it/pagina': resp(200),
        'http://esempio.it/': resp(200),
      },
    })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.status).toBe('ok')
    // il sito di arrivo è su http: non deve passare per https verificato con dati inventati
    const https = report.checks?.find((c) => c.id === 'https')
    expect(https).toBeDefined()
  })

  it('una Location relativa viene risolta', async () => {
    const deps = makeDeps({
      requests: {
        'https://esempio.it/': resp(302, { location: '/nuova-pagina' }),
        'https://esempio.it/nuova-pagina': resp(200),
        'http://esempio.it/': resp(301, { location: 'https://esempio.it/' }),
      },
    })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.checks?.find((c) => c.id === 'https')?.outcome).toBe('passed')
  })

  it('una Location non valida dà un esito non verificato', async () => {
    const deps = makeDeps({
      requests: {
        'https://esempio.it/': resp(302, { location: '::::non valido::::' }),
        'http://esempio.it/': resp(301, { location: 'https://esempio.it/' }),
      },
    })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.checks?.find((c) => c.id === 'https')?.outcome).toBe('unverified')
  })

  it('un reindirizzamento verso un indirizzo privato non genera alcuna richiesta a quell\'indirizzo', async () => {
    const deps = makeDeps({
      resolve: { 'esempio.it': PUBLIC_IP, 'interno.esempio.it': ['10.0.0.1'] },
      requests: {
        'https://esempio.it/': resp(302, { location: 'https://interno.esempio.it/' }),
        'https://interno.esempio.it/': resp(200),
        'http://esempio.it/': resp(301, { location: 'https://esempio.it/' }),
      },
    })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.checks?.find((c) => c.id === 'https')?.outcome).toBe('unverified')
    expect((deps as unknown as { requestCalls: string[] }).requestCalls).not.toContain('https://interno.esempio.it/')
  })

  it('una porta 8080 nella Location viene rifiutata', async () => {
    const deps = makeDeps({
      requests: {
        'https://esempio.it/': resp(302, { location: 'https://esempio.it:8080/' }),
        'http://esempio.it/': resp(301, { location: 'https://esempio.it/' }),
      },
    })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.checks?.find((c) => c.id === 'https')?.outcome).toBe('unverified')
  })
})

describe('probeSite: tempo esaurito (Review Focus)', () => {
  it('esaurendo i 20 secondi a metà, restituisce un Report con i controlli mancanti timeout e nessuna richiesta oltre il limite', async () => {
    const deps = makeDeps({
      advanceMsPerRequest: 21_000,
      requests: {
        'https://esempio.it/': resp(200),
        'http://esempio.it/': resp(301, { location: 'https://esempio.it/' }),
      },
    })
    const report = await probeSite(deps, 'esempio.it')
    expect(report.status).toBe('ok')
    const redirect = report.checks?.find((c) => c.id === 'redirect')
    expect(redirect?.outcome).toBe('unverified')
    expect(redirect?.reason).toBe('timeout')
    // una sola richiesta https: il tempo si esaurisce prima del fetch di redirect
    expect((deps as unknown as { requestCalls: string[] }).requestCalls).toEqual(['https://esempio.it/'])
  })
})
