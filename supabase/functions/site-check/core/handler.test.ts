import { afterEach, describe, expect, it, vi } from 'vitest'
import { handleCheck, hashIp, type HandlerDeps } from './handler.ts'
import type { Report } from './types.ts'

const ALLOWED_ORIGINS = ['https://roberto2ciancio.github.io', 'http://localhost:5173']

function makeDeps(overrides: Partial<HandlerDeps> = {}): HandlerDeps & { claim: ReturnType<typeof vi.fn>; probe: ReturnType<typeof vi.fn> } {
  return {
    getIp: () => '203.0.113.1',
    salt: 'il-sale',
    hashIp,
    claim: vi.fn(async () => 'ok' as const),
    probe: vi.fn(async (): Promise<Report> => ({ status: 'ok', domain: 'esempio.it', grade: 'A', checks: [], checkedAt: new Date().toISOString() })),
    allowedOrigins: ALLOWED_ORIGINS,
    ...overrides,
  }
}

function postRequest(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('https://x/site-check', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json', ...headers } })
}

describe('handleCheck: indirizzo', () => {
  it('un indirizzo non valido dà invalid-address senza chiamare claim o probe', async () => {
    const deps = makeDeps()
    const res = await handleCheck(postRequest({ address: 'non un sito' }), deps)
    const body = await res.json()
    expect(body.status).toBe('invalid-address')
    expect(deps.claim).not.toHaveBeenCalled()
    expect(deps.probe).not.toHaveBeenCalled()
  })
})

describe('handleCheck: limiti', () => {
  it('il limite raggiunto dà rate-limited senza chiamare probe', async () => {
    const deps = makeDeps({ claim: vi.fn(async () => 'limit-ip' as const) })
    const res = await handleCheck(postRequest({ address: 'esempio.it' }), deps)
    const body = await res.json()
    expect(body.status).toBe('rate-limited')
    expect(deps.probe).not.toHaveBeenCalled()
  })

  it('un controllo dei limiti che fallisce rifiuta la richiesta senza chiamare probe', async () => {
    const deps = makeDeps({
      claim: vi.fn(async () => {
        throw new Error('db down')
      }),
    })
    const res = await handleCheck(postRequest({ address: 'esempio.it' }), deps)
    const body = await res.json()
    expect(body.status).toBe('error')
    expect(deps.probe).not.toHaveBeenCalled()
  })

  it('il controllo passa chiama probe e restituisce il suo Report', async () => {
    const deps = makeDeps()
    const res = await handleCheck(postRequest({ address: 'esempio.it' }), deps)
    const body = await res.json()
    expect(body.status).toBe('ok')
    expect(deps.probe).toHaveBeenCalledWith('esempio.it')
  })
})

describe('handleCheck: metodo', () => {
  it('un metodo diverso da POST dà 405', async () => {
    const deps = makeDeps()
    const res = await handleCheck(new Request('https://x/site-check', { method: 'GET' }), deps)
    expect(res.status).toBe(405)
  })

  it.each(ALLOWED_ORIGINS)('OPTIONS da %s risponde con le intestazioni CORS per quella origine', async (origin) => {
    const deps = makeDeps()
    const res = await handleCheck(new Request('https://x/site-check', { method: 'OPTIONS', headers: { origin } }), deps)
    expect(res.headers.get('access-control-allow-origin')).toBe(origin)
    expect(res.headers.get('access-control-allow-methods')).toContain('POST')
  })
})

describe('handleCheck: errori imprevisti', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('un errore imprevisto dà status error senza stampare il dominio controllato', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const deps = makeDeps({
      probe: vi.fn(async () => {
        throw new Error('fallimento interno')
      }),
    })
    const res = await handleCheck(postRequest({ address: 'segreto-da-non-loggare.it' }), deps)
    const body = await res.json()
    expect(body.status).toBe('error')
    const loggedText = spy.mock.calls.flat().map(String).join(' ')
    expect(loggedText).not.toContain('segreto-da-non-loggare.it')
  })
})

describe('hashIp', () => {
  it('non restituisce l\'indirizzo IP in chiaro', async () => {
    const hash = await hashIp('203.0.113.1', 'il-sale')
    expect(hash).not.toContain('203.0.113.1')
  })

  it('cambia con il sale', async () => {
    const a = await hashIp('203.0.113.1', 'sale-a')
    const b = await hashIp('203.0.113.1', 'sale-b')
    expect(a).not.toBe(b)
  })

  it('è lo stesso per lo stesso indirizzo e lo stesso sale', async () => {
    const a = await hashIp('203.0.113.1', 'il-sale')
    const b = await hashIp('203.0.113.1', 'il-sale')
    expect(a).toBe(b)
  })
})
