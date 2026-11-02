import { useState } from 'react'
import ProblemCard from './ProblemCard.tsx'
import TechnicalView from './TechnicalView.tsx'
import { SITE_ISSUE_COPY } from '../content/checks.ts'
import type { Check, Report } from '../../supabase/functions/site-check/core/types.ts'

const CLOSING_SENTENCE = 'Questo controllo legge solo ciò che il sito mostra a qualsiasi visitatore. Un voto alto non garantisce che il sito sia sicuro.'

const STATUS_MESSAGE: Record<'not-found' | 'rate-limited' | 'invalid-address' | 'error', string> = {
  'not-found': 'Non siamo riusciti a trovare questo indirizzo. Controlla che sia scritto correttamente.',
  'rate-limited': "Hai fatto troppi controlli in poco tempo. Aspetta un po' e riprova.",
  'invalid-address': "L'indirizzo non è valido. Controlla che sia scritto correttamente.",
  error: 'Si è verificato un problema imprevisto. Riprova più tardi.',
}

const URGENCY_RANK = { critical: 0, important: 1, recommended: 2 } as const

const dateFormatter = new Intl.DateTimeFormat('it-IT', { dateStyle: 'long', timeStyle: 'short' })

function sortedProblems(checks: Check[]): Check[] {
  return checks
    .filter((c) => c.outcome === 'problem')
    .toSorted((a, b) => URGENCY_RANK[a.urgency ?? 'recommended'] - URGENCY_RANK[b.urgency ?? 'recommended'])
}

function RetryButton({ onRetry }: { onRetry: () => void }) {
  return (
    <button type="button" onClick={onRetry}>
      Controlla di nuovo
    </button>
  )
}

interface ResultViewProps {
  report: Report
  address: string
  onRetry: () => void
}

function ResultView({ report, onRetry }: ResultViewProps) {
  const [view, setView] = useState<'simple' | 'technical'>('simple')

  if (report.status !== 'ok') {
    return (
      <section aria-label="Risultato">
        <p>{STATUS_MESSAGE[report.status]}</p>
        <RetryButton onRetry={onRetry} />
      </section>
    )
  }

  const checks = report.checks ?? []

  if (report.grade === null) {
    return (
      <section aria-label="Risultato">
        <h2>Non è stato possibile controllare il sito</h2>
        <p>{report.siteIssue ? SITE_ISSUE_COPY[report.siteIssue] : 'Troppe informazioni non si sono potute verificare durante questo controllo.'}</p>
        {report.startedFrom && <p>Il controllo è partito da {report.startedFrom}.</p>}
        {report.checkedAt && (
          <>
            <p>{CLOSING_SENTENCE}</p>
            <p>Controllo del {dateFormatter.format(new Date(report.checkedAt))}</p>
          </>
        )}
        <RetryButton onRetry={onRetry} />
      </section>
    )
  }

  const problems = sortedProblems(checks)

  return (
    <section aria-label="Risultato">
      <h2>
        Voto {report.grade}: {problems.length} {problems.length === 1 ? 'cosa' : 'cose'} da sistemare
      </h2>
      {report.startedFrom && <p>Il controllo è partito da {report.startedFrom}.</p>}

      <div role="tablist" aria-label="Modalità di visualizzazione">
        <button role="tab" type="button" aria-selected={view === 'simple'} onClick={() => setView('simple')}>
          Spiegami semplice
        </button>
        <button role="tab" type="button" aria-selected={view === 'technical'} onClick={() => setView('technical')}>
          Dettagli tecnici
        </button>
      </div>

      {view === 'simple' ? (
        <div role="tabpanel">
          {problems.length === 0 ? <p>Nessun problema trovato in questo controllo.</p> : problems.map((check) => <ProblemCard key={check.id} check={check} />)}
        </div>
      ) : (
        <div role="tabpanel">
          <TechnicalView checks={checks} />
        </div>
      )}

      {report.checkedAt && (
        <>
          <p>{CLOSING_SENTENCE}</p>
          <p>Controllo del {dateFormatter.format(new Date(report.checkedAt))}</p>
        </>
      )}
      <RetryButton onRetry={onRetry} />
    </section>
  )
}

export default ResultView
