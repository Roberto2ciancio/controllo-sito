# Controllo Sito: documento di progetto

## Perché esiste

Strumento gratuito e senza account: scrivi l'indirizzo di un sito, ottieni un voto, le cose da sistemare in ordine di urgenza e i passaggi per risolverle.

Roberto Ciancio è uno sviluppatore junior orientato alla cybersecurity. Il suo CV online dichiara questo obiettivo, ma non ha ancora un progetto che lo mostri. Lo strumento si raggiunge dalla sezione Creazioni di `roberto2ciancio.github.io`. Chi lo prova dal CV deve pensare, con le parole di Roberto, che è **utile**.

## Per chi

- **Chi ha un sito e non è tecnico:** deve capire cosa non va e come risolverlo, passo per passo.
- **Chi è tecnico:** vuole verificare che sia tutto a posto, con valori precisi.

Il successo è uno: chi legge il risultato sa cosa fare dopo.

## Obiettivi

1. Dire in pochi secondi cosa va sistemato, in ordine di urgenza.
2. Spiegare ogni problema con parole semplici e passaggi concreti, adattati alla piattaforma.
3. Dare a chi è tecnico i dati esatti su cui si basa ogni esito.
4. Funzionare bene sul telefono, in italiano.

## Non obiettivi

- Attacchi, scansioni di porte o di vulnerabilità, tentativi di accesso, ricerca di file nascosti.
- Account, cronologia, risultati salvati, confronto tra controlli, link condivisibili.
- Analisi del contenuto delle pagine o del codice del sito.
- Controlli programmati, avvisi via email, API pubblica.
- Più lingue oltre all'italiano.

## Anti-obiettivi

Per Roberto lo strumento fallisce, anche se tecnicamente funziona, se:

- **i risultati sono sbagliati.** Un falso allarme o una falsa rassicurazione valgono più di dieci funzioni in più;
- **i risultati non si capiscono**;
- può essere usato per fare danni a siti altrui o per sondare reti private;
- i passaggi sono inventati: una guida non verificata è peggio di nessuna guida.

## Cosa fa

### Il percorso

1. L'utente scrive un indirizzo. Accetta `esempio.it`, `www.esempio.it` e `https://esempio.it/pagina`: conta solo il dominio, e si controlla la pagina principale.
2. Attende, con un'indicazione di avanzamento. Il controllo si interrompe dopo al massimo 20 secondi complessivi.
3. Vede il risultato.

### La schermata del risultato (bozza C scelta da Roberto)

