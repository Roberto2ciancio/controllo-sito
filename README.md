# Controllo Sito

Strumento gratuito e senza account: scrivi l'indirizzo di un sito, ottieni un voto, le cose da sistemare in ordine di urgenza e i passaggi per risolverle.

Legge solo ciò che un sito mostra a qualsiasi visitatore (HTTPS, certificato, intestazioni di sicurezza, cookie): nessuna scansione, nessun tentativo di accesso, nessuna analisi del contenuto delle pagine.

Vedi `docs/superpowers/specs/2026-11-01-controllo-sito-design.md` per il documento di progetto completo.

## Sviluppo

```bash
npm install
npm run dev
```

## Test

```bash
npm test
```

## Build

```bash
npm run build
```

## Architettura

- `supabase/functions/site-check/core/` — logica pura del controllo (indirizzo, intestazioni, voto, orchestrazione), senza API di Deno, testata con Vitest, con la rete passata come dipendenza iniettata.
- `supabase/functions/site-check/index.ts` — collega la logica pura a DNS, fetch e certificato TLS veri (Deno Edge Function).
- `src/` — frontend React che chiama la funzione e traduce gli esiti in testo semplice.

## Privacy e sicurezza dello strumento

Nessun account, nessun risultato salvato. Solo domini pubblici: indirizzi IP, `localhost` e nomi interni sono rifiutati. Per i limiti si conserva solo un'impronta non reversibile dell'IP più il dominio controllato, cancellati dopo 48 ore. Dettagli completi nel documento di progetto.
