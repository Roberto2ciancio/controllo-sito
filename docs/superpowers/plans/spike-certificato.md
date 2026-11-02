# Spike: scadenza del certificato sotto Deno

**Comando:** `npx --yes deno@2 run --allow-net scripts/tls-spike.ts`

**Esito: `node:tls` funziona sotto Deno 2 locale.** `getPeerCertificate().valid_to` restituisce una data reale.

```
[certificato] github.com -> valid_to = Jan 27 23:59:59 2027 GMT
[fetch] expired.badssl.com -> TypeError: fetch failed
[fetch] expired.badssl.com -> cause: Error: error sending request for url (https://expired.badssl.com/): client error (Connect): invalid peer certificate: certificate expired: verification time 1793610096 (UNIX), but certificate is not valid after 1428883199 (364726897 seconds ago)
[fetch] wrong.host.badssl.com -> TypeError: fetch failed
[fetch] wrong.host.badssl.com -> cause: Error: error sending request for url (https://wrong.host.badssl.com/): client error (Connect): invalid peer certificate: certificate not valid for name "wrong.host.badssl.com"; certificate is only valid for DnsName("*.badssl.com") or DnsName("badssl.com")
```

**Cosa dice per il Task 5 (classificazione di `RequestFailure`):**
- Certificato scaduto: il testo dell'errore `cause` contiene `"certificate expired"`.
- Nome host errato: il testo dell'errore `cause` contiene `"certificate not valid for name"`.
- Entrambi arrivano come `TypeError: fetch failed` con la causa vera dentro `err.cause`, non nel messaggio di primo livello: `request()` dovrà leggere `err.cause` per classificare l'errore, non solo `err.message`.

**Avvertenza dal piano:** Deno locale non è il runtime di Supabase. Il testo esatto degli errori va riverificato nella prova reale del Task 9 (Step 4), perché un runtime diverso potrebbe formulare l'errore in modo diverso.
