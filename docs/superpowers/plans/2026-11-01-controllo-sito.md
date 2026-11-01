# Controllo Sito Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uno strumento web gratuito e senza account che legge ciò che un sito mostra a ogni visitatore, dà un voto e spiega passo per passo come risolvere ogni problema.

**Architecture:** Una logica pura in `supabase/functions/site-check/core/`, senza API di Deno e testata con Vitest, riceve la rete come dipendenze iniettate. Un sottile `index.ts` per Deno collega DNS, fetch e certificato alla logica. Il frontend React su GitHub Pages chiama la funzione e traduce gli esiti in testi.

**Tech Stack:** Vite 8, React 19, TypeScript, Vitest, Testing Library, PGlite per i test SQL, Supabase Edge Functions (Deno).

**Spec:** `docs/superpowers/specs/2026-11-01-controllo-sito-design.md`

## Global Constraints

- Costo zero: GitHub Pages e piano gratuito di Supabase, usando il progetto di Bere `ecrknwwinnkwdwngkois`.
- **Nulla viene pubblicato sul progetto di Bere senza un ok esplicito di Roberto.** Nessun `supabase` che scrive, nessun push su GitHub prima del Task 9.
- Non toccare tabelle, funzioni, migrazioni o `config.toml` di Bere. L'SQL è ripetibile e si applica con `supabase db query --linked --file`, mai con `db push`.
- Mai disattivare la verifica del certificato per leggere le intestazioni.
- Mai inventare un valore: ciò che non si può accertare è "non verificato", con il motivo.
- Gli indirizzi controllati non vanno nei registri applicativi.
- Interfaccia in italiano, utilizzabile sul telefono, con tastiera e con screen reader. Nessun esito comunicato solo con il colore.
- Frase fissa in fondo al risultato: "Questo controllo legge solo ciò che il sito mostra a qualsiasi visitatore. Un voto alto non garantisce che il sito sia sicuro."
- Base del sito: `/controllo-sito/`. Commit con `Roberto2ciancio@users.noreply.github.com`, già impostato in questo repo.
- Niente segreti e niente dati personali nel repo.

## Review Focus

1. Indirizzi scritti in modo insolito (maiuscole, spazi, punto finale, porta, percorso, caratteri accentati): vanno normalizzati, oppure rifiutati con un messaggio chiaro. Test nel Task 2.
2. Indirizzi privati travestiti (IPv6 che incapsula IPv4, `0.0.0.0`, un nome pubblico che risolve in `10.x`): vanno rifiutati. Test nel Task 2 e nel Task 5.
3. Intestazioni scritte in modo imprevisto (nomi in maiuscolo, `max-age` non numerico o con virgolette, più cookie, CSP solo `Report-Only`): non devono produrre esiti errati. Test nel Task 3.
4. Reindirizzamenti anomali (ciclo, oltre 5 salti, da HTTPS a HTTP, `Location` non valido o relativo): nessun blocco e nessun esito inventato. Test nel Task 5.
5. Server lento o tempo esaurito a metà controllo: risposta entro 20 secondi, con i controlli mancanti "non verificati". Test nel Task 5.

---

### Task 1: Base del progetto e verifica del certificato

Scopre per prima cosa se la scadenza del certificato è leggibile, perché da questo dipende un controllo importante.

