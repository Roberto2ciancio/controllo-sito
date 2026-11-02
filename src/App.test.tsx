import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from './App.tsx'
import AddressForm from './components/AddressForm.tsx'
import PrivacyPage from './components/PrivacyPage.tsx'
import ResultView from './components/ResultView.tsx'
import type { Check, Report } from '../supabase/functions/site-check/core/types.ts'

const CHECKED_AT = '2026-11-01T10:00:00.000Z'

const PASSED_CHECKS: Check[] = [
  { id: 'https', outcome: 'passed' },
  { id: 'certificate', outcome: 'passed' },
  { id: 'expiry', outcome: 'passed', observed: '2027-01-01T00:00:00.000Z' },
  { id: 'hsts', outcome: 'passed', urgency: 'recommended', observed: 'max-age=31536000' },
  { id: 'csp', outcome: 'passed', urgency: 'recommended', observed: "default-src 'self'" },
  { id: 'framing', outcome: 'passed', urgency: 'recommended', observed: 'X-Frame-Options: DENY' },
  { id: 'content-type', outcome: 'passed', urgency: 'recommended', observed: 'nosniff' },
  { id: 'referrer', outcome: 'passed', urgency: 'recommended', observed: 'strict-origin-when-cross-origin' },
  { id: 'cookies', outcome: 'passed', urgency: 'recommended', observed: 'nessun cookie impostato da questa pagina' },
  { id: 'redirect', outcome: 'passed', urgency: 'important', observed: 'https://esempio.it/' },
]

function withChecks(overrides: Check[]): Check[] {
  const byId = new Map(overrides.map((c) => [c.id, c]))
  return PASSED_CHECKS.map((c) => byId.get(c.id) ?? c)
}

