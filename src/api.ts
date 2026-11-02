import type { Report } from '../supabase/functions/site-check/core/types.ts'

export async function checkSite(address: string): Promise<Report> {
  const url = import.meta.env.VITE_SITE_CHECK_URL as string
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ address }),
    })
    return (await response.json()) as Report
  } catch {
    return { status: 'error' }
  }
}
