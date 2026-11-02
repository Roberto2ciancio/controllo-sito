import { useState } from 'react'
import { CHECK_COPY } from '../content/checks.ts'
import type { Check } from '../../supabase/functions/site-check/core/types.ts'

const PLATFORMS = [
  { id: 'altro', label: 'Altro' },
  { id: 'wordpress', label: 'WordPress' },
  { id: 'wix', label: 'Wix' },
] as const

type Platform = (typeof PLATFORMS)[number]['id']

function sourceLabel(sourceUrl: string): string {
  try {
    return `Guida su ${new URL(sourceUrl).hostname.replace(/^www\./, '')}`
  } catch {
    return 'Fonte'
  }
}

interface ProblemCardProps {
  check: Check
}

function ProblemCard({ check }: ProblemCardProps) {
  const [platform, setPlatform] = useState<Platform>('altro')
  const copy = CHECK_COPY[check.id]
  const guide = copy.guides[platform]

  return (
    <article className="problem-card" data-urgency={check.urgency}>
      <h3>{copy.title}</h3>
      <p>{copy.consequence}</p>

      <div role="tablist" aria-label="Guida per piattaforma">
        {PLATFORMS.map(({ id, label }) => (
          <button key={id} role="tab" type="button" aria-selected={platform === id} onClick={() => setPlatform(id)}>
            {label}
          </button>
        ))}
      </div>
      <div role="tabpanel">
        <ol>
          {guide.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        {guide.sourceUrl && (
          <a href={guide.sourceUrl} target="_blank" rel="noreferrer">
            {sourceLabel(guide.sourceUrl)}
          </a>
        )}
      </div>
    </article>
  )
}

export default ProblemCard