**Files:**
- Create: `package.json`, `vite.config.ts`, `vitest.config.ts`, `tsconfig*.json`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/test-setup.ts`, `.env.example`, `.github/workflows/deploy.yml`, `README.md`, `scripts/tls-spike.ts`
- Test: `src/App.test.tsx`

**Interfaces:**
- Produces: `npm test`, `npm run build` funzionanti; in `docs/superpowers/plans/spike-certificato.md` l'esito del controllo.

- [ ] **Step 1:** Crea il progetto con le stesse versioni di `../bere-app/package.json` (senza `@supabase/supabase-js`, che non serve: il frontend usa `fetch`). Base `/controllo-sito/`. `vitest.config.ts` include `src/**/*.test.{ts,tsx}`, `supabase/**/*.test.ts`. Workflow come quello di Bere con il solo segreto `VITE_SITE_CHECK_URL`.
- [ ] **Step 2:** Test `mostra il titolo Controllo Sito`: renderizza `App` e trova il titolo. Verifica che fallisca, poi scrivi `App` minimale e verifica che passi.
- [ ] **Step 3:** Scrivi `scripts/tls-spike.ts`: con `node:tls` si collega a `github.com:443` e stampa `getPeerCertificate().valid_to`, poi a `expired.badssl.com` e `wrong.host.badssl.com` con `fetch` e stampa il testo esatto dell'errore.
- [ ] **Step 4:** Esegui con `npx --yes deno@2 run --allow-net scripts/tls-spike.ts`. Registra in `spike-certificato.md`: se `valid_to` è una data reale, e i testi degli errori, che servono al Task 5. Avvertenza: Deno locale non è il runtime di Supabase, quindi l'esito definitivo arriva dalla prova del Task 9.
- [ ] **Step 5:** Se `valid_to` non è disponibile nemmeno in locale, scrivilo in cima al riepilogo finale per Roberto e prosegui con `certificate()` che restituisce `null`.
- [ ] **Step 6:** Commit `chore: scaffold project and record certificate spike`.

### Task 2: Indirizzo e indirizzi vietati

**Files:**
- Create: `supabase/functions/site-check/core/address.ts`
- Test: `supabase/functions/site-check/core/address.test.ts`

**Interfaces:**
- Produces: `normalizeAddress(input: string): { domain: string } | { error: 'empty' | 'invalid' | 'ip-address' | 'internal-name' }`, `isForbiddenIp(ip: string): boolean`

- [ ] **Step 1: Scrivi i test**

```ts
it.each([
  ['esempio.it', 'esempio.it'],
  ['  WWW.Esempio.IT ', 'www.esempio.it'],
  ['https://esempio.it/pagina?x=1', 'esempio.it'],
  ['esempio.it.', 'esempio.it'],
  ['http://esempio.it:443', 'esempio.it'],
  ['caffè.it', 'xn--caff-8oa.it'],
])('%s diventa %s', (input, domain) => expect(normalizeAddress(input)).toEqual({ domain }))

it.each([
  ['', 'empty'], ['   ', 'empty'], ['non un sito', 'invalid'], ['esempio', 'invalid'],
  ['192.168.1.1', 'ip-address'], ['[::1]', 'ip-address'], ['2130706433', 'ip-address'], ['0x7f.1', 'ip-address'],
  ['localhost', 'internal-name'], ['server.local', 'internal-name'], ['a.internal', 'internal-name'],
  ['https://esempio.it:8080', 'invalid'], ['ftp://esempio.it', 'invalid'], ['user:pw@esempio.it', 'invalid'],
])('rifiuta %j come %s', (input, error) => expect(normalizeAddress(input)).toEqual({ error }))

it.each(['127.0.0.1', '10.0.0.1', '172.16.0.1', '192.168.0.1', '169.254.169.254', '0.0.0.0', '100.64.0.1', '192.0.2.1', '198.18.0.1', '224.0.0.1', '255.255.255.255',
  '::1', '::', 'fc00::1', 'fe80::1', 'ff02::1', '::ffff:127.0.0.1', '::ffff:7f00:1', '64:ff9b::7f00:1', '2001:db8::1'])
  ('vieta %s', (ip) => expect(isForbiddenIp(ip)).toBe(true))

it.each(['8.8.8.8', '185.199.108.153', '2606:4700:4700::1111'])('permette %s', (ip) => expect(isForbiddenIp(ip)).toBe(false))