- In alto: dominio, voto e numero di cose da sistemare, per esempio "Voto C: 2 cose da sistemare".
- Un interruttore tra **Spiegami semplice** (predefinito) e **Dettagli tecnici**.
- **Spiegami semplice:** i problemi in ordine di urgenza. Ognuno ha: etichetta di urgenza, titolo senza gergo, conseguenza concreta per il sito, schede **WordPress / Wix / Altro** con i passaggi. Sotto, l'elenco compresso dei controlli superati e non verificati.
- **Dettagli tecnici:** per ogni controllo, esito e valore osservato (per esempio il testo dell'intestazione o la data di scadenza), con il riferimento alla documentazione.
- Sempre visibile, in fondo: data e ora del controllo e la frase "Questo controllo legge solo ciò che il sito mostra a qualsiasi visitatore. Un voto alto non garantisce che il sito sia sicuro."
- Un pulsante per ripetere il controllo.

La bozza è in `.superpowers/brainstorm/` della sessione di progettazione; se non è disponibile, questa descrizione fa fede.

### I controlli

Ogni controllo produce uno di questi esiti: **superato**, **da sistemare** con urgenza, **non verificato** con il motivo. Le soglie sono decise qui, così i risultati restano spiegabili.

| Controllo | Superato | Da sistemare | Urgenza |
|---|---|---|---|
| HTTPS disponibile | La pagina risponde su `https://` | Non risponde su `https://` ma risponde su `http://` | Critica |
| Certificato valido | La connessione HTTPS si stabilisce con verifica attiva | Errore di certificato (scaduto, nome errato, emittente non attendibile) | Critica |
| Scadenza del certificato | Oltre 30 giorni | Tra 8 e 30 giorni: importante. 7 giorni o meno: critica | Vedi a sinistra |
| Da HTTP a HTTPS | `http://` reindirizza a `https://` dello stesso sito | Resta su `http://` | Importante |
| HSTS | `Strict-Transport-Security` con `max-age` di almeno 180 giorni | Assente o inferiore | Consigliata |
| Protezione dai contenuti pericolosi | `Content-Security-Policy` presente | Assente | Consigliata |
| Protezione dall'inserimento in altri siti | `frame-ancestors` nella CSP oppure `X-Frame-Options` | Entrambi assenti | Consigliata |
| Tipi di file | `X-Content-Type-Options: nosniff` | Assente | Consigliata |
| Referrer | `Referrer-Policy` presente, senza `unsafe-url` | Assente o `unsafe-url` | Consigliata |
| Cookie | Tutti i cookie impostati dalla pagina hanno `Secure`, e `SameSite` è presente | Uno o più cookie senza questi attributi | Consigliata |

- Se la pagina non imposta cookie, il controllo Cookie è superato con la nota "nessun cookie impostato da questa pagina".
- `HttpOnly` non si valuta: alcuni cookie devono essere leggibili dagli script, e dall'esterno non si può sapere quali. Il valore compare solo nei dettagli tecnici.

### Cosa si controlla dopo un reindirizzamento

- Si valuta **il sito di arrivo**: certificato, HSTS, intestazioni e cookie vengono dalla risposta finale. Il controllo "Da HTTP a HTTPS" riguarda invece il dominio scritto dall'utente.
- Se il dominio di arrivo è diverso da quello scritto, ignorando solo `www.`, il titolo mostra il dominio di arrivo e aggiunge "partito da esempio.it". Non serve stabilire se i due domini appartengano alla stessa persona.
- I limiti giornalieri contano il dominio scritto dall'utente.

### Come distinguere un sito senza HTTPS da un errore di rete

Ogni tentativo ha al massimo 8 secondi, senza nuovi tentativi, entro i 20 secondi complessivi.

| Cosa succede | Esito |
|---|---|
| La porta 443 rifiuta la connessione e `http://` risponde con 2xx o 3xx | HTTPS assente: critico |
| Errore di certificato riconosciuto: scaduto, nome errato, emittente non attendibile | Certificato non valido: critico |
| Tempo scaduto, errore di handshake non legato al certificato o altro errore di rete | HTTPS **non verificato**, con il motivo |

### Il voto

Deriva solo dagli esiti, con questa regola:

| Voto | Condizione |
|---|---|
| F | Almeno un problema critico |
| D | Due o più problemi importanti |
| C | Un problema importante |
| B | Solo consigliati, tre o più |
| A | Nessuno o al massimo due consigliati |

I controlli non verificati non contano. Le regole si applicano in quest'ordine:

1. **Un problema critico accertato dà sempre F**, anche se gli altri controlli non si possono fare. Un sito con certificato scaduto non deve mai ricevere "non è stato possibile controllare": sarebbe una falsa rassicurazione.
2. Senza problemi critici, se HTTPS è non verificato oppure se i non verificati sono più di metà dei controlli, **non si dà un voto**: la schermata dice "Non è stato possibile controllare il sito" con il motivo e un invito a riprovare.
3. Negli altri casi il voto segue la tabella.

Con HTTPS assente o certificato non valido, le intestazioni e i cookie risultano non verificati, con il motivo "prima va sistemato HTTPS". Le intestazioni non si leggono disattivando la verifica del certificato.

### Esiti che non sono problemi del sito

Non vanno mai mostrati come difetti:

- dominio inesistente, sito spento o che non risponde entro il limite;
- risposta 401, 403, 429 o 503, oppure un segnale anti-bot nelle intestazioni, come `cf-mitigated: challenge`: "Il sito ha rifiutato il controllo";
- risposta 404 o altri errori 4xx e 5xx: "La pagina principale ha risposto con un errore". Le pagine di errore hanno spesso intestazioni diverse dal sito vero, quindi intestazioni e cookie risultano non verificati;
- errori dello strumento stesso o limite di richieste raggiunto.

Anche in questi casi certificato e HTTPS si valutano normalmente, se la connessione è riuscita.

**Limite dichiarato:** una pagina anti-bot che risponde 200 senza segnali nelle intestazioni viene valutata come se fosse il sito, perché il contenuto delle pagine non si analizza. Per questo i dettagli tecnici mostrano sempre lo stato e le intestazioni ricevute.

### Guide per piattaforma

Ogni problema ha passaggi per **WordPress**, **Wix** e **Altro**.

- Si parte da **Altro**: è la scheda aperta di default. Il rilevamento automatico della piattaforma non è previsto.
- Ogni guida specifica va scritta consultando la documentazione ufficiale della piattaforma, e il link alla fonte compare sotto i passaggi.
- Se su una piattaforma l'utente non può intervenire, la guida lo dice e indica cosa chiedere all'assistenza. Non si inventano menu o procedure.
- Se per un caso non si trova una fonte affidabile, la scheda dà solo l'indicazione generica di contattare chi gestisce il sito.

### Sicurezza dello strumento

Il server fa richieste verso indirizzi scelti da chiunque: è il rischio principale del progetto.

- Solo domini pubblici, solo porte 80 e 443. Rifiuta indirizzi IP scritti direttamente, `localhost` e nomi interni.
- Prima di ogni richiesta, compresi i reindirizzamenti, risolve il nome e rifiuta gli indirizzi privati, locali e riservati, IPv4 e IPv6.
- Solo richieste `GET` e `HEAD`, senza inviare cookie o credenziali. Massimo 5 reindirizzamenti, seguiti manualmente con lo stesso controllo.
- Non legge più di 256 KB di risposta e usa un User-Agent che dichiara cos'è, con un link alla pagina dello strumento.
- Limiti: 10 controlli all'ora per richiedente, 30 controlli al giorno per dominio, un massimo complessivo al giorno entro i limiti del piano gratuito. Superato il limite, un messaggio chiaro.

### Dati e privacy

- Nessun account e nessun risultato salvato.
- Per i limiti si conserva solo un'impronta non reversibile dell'indirizzo IP, con un valore segreto, e il dominio controllato. Si cancellano dopo 48 ore.
- Gli indirizzi controllati non vanno nei registri applicativi.
- Una breve pagina spiega tutto questo in italiano.

## Vincoli

- Costo zero: GitHub Pages e il piano gratuito di Supabase.
- Il piano gratuito ammette due progetti attivi e Roberto li ha già occupati. Si usa quindi **il progetto Supabase di Bere**, aggiungendo una funzione e uno schema separato `controllo_sito`, senza toccare quelli di Bere.
- Il codice della funzione e l'SQL stanno nel repo `controllo-sito`, perché è un progetto di sicurezza che deve mostrare anche il proprio server. L'SQL non passa dalla cronologia delle migrazioni: è un file ripetibile applicato con `supabase db query --linked --file`, così le migrazioni di Bere restano coerenti.
- **Nulla viene pubblicato sul progetto di Bere senza un ok esplicito di Roberto.** Il piano si ferma lì: prima solo sviluppo locale e test simulati, poi la richiesta di conferma, poi le prove sui siti reali.
- Repo pubblico: nessun segreto e nessun dato personale. I commit usano `Roberto2ciancio@users.noreply.github.com`.
- Interfaccia in italiano, utilizzabile sul telefono, con tastiera e con screen reader. Nessun esito comunicato solo con il colore.

## Scelte di Roberto

- Scopo e pubblico descritti sopra.
- Schermata del risultato: la bozza C.
- Solo controlli passivi.
- Approvazione della descrizione riassunta in chat, con le aggiunte indicate come scelte del progettista.

## Scelte del progettista, che Roberto può cambiare

- Nome provvisorio: **Controllo Sito**.
- Tecnologie: React, TypeScript e Vite su GitHub Pages in `roberto2ciancio.github.io/controllo-sito/`, con una Edge Function di Supabase. Sono le stesse di Bere.
- Piattaforme delle guide: WordPress, Wix, Altro.
- Controlli, soglie, voto e limiti numerici di questo documento.
- Nessuna analisi delle pagine e nessun rilevamento della piattaforma nella prima versione.

## Lasciato a chi costruisce

- **Da verificare per primo:** ottenere la data di scadenza del certificato da una Edge Function. Le API di Deno potrebbero non esporre il certificato. Provare `node:tls` e `getPeerCertificate`, e controllarlo davvero sulla piattaforma prima di costruirci sopra. Se non funziona, il controllo Scadenza risulta **non verificato**, senza mai inventare un valore. Roberto va avvisato, perché lo strumento perderebbe una delle spiegazioni più utili.
- **Log pubblici dei certificati:** non si usano. Dicono quali certificati sono stati emessi, non quale il sito sta usando, quindi potrebbero dare un falso allarme. Inoltre invierebbero a terzi il dominio controllato.
- **Da verificare:** se la Edge Function può impedire che un nome venga risolto in modo diverso tra il controllo e la connessione. Se non si può chiudere del tutto, documentare il rischio residuo.
- Aspetto dell'interfaccia: un'identità propria, da definire con `impeccable` prima di scrivere le schermate. Deve risultare professionale perché sta su un CV, e il sito di Roberto usa viola su fondo scuro, senza obbligo di somiglianza.
- Struttura del codice, messaggi esatti, testi delle guide nei limiti sopra.

## Come sapremo che funziona

- Ogni controllo e il voto hanno test automatici con risposte simulate, compresi i casi "non verificato" e "il sito ha rifiutato il controllo".
- Test automatici per ogni indirizzo vietato, compreso un reindirizzamento da un sito pubblico verso un indirizzo privato.
- Prova reale sui siti di Roberto (`roberto2ciancio.github.io` e l'app Bere): gli esiti vanno confrontati a mano con le intestazioni effettive, ad esempio con `curl`.
- Un nome di dominio inesistente e un certificato scaduto (`expired.badssl.com`) e con nome errato (`wrong.host.badssl.com`) danno l'esito atteso.
- Roberto capisce il risultato senza spiegazioni, sul suo telefono.

## Pubblicazione

Una scheda nella sezione Creazioni di `roberto2ciancio.github.io`, con un solo pulsante per aprire lo strumento. La pubblicazione va confermata da Roberto.
