import type { Check, Grade } from './types.ts'

export function gradeChecks(checks: Check[]): Grade | null {
  const hasCritical = checks.some((c) => c.outcome === 'problem' && c.urgency === 'critical')
  if (hasCritical) return 'F'

  const httpsUnverified = checks.some((c) => c.id === 'https' && c.outcome === 'unverified')
  const unverifiedCount = checks.filter((c) => c.outcome === 'unverified').length
  if (httpsUnverified || unverifiedCount > checks.length / 2) return null

  const importantProblems = checks.filter((c) => c.outcome === 'problem' && c.urgency === 'important').length
  if (importantProblems >= 2) return 'D'
  if (importantProblems === 1) return 'C'

  const recommendedProblems = checks.filter((c) => c.outcome === 'problem' && c.urgency === 'recommended').length
  if (recommendedProblems >= 3) return 'B'
  return 'A'
}