it('un valore che non è un indirizzo IP è vietato', () => expect(isForbiddenIp('boh')).toBe(true))
```

- [ ] **Step 2:** Verifica che falliscano.
- [ ] **Step 3:** Implementa con `new URL` (che converte in punycode). Porte ammesse: nessuna, 80 e 443. I nomi interni sono senza punto o con suffisso `.local`, `.internal`, `.localhost`, `.lan`, `.home`, `.intranet`. Per `isForbiddenIp` confronta con i blocchi riservati IANA, e applica le stesse regole agli IPv4 incapsulati in IPv6.
- [ ] **Step 4:** Verifica che passino. Commit `feat: validate addresses and refuse private networks`.

### Task 3: Intestazioni e cookie

**Files:**
- Create: `supabase/functions/site-check/core/types.ts`, `supabase/functions/site-check/core/headers.ts`
- Test: `supabase/functions/site-check/core/headers.test.ts`

**Interfaces:**
- Produces in `types.ts`:

```ts
export type CheckId = 'https' | 'certificate' | 'expiry' | 'redirect' | 'hsts' | 'csp' | 'framing' | 'content-type' | 'referrer' | 'cookies'
export type Urgency = 'critical' | 'important' | 'recommended'
export type UnverifiedReason = 'network' | 'rejected' | 'error-page' | 'fix-https-first' | 'unavailable' | 'timeout'
export interface Check { id: CheckId; outcome: 'passed' | 'problem' | 'unverified'; urgency?: Urgency; reason?: UnverifiedReason; observed?: string }
export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'
export interface Report {
  status: 'ok' | 'not-found' | 'rate-limited' | 'invalid-address' | 'error'
  domain?: string; startedFrom?: string; grade?: Grade | null; checks?: Check[]; httpStatus?: number; checkedAt?: string
  headers?: Record<string, string>; siteIssue?: 'rejected' | 'error-page' | 'network'
}
```

- `evaluateHeaders(headers: Headers, setCookies: string[]): Check[]`, con un risultato per `hsts`, `csp`, `framing`, `content-type`, `referrer`, `cookies`. `observed` contiene il valore letto. Urgenza `recommended` per tutti.

- [ ] **Step 1: Scrivi i test**, con questi casi e valori della spec:
  - `hsts`: `max-age=15552000` passa; `max-age=15551999` problema; `MAX-AGE=31536000; includeSubDomains` passa; `max-age="31536000"` passa; `max-age=abc` problema; assente problema.
  - `csp`: presente passa; solo `Content-Security-Policy-Report-Only` problema.
  - `framing`: `frame-ancestors 'self'` nella CSP passa; `X-Frame-Options: DENY` passa; entrambi assenti problema.
  - `content-type`: `nosniff` passa; `NoSniff` passa; altro valore problema.
  - `referrer`: `strict-origin` passa; `unsafe-url` problema; `no-referrer, unsafe-url` problema (conta l'ultimo valore valido, ma qualsiasi `unsafe-url` è problema); assente problema.
  - `cookies`: nessun cookie passa con `observed: 'nessun cookie impostato da questa pagina'`; `a=1; Secure; SameSite=Lax` passa; `a=1; Secure` problema; `a=1; SameSite=Lax` problema; un cookie buono e uno cattivo problema; `a=1; secure; samesite=none` passa; `HttpOnly` assente non cambia l'esito, ma compare in `observed`.
- [ ] **Step 2:** Verifica che falliscano. **Step 3:** Implementa. **Step 4:** Verifica che passino.
- [ ] **Step 5:** Commit `feat: evaluate security headers and cookies`.

### Task 4: Voto

**Files:**
- Create: `supabase/functions/site-check/core/grade.ts`
- Test: `supabase/functions/site-check/core/grade.test.ts`

**Interfaces:**
- Consumes: `Check`, `Grade` dal Task 3
- Produces: `gradeChecks(checks: Check[]): Grade | null`

- [ ] **Step 1: Scrivi i test**, con helper per costruire 10 controlli:
  - un critico → `F`, anche con 7 non verificati;
  - due importanti → `D`; un importante → `C`; tre consigliati → `B`; due consigliati → `A`; nessun problema → `A`;
  - `https` non verificato, senza critici → `null`;
  - 6 non verificati su 10 → `null`; 5 su 10 → un voto;
  - i non verificati non contano come problemi.
- [ ] **Step 2:** Verifica che falliscano. **Step 3:** Implementa nell'ordine fissato dalla spec: critico, poi assenza di voto, poi tabella. **Step 4:** Verifica che passino.
- [ ] **Step 5:** Commit `feat: compute the grade from check outcomes`.

### Task 5: Il controllo completo

**Files:**
- Create: `supabase/functions/site-check/core/probe.ts`
- Test: `supabase/functions/site-check/core/probe.test.ts`

**Interfaces:**
- Consumes: Task 2, 3, 4
- Produces:

```ts
export type RequestFailure = 'refused' | 'timeout' | 'cert-expired' | 'cert-name' | 'cert-issuer' | 'tls-other' | 'network' | 'not-found'
export interface ProbeResponse { status: number; headers: Headers; setCookies: string[] }
export class RequestError extends Error { constructor(public failure: RequestFailure) { super(failure) } }
export interface ProbeDeps {
  resolve(host: string): Promise<string[]>
  request(url: string, timeoutMs: number): Promise<ProbeResponse> // non segue i reindirizzamenti, lancia RequestError
  certificate(host: string, timeoutMs: number): Promise<{ notAfter: Date } | null>
  now(): Date
}
export async function probeSite(deps: ProbeDeps, domain: string): Promise<Report>
```

Valori: 8 secondi per tentativo, 20 secondi complessivi, 5 reindirizzamenti al massimo. Solo porte 80 e 443. `resolve` prima di ogni richiesta: se uno degli indirizzi è vietato, il sito è `not-found`, o se è un reindirizzamento il controllo è `unverified` con `network`.

- [ ] **Step 1: Scrivi i test** con finti `ProbeDeps`:
  - sito sano: 10 controlli, voto `A`, `domain` senza `startedFrom`;
  - `resolve` senza risultati → `status: 'not-found'`;
  - `refused` su 443 e 200 su `http://` → `https` critico, `F`, intestazioni `unverified` con `fix-https-first`;
  - `refused` su 443 e `http://` che non risponde → `https` non verificato, `grade: null`, `siteIssue: 'network'`;
  - `timeout` e `tls-other` su 443 → `https` non verificato, `grade: null`;
  - `cert-expired`, `cert-name`, `cert-issuer` → `certificate` critico, `F`, intestazioni con `fix-https-first`, senza altri tentativi su HTTPS;
  - scadenza a 31 giorni passa, a 30 importante, a 8 importante, a 7 critica, a 0 o passata critica; `certificate()` `null` → `expiry` non verificato con `unavailable`;
  - `http://` che porta a `https://` dello stesso sito passa, che resta su HTTP importante, che non risponde `unverified`;
  - 401, 403, 429, 503 e `cf-mitigated: challenge` → `siteIssue: 'rejected'`, intestazioni e cookie `unverified` con `rejected`, certificato valutato, voto secondo la regola;
  - 404, 500, 502 → `siteIssue: 'error-page'`, come sopra con `error-page`;
  - `www.esempio.it` verso `esempio.it` → niente `startedFrom`; `esempio.it` verso `altro.it` → `domain: 'altro.it'`, `startedFrom: 'esempio.it'`; il certificato letto è quello di `altro.it`;
  - **Review Focus:** ciclo di reindirizzamenti e 6 salti → `unverified`, senza blocco; da HTTPS a HTTP → il sito di arrivo è considerato senza HTTPS e non si leggono le sue intestazioni come valide; `Location` relativo risolto, non valido → `unverified`; reindirizzamento verso `10.0.0.1` → nessuna richiesta a quell'indirizzo; nome pubblico che risolve in `10.0.0.1` → nessuna richiesta; porta 8080 nel `Location` → rifiutata;
  - **Review Focus:** con un orologio finto, esaurendo i 20 secondi a metà, restituisce un `Report` con i controlli mancanti `timeout` e nessuna richiesta oltre il limite.
