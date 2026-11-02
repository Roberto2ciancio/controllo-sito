export type CheckId =
  | 'https'
  | 'certificate'
  | 'expiry'
  | 'redirect'
  | 'hsts'
  | 'csp'
  | 'framing'
  | 'content-type'
  | 'referrer'
  | 'cookies'

export type Urgency = 'critical' | 'important' | 'recommended'

export type UnverifiedReason = 'network' | 'rejected' | 'error-page' | 'fix-https-first' | 'unavailable' | 'timeout'

export interface Check {
  id: CheckId
  outcome: 'passed' | 'problem' | 'unverified'
  urgency?: Urgency
  reason?: UnverifiedReason
  observed?: string
}

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'

export interface Report {
  status: 'ok' | 'not-found' | 'rate-limited' | 'invalid-address' | 'error'
  domain?: string
  startedFrom?: string
  grade?: Grade | null
  checks?: Check[]
  httpStatus?: number
  checkedAt?: string
  headers?: Record<string, string>
  siteIssue?: 'rejected' | 'error-page' | 'network'
}
