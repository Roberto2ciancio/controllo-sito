import { CHECK_COPY } from '../content/checks.ts'
import type { Check } from '../../supabase/functions/site-check/core/types.ts'

const OUTCOME_LABEL = { passed: 'Ok', problem: 'Da sistemare', unverified: 'Non verificato' } as const

interface TechnicalViewProps {
  checks: Check[]
}

function TechnicalView({ checks }: TechnicalViewProps) {
  return (
    <table className="technical-view">
      <thead>
        <tr>
          <th scope="col">Controllo</th>
          <th scope="col">Stato</th>
          <th scope="col">Valore osservato</th>
          <th scope="col">Documentazione</th>
        </tr>
      </thead>
      <tbody>
        {checks.map((check) => (
          <tr key={check.id} data-outcome={check.outcome}>
            <td>{check.id}</td>
            <td>{OUTCOME_LABEL[check.outcome]}</td>
            <td>{check.observed ?? '—'}</td>
            <td>
              <a href={CHECK_COPY[check.id].docUrl} target="_blank" rel="noreferrer">
                Scopri di più
              </a>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default TechnicalView