- [ ] **Step 2:** Verifica che falliscano. **Step 3:** Implementa `probeSite`. **Step 4:** Verifica che passino.
- [ ] **Step 5:** Commit `feat: run the full site check`.

### Task 6: La funzione e i limiti

**Files:**
- Create: `supabase/site_check.sql`, `supabase/functions/site-check/core/handler.ts`, `supabase/functions/site-check/index.ts`, `supabase/functions/site-check/deno.json`
- Test: `supabase/functions/site-check/core/handler.test.ts`, `supabase/tests/site-check-sql.test.ts`

**Interfaces:**
- Consumes: `normalizeAddress`, `probeSite`
- Produces: `POST /functions/v1/site-check` con corpo `{ address: string }` che risponde con `Report`; `handleCheck(request: Request, deps: HandlerDeps): Promise<Response>`; `hashIp(ip: string, salt: string): Promise<string>`

- [ ] **Step 1: Scrivi i test SQL** con PGlite, come in `../bere-app/supabase/tests/db.test.ts`. La funzione `public.controllo_sito_claim(p_ip_hash text, p_domain text) returns text` scrive in `controllo_sito.requests`:
  - l'11° controllo in un'ora dallo stesso IP → `limit-ip`; passata l'ora torna `ok`;
  - il 31° in un giorno per lo stesso dominio → `limit-domain`;
  - oltre 500 in un giorno complessivi → `limit-global`;
  - le righe più vecchie di 48 ore vengono cancellate;
  - `anon` e `authenticated` non possono chiamarla né leggere la tabella;
  - eseguire due volte il file SQL non dà errori.
