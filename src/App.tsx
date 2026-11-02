import { useState } from 'react'
import { checkSite } from './api.ts'
import AddressForm from './components/AddressForm.tsx'
import PrivacyPage from './components/PrivacyPage.tsx'
import ResultView from './components/ResultView.tsx'
import type { Report } from '../supabase/functions/site-check/core/types.ts'

function App() {
  const [page, setPage] = useState<'main' | 'privacy'>('main')
  const [address, setAddress] = useState('')
  const [report, setReport] = useState<Report | null>(null)
  const [loading, setLoading] = useState(false)

  async function runCheck(value: string) {
    setAddress(value)
    setLoading(true)
    const result = await checkSite(value)
    setReport(result)
    setLoading(false)
  }

  if (page === 'privacy') {
    return (
      <main>
        <h1>Controllo Sito</h1>
        <PrivacyPage />
        <button type="button" onClick={() => setPage('main')}>
          Torna al controllo
        </button>
      </main>
    )
  }

  return (
    <main>
      <h1>Controllo Sito</h1>
      <p>Scrivi l'indirizzo di un sito e ottieni un voto, le cose da sistemare in ordine di urgenza e i passaggi per risolverle.</p>
      <AddressForm onSubmit={runCheck} loading={loading} />
      {report && <ResultView report={report} address={address} onRetry={() => runCheck(address)} />}
      <footer>
        <button type="button" onClick={() => setPage('privacy')}>
          Privacy
        </button>
      </footer>
    </main>
  )
}

export default App