function okReport(overrides: Partial<Report> & { checks: Check[] }): Report {
  return { status: 'ok', domain: 'esempio.it', checkedAt: CHECKED_AT, ...overrides }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('AddressForm', () => {
  it('invia il modulo con l\'indirizzo scritto', async () => {
    const onSubmit = vi.fn()
    render(<AddressForm onSubmit={onSubmit} loading={false} />)
    await userEvent.type(screen.getByLabelText(/indirizzo/i), 'esempio.it')
    await userEvent.click(screen.getByRole('button', { name: /controlla/i }))
    expect(onSubmit).toHaveBeenCalledWith('esempio.it')
  })

  it('durante il controllo disabilita il pulsante e lo annuncia agli screen reader', () => {
    render(<AddressForm onSubmit={vi.fn()} loading={true} />)
    expect(screen.getByRole('button', { name: /controllo in corso/i })).toBeDisabled()
    expect(screen.getByRole('status')).toHaveTextContent(/controllo in corso/i)
  })
})

describe('ResultView', () => {
  it('con un voto C e un problema importante mostra "1 cosa da sistemare"', () => {
    const report = okReport({ grade: 'C', checks: withChecks([{ id: 'redirect', outcome: 'problem', urgency: 'important', observed: 'resta su http://' }]) })
    render(<ResultView report={report} address="esempio.it" onRetry={vi.fn()} />)
    expect(screen.getByText('Voto C: 1 cosa da sistemare')).toBeInTheDocument()
  })

  it('con due problemi mostra "2 cose da sistemare"', () => {
    const report = okReport({
      grade: 'D',
      checks: withChecks([
        { id: 'redirect', outcome: 'problem', urgency: 'important', observed: 'resta su http://' },
        { id: 'hsts', outcome: 'problem', urgency: 'recommended' },
      ]),
    })
    render(<ResultView report={report} address="esempio.it" onRetry={vi.fn()} />)
    expect(screen.getByText('Voto D: 2 cose da sistemare')).toBeInTheDocument()
  })

  it('mostra i problemi in ordine: critici, importanti, consigliati', () => {
    const report = okReport({
      grade: 'F',
      checks: withChecks([
        { id: 'hsts', outcome: 'problem', urgency: 'recommended' },
        { id: 'certificate', outcome: 'problem', urgency: 'critical', observed: 'cert-expired' },
        { id: 'redirect', outcome: 'problem', urgency: 'important', observed: 'resta su http://' },
      ]),
    })
    render(<ResultView report={report} address="esempio.it" onRetry={vi.fn()} />)
    const titles = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    const certIndex = titles.findIndex((t) => t?.includes('Certificato non valido'))
    const redirectIndex = titles.findIndex((t) => t?.includes('non porta automaticamente'))
    const hstsIndex = titles.findIndex((t) => t?.includes('non impone sempre'))
    expect(certIndex).toBeGreaterThanOrEqual(0)
    expect(certIndex).toBeLessThan(redirectIndex)
    expect(redirectIndex).toBeLessThan(hstsIndex)
  })

  it('"Spiegami semplice" è il predefinito con la scheda Altro aperta; passando a WordPress compaiono i suoi passaggi con il link alla fonte', async () => {
    const report = okReport({ grade: 'B', checks: withChecks([{ id: 'hsts', outcome: 'problem', urgency: 'recommended' }]) })
    render(<ResultView report={report} address="esempio.it" onRetry={vi.fn()} />)

    expect(screen.getByRole('tab', { name: 'Spiegami semplice', selected: true })).toBeInTheDocument()
    const card = screen.getByRole('heading', { level: 3, name: /non impone sempre/ }).closest('article')!
    expect(within(card).getByRole('tab', { name: 'Altro', selected: true })).toBeInTheDocument()

    await userEvent.click(within(card).getByRole('tab', { name: 'WordPress' }))
    expect(within(card).getByText(/Header set Strict-Transport-Security/)).toBeInTheDocument()
    expect(within(card).getByRole('link', { name: /wpbeginner/i })).toHaveAttribute('href', 'https://www.wpbeginner.com/beginners-guide/how-to-add-http-security-headers-in-wordpress/')
  })

  it('"Dettagli tecnici" mostra stato, valori osservati e il link alla documentazione', async () => {
    const report = okReport({ grade: 'F', checks: withChecks([{ id: 'certificate', outcome: 'problem', urgency: 'critical', observed: 'cert-expired' }]) })
    render(<ResultView report={report} address="esempio.it" onRetry={vi.fn()} />)

    await userEvent.click(screen.getByRole('tab', { name: 'Dettagli tecnici' }))
    const row = screen.getByText('certificate').closest('tr')!
    expect(within(row).getByText('Da sistemare')).toBeInTheDocument()
    expect(within(row).getByText('cert-expired')).toBeInTheDocument()
    expect(within(row).getByRole('link', { name: /scopri di più/i })).toHaveAttribute('href', 'https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/TLS')
  })

  it('ogni esito ha un testo, non solo un colore', async () => {
    const report = okReport({ grade: 'F', checks: withChecks([{ id: 'certificate', outcome: 'problem', urgency: 'critical', observed: 'cert-expired' }]) })
    render(<ResultView report={report} address="esempio.it" onRetry={vi.fn()} />)
    await userEvent.click(screen.getByRole('tab', { name: 'Dettagli tecnici' }))
    expect(screen.getAllByText('Ok').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Da sistemare').length).toBeGreaterThan(0)
  })

  it('con voto non calcolabile mostra il motivo (sito che ha rifiutato il controllo)', () => {
    const report = okReport({ grade: null, siteIssue: 'rejected', checks: withChecks([]) })
    render(<ResultView report={report} address="esempio.it" onRetry={vi.fn()} />)
    expect(screen.getByText('Non è stato possibile controllare il sito')).toBeInTheDocument()
    expect(screen.getByText(/Il sito ha rifiutato il controllo/)).toBeInTheDocument()
  })

  it('mostra "partito da" quando il sito finale differisce dall\'indirizzo scritto', () => {
    const report = okReport({ grade: 'A', domain: 'www.esempio.it', startedFrom: 'esempio.it', checks: withChecks([]) })
    render(<ResultView report={report} address="esempio.it" onRetry={vi.fn()} />)
    expect(screen.getByText(/partito da esempio\.it/)).toBeInTheDocument()
  })

  it.each([
    ['not-found', 'Non siamo riusciti a trovare questo indirizzo. Controlla che sia scritto correttamente.'],
    ['rate-limited', 'Hai fatto troppi controlli in poco tempo. Aspetta un po\' e riprova.'],
    ['invalid-address', 'L\'indirizzo non è valido. Controlla che sia scritto correttamente.'],
    ['error', 'Si è verificato un problema imprevisto. Riprova più tardi.'],
  ] as const)('per lo stato %s mostra il suo messaggio e nessun voto', (status, message) => {
    render(<ResultView report={{ status }} address="esempio.it" onRetry={vi.fn()} />)
    expect(screen.getByText(message)).toBeInTheDocument()
    expect(screen.queryByText(/^Voto /)).not.toBeInTheDocument()
  })

  it('con un risultato mostra sempre la frase fissa, la data del controllo, e un pulsante per ripetere il controllo', async () => {
    const onRetry = vi.fn()
    const report = okReport({ grade: 'A', checks: withChecks([]) })
    render(<ResultView report={report} address="esempio.it" onRetry={onRetry} />)
    expect(screen.getByText('Questo controllo legge solo ciò che il sito mostra a qualsiasi visitatore. Un voto alto non garantisce che il sito sia sicuro.')).toBeInTheDocument()
    expect(screen.getByText(/novembre 2026/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /controlla di nuovo/i }))
    expect(onRetry).toHaveBeenCalled()
  })
})

describe('PrivacyPage', () => {
  it('spiega che non ci sono account, risultati salvati, e che i dati sono cancellati dopo 48 ore', () => {
    render(<PrivacyPage />)
    expect(screen.getByText(/nessun account/i)).toBeInTheDocument()
    expect(screen.getByText(/nessun risultato/i)).toBeInTheDocument()
    expect(screen.getByText(/48 ore/)).toBeInTheDocument()
  })
})

describe('App', () => {
  it('mostra il titolo Controllo Sito', () => {
    render(<App />)
    expect(screen.getByText('Controllo Sito')).toBeInTheDocument()
  })

  it('invia un controllo e mostra il risultato ricevuto dalla funzione', async () => {
    const report: Report = { status: 'ok', domain: 'esempio.it', grade: 'A', checks: withChecks([]), checkedAt: CHECKED_AT }
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ json: () => Promise.resolve(report) } as Response),
    )
    render(<App />)
    await userEvent.type(screen.getByLabelText(/indirizzo/i), 'esempio.it')
    await userEvent.click(screen.getByRole('button', { name: /controlla/i }))
    expect(await screen.findByText('Voto A: 0 cose da sistemare')).toBeInTheDocument()
  })
})