- [ ] **Step 2: Scrivi i test di `handleCheck`** con finte dipendenze: indirizzo non valido → `invalid-address` senza richieste; limite raggiunto → `rate-limited` senza richieste; metodo diverso da `POST` → 405; `OPTIONS` → intestazioni CORS, con origine `https://roberto2ciancio.github.io` e `http://localhost:5173`; errore imprevisto → `status: 'error'`, senza stampare il dominio nel `console.error` (spiato); `hashIp` non restituisce l'IP e cambia con il sale.
- [ ] **Step 3:** Verifica che falliscano. **Step 4:** Implementa SQL e `handleCheck`. Se il controllo dei limiti fallisce, rifiuta il controllo: niente richieste senza limiti.
- [ ] **Step 5:** Scrivi `index.ts`: `resolve` con `Deno.resolveDns` per A e AAAA; `request` con `fetch` e `redirect: 'manual'`, intestazione `User-Agent: ControlloSito/1.0 (+https://roberto2ciancio.github.io/controllo-sito/)`, nessun cookie, corpo annullato senza leggerlo, errori tradotti con i testi trovati nel Task 1; `certificate` con `node:tls`, `null` se fallisce. IP da `cf-connecting-ip`, poi il primo di `x-forwarded-for`. Sale dal segreto `SITE_CHECK_SALT`. Se il rischio che un nome risolva diversamente tra controllo e connessione non si può chiudere, scrivi il rischio residuo nel README.
- [ ] **Step 6:** Verifica che i test passino e che `npx --yes deno@2 check supabase/functions/site-check/index.ts` non dia errori. Commit `feat: add the site check function with rate limits`.

### Task 7: Testi e guide

**Files:**
- Create: `src/content/checks.ts`
- Test: `src/content/checks.test.ts`

**Interfaces:**
- Produces: `CHECK_COPY: Record<CheckId, { title: string; passedTitle: string; consequence: string; docUrl: string; guides: Record<'altro' | 'wordpress' | 'wix', { steps: string[]; sourceUrl?: string }> }>`, `UNVERIFIED_COPY: Record<UnverifiedReason, string>`, `SITE_ISSUE_COPY`

- [ ] **Step 1: Scrivi i test:** ogni `CheckId` ha titolo, conseguenza, `docUrl` su `https://` e tre guide con almeno un passaggio; ogni guida WordPress e Wix ha `sourceUrl` su `https://`, oppure dice di contattare chi gestisce il sito o l'assistenza; ogni `UnverifiedReason` ha un testo; nei titoli e nelle conseguenze non compaiono `CSP`, `HSTS`, `TLS`, `header`.
- [ ] **Step 2:** Verifica che falliscano.
- [ ] **Step 3:** Scrivi i testi in italiano semplice. **Consulta la documentazione ufficiale di WordPress e Wix per ogni passaggio** e metti il link alla pagina letta. Non indicare menu che non hai verificato: su Wix molte intestazioni non si possono cambiare, e in quel caso la guida deve dirlo. `docUrl` punta a MDN. Se per un caso non trovi una fonte, usa l'indicazione generica prevista dalla spec.
- [ ] **Step 4:** Verifica che passino. Commit `feat: add plain language explanations and platform guides`.

### Task 8: Le schermate

Prima di scrivere il primo componente, usa la skill `impeccable` per definire un'identità propria: professionale, da mostrare su un CV, per chi deve risolvere un problema (modalità Operate). Salva le scelte in `DESIGN.md`.

**Files:**
- Create: `src/api.ts`, `src/App.tsx`, `src/components/AddressForm.tsx`, `src/components/ResultView.tsx`, `src/components/ProblemCard.tsx`, `src/components/TechnicalView.tsx`, `src/components/PrivacyPage.tsx`, `src/index.css`, `DESIGN.md`
- Test: `src/app.test.tsx`

**Interfaces:**
- Consumes: `Report`, `CHECK_COPY`, `UNVERIFIED_COPY`
- Produces: `checkSite(address: string): Promise<Report>` in `src/api.ts`; `fetch` a `VITE_SITE_CHECK_URL`; errore di rete → `{ status: 'error' }`

