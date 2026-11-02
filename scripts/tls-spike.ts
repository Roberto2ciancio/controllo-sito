// Spike: possiamo leggere la scadenza di un certificato TLS sotto Deno (il runtime delle
// Supabase Edge Function), e che testo esatto restituiscono gli errori di certificato?
// Eseguire con: npx --yes deno@2 run --allow-net scripts/tls-spike.ts
import tls from 'node:tls'

function checkCertificate(host: string): Promise<void> {
  return new Promise((resolve) => {
    const socket = tls.connect({ host, port: 443, servername: host }, () => {
      const cert = socket.getPeerCertificate()
      console.log(`[certificato] ${host} -> valid_to = ${cert.valid_to ?? '(assente)'}`)
      socket.end()
      resolve()
    })
    socket.on('error', (err) => {
      console.log(`[certificato] ${host} -> errore di connessione: ${String(err)}`)
      resolve()
    })
  })
}

async function checkFetchError(host: string): Promise<void> {
  try {
    const res = await fetch(`https://${host}/`, { method: 'HEAD' })
    console.log(`[fetch] ${host} -> nessun errore, status ${res.status}`)
  } catch (err) {
    console.log(`[fetch] ${host} -> ${String(err)}`)
    if (err instanceof Error && err.cause) {
      console.log(`[fetch] ${host} -> cause: ${String(err.cause)}`)
    }
  }
}

await checkCertificate('github.com')
await checkFetchError('expired.badssl.com')
await checkFetchError('wrong.host.badssl.com')