- [ ] **Step 1: Scrivi i test** con `fetch` finto:
  - il modulo invia l'indirizzo e blocca il pulsante durante il controllo, con un'indicazione di avanzamento annunciata agli screen reader;
  - voto `C` e un importante → "Voto C: 1 cosa da sistemare" (singolare) e con due "2 cose da sistemare";
  - i problemi compaiono in ordine: critici, importanti, consigliati;
  - **Spiegami semplice** è il predefinito; la scheda aperta è **Altro**; cambiando scheda compaiono i passaggi WordPress con il link alla fonte;
  - **Dettagli tecnici** mostra stato, valori osservati e `docUrl`;
  - ogni esito ha un testo, non solo un colore;
  - `grade: null` mostra "Non è stato possibile controllare il sito" con il motivo, e `siteIssue: 'rejected'` "Il sito ha rifiutato il controllo";
  - `startedFrom` mostra "partito da esempio.it";
  - `not-found`, `rate-limited`, `invalid-address`, `error` hanno ciascuno il loro messaggio e nessun voto;
  - la frase fissa e la data del controllo sono sempre presenti con un risultato; il pulsante ripete il controllo;
  - la pagina privacy dice: nessun account, nessun risultato salvato, impronta dell'IP e dominio cancellati dopo 48 ore.
- [ ] **Step 2:** Verifica che falliscano. **Step 3:** Implementa con la bozza C. **Step 4:** Verifica che passino e che `npm run build` riesca.
- [ ] **Step 5:** Avvia il sito con risposte simulate e guarda ogni stato a 390×844 e 1280×800, con il rilevatore di `impeccable`. Correggi ciò che non va.
- [ ] **Step 6:** Commit `feat: add the result screens`.

### Task 9: Revisione, poi pubblicazione con il permesso di Roberto

- [ ] **Step 1:** Revisione finale di tutto il branch, come richiesto dalla skill di esecuzione. Correggi Critical e Important con un test che prima fallisce.
- [ ] **Step 2: Fermati e chiedi a Roberto** l'ok per scrivere sul progetto di Bere e creare il repo pubblico. Elenca cosa verrà aggiunto: lo schema `controllo_sito`, la funzione `controllo_sito_claim`, la funzione `site-check`, il segreto `SITE_CHECK_SALT`. Se il controllo dei permessi blocca un comando, prepara uno script per Roberto.
- [ ] **Step 3:** Con l'ok: applica l'SQL con `npx supabase db query --linked --file supabase/site_check.sql`, imposta il segreto, pubblica con `npx supabase functions deploy site-check --no-verify-jwt --use-api --project-ref ecrknwwinnkwdwngkois`. Verifica che `npx supabase migration list --linked` in `../bere-app` sia invariata e che il job dei promemoria risponda ancora 200.
- [ ] **Step 4:** Chiama la funzione su `roberto2ciancio.github.io`, `roberto2ciancio.github.io/bere-app/`, un dominio inesistente, `expired.badssl.com`, `wrong.host.badssl.com`, e sui domini di prova vietati. Confronta ogni esito a mano con `curl -sI`. **Verifica qui se la scadenza del certificato funziona davvero:** se no, avvisa Roberto. Ogni differenza è un difetto: test che fallisce, correzione, nuova pubblicazione.
- [ ] **Step 5:** Crea il repo pubblico `Roberto2ciancio/controllo-sito`, imposta `VITE_SITE_CHECK_URL`, attiva Pages e pubblica. Prima controlla che nel repo non ci siano dati personali o segreti. Lo script di installabilità non serve: non è una PWA.
- [ ] **Step 6:** Apri il sito pubblicato in un browser vero e ripeti un controllo. Roberto prova sul suo telefono e dice se capisce il risultato senza spiegazioni.

### Task 10: La scheda nel sito personale

**Files:**
- Modify: `../roberto-site/src/data/cv.ts`, `../roberto-site/src/components/Creations.tsx`, `../roberto-site/src/App.css`

**Interfaces:**
- Consumes: l'indirizzo pubblico del Task 9

- [ ] **Step 1:** Rendi facoltativi `demoUrl` e `install` nei dati di `creations`, così che una creazione possa avere un solo pulsante, e aggiungi la scheda di Controllo Sito con il pulsante "Apri lo strumento".
- [ ] **Step 2:** Verifica con `npm run build`, `npm run lint` e guardandola a misura di computer e telefono. La scheda di Bere non deve cambiare.
- [ ] **Step 3:** Con la conferma di Roberto, commit e push su `main`. Verifica il sito pubblicato.
