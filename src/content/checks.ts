import type { CheckId, UnverifiedReason } from '../../supabase/functions/site-check/core/types.ts'

interface PlatformGuide {
  steps: string[]
  sourceUrl?: string
}

interface CheckCopy {
  title: string
  passedTitle: string
  consequence: string
  docUrl: string
  guides: Record<'altro' | 'wordpress' | 'wix', PlatformGuide>
}

const CONTACT_HOST = {
  steps: ["Scrivi all'assistenza di chi ospita il sito e chiedi di attivare questa protezione: di solito basta una richiesta, senza bisogno di modificare nulla da soli."],
}

const WIX_HEADERS_UNAVAILABLE: PlatformGuide = {
  steps: [
    'Su Wix non è oggi possibile aggiungere o personalizzare questa protezione, nemmeno da codice personalizzato: lo dice espressamente il centro assistenza Wix.',
    "Se ti serve comunque, puoi contattare l'assistenza Wix e chiedere della soluzione Wix Studio enterprise, l'unica che la prevede.",
  ],
  sourceUrl: 'https://support.wix.com/en/article/request-adding-and-customizing-security-headers',
}

const WIX_TLS_MANAGED: PlatformGuide = {
  steps: [
    'Wix fornisce e rinnova da solo il certificato di sicurezza per ogni sito, gratuitamente: di norma non serve fare nulla.',
    'Se il problema resta, controlla in Impostazioni > Domini che il dominio sia collegato correttamente, oppure scrivi al supporto Wix.',
  ],
  sourceUrl: 'https://www.wix.com/domains/security/free-ssl-certificate',
}

export const CHECK_COPY: Record<CheckId, CheckCopy> = {
  https: {
    title: 'Connessione sicura assente',
    passedTitle: 'Il sito usa una connessione sicura',
    consequence: 'Chi visita il sito non ha garanzie che i dati scambiati restino privati: password, moduli e altre informazioni potrebbero essere letti da terzi lungo il percorso.',
    docUrl: 'https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/TLS',
    guides: {
      altro: { steps: ["Attiva un certificato di sicurezza per il dominio: molti hosting lo offrono gratis con pochi clic (spesso chiamato \"Let's Encrypt\" o \"SSL gratuito\").", CONTACT_HOST.steps[0]] },
      wordpress: {
        steps: [
          "Molti hosting WordPress offrono un certificato gratuito attivabile dal pannello di controllo: cerca una voce \"SSL\" o \"Let's Encrypt\".",
          'In alternativa installa un plugin come Really Simple SSL, che rileva il certificato e configura WordPress per usarlo automaticamente.',
        ],
        sourceUrl: 'https://www.wpbeginner.com/beginners-guide/how-to-add-http-security-headers-in-wordpress/',
      },
      wix: WIX_TLS_MANAGED,
    },
  },

  certificate: {
    title: 'Certificato non valido',
    passedTitle: 'Il certificato del sito è valido',
    consequence: 'I browser mostrano un avviso di sito non sicuro prima ancora di far vedere la pagina, e molte persone la abbandonano subito.',
    docUrl: 'https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/TLS',
    guides: {
      altro: { steps: ['Rinnova o correggi il certificato di sicurezza dal pannello del tuo hosting.', CONTACT_HOST.steps[0]] },
      wordpress: {
        steps: ["Se usi un plugin come Really Simple SSL, aprine le impostazioni e segui l'avviso sul certificato.", "Se il certificato è fornito dall'hosting, contatta la loro assistenza: di solito lo sistemano loro in pochi minuti."],
        sourceUrl: 'https://www.wpbeginner.com/beginners-guide/how-to-add-http-security-headers-in-wordpress/',
      },
      wix: WIX_TLS_MANAGED,
    },
  },

  expiry: {
    title: 'Certificato in scadenza',
    passedTitle: 'Il certificato non scade a breve',
    consequence: "Quando il certificato scade, il sito smette di essere raggiungibile in modo sicuro, come se non avesse più questa protezione.",
    docUrl: 'https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/TLS',
    guides: {
      altro: { steps: ['Rinnova il certificato dal pannello del tuo hosting prima della scadenza.', CONTACT_HOST.steps[0]] },
      wordpress: {
        steps: ['Se il rinnovo è automatico (come con Really Simple SSL o la maggior parte degli hosting) di norma non serve fare nulla: verifica comunque la data nel pannello.', "Se il rinnovo non è automatico, segna la scadenza e rinnovalo per tempo dal pannello dell'hosting."],
        sourceUrl: 'https://www.wpbeginner.com/beginners-guide/how-to-add-http-security-headers-in-wordpress/',
      },
      wix: WIX_TLS_MANAGED,
    },
  },

  redirect: {
    title: 'Il sito non porta automaticamente alla versione sicura',
    passedTitle: 'Il sito porta automaticamente alla versione sicura',
    consequence: "Chi digita l'indirizzo senza scrivere \"https\" resta sulla versione non protetta del sito, anche se la versione sicura esiste.",
    docUrl: 'https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/TLS',
    guides: {
      altro: { steps: ['Imposta una regola di reindirizzamento permanente dalla versione non sicura a quella sicura: di solito è un\'opzione nel pannello del tuo hosting o del tuo sito.', CONTACT_HOST.steps[0]] },
      wordpress: {
        steps: [
          "Se usi Really Simple SSL, attiva l'opzione che forza il reindirizzamento a https nelle sue impostazioni.",
          'In alternativa, in Impostazioni > Generali imposta sia "Indirizzo WordPress" sia "Indirizzo del sito" con https:// davanti.',
        ],
        sourceUrl: 'https://www.wpbeginner.com/beginners-guide/how-to-add-http-security-headers-in-wordpress/',
      },
      wix: {
        steps: ['Wix reindirizza automaticamente alla versione sicura quando il dominio è collegato correttamente: di norma non serve fare nulla.', 'Se non succede, controlla il collegamento del dominio in Impostazioni > Domini o scrivi al supporto Wix.'],
        sourceUrl: 'https://www.wix.com/domains/security/free-ssl-certificate',
      },
    },
  },

  hsts: {
    title: 'Il sito non impone sempre la connessione sicura',
    passedTitle: 'Il sito impone sempre la connessione sicura',
    consequence: 'Se per errore qualcuno raggiunge la versione non sicura del sito, il browser non lo blocca automaticamente: resta un piccolo margine per un attacco che intercetta la connessione.',
    docUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Strict-Transport-Security',
    guides: {
      altro: { steps: ['Chiedi a chi gestisce il server di aggiungere questa protezione alla configurazione del sito.', CONTACT_HOST.steps[0]] },
      wordpress: {
        steps: [
          'Apri il file .htaccess del sito (da un plugin per file manager o via FTP) e aggiungi, dentro un blocco <IfModule mod_headers.c>, la riga: Header set Strict-Transport-Security "max-age=31536000" env=HTTPS',
          "In alternativa cerca un plugin che permetta di aggiungere intestazioni di sicurezza personalizzate.",
        ],
        sourceUrl: 'https://www.wpbeginner.com/beginners-guide/how-to-add-http-security-headers-in-wordpress/',
      },
      wix: WIX_HEADERS_UNAVAILABLE,
    },
  },

  csp: {
    title: 'Manca una lista dei contenuti ammessi sulla pagina',
    passedTitle: 'La pagina limita i contenuti che può caricare',
    consequence: "Se qualcuno riuscisse a inserire codice estraneo nella pagina, il browser non avrebbe un modo automatico per riconoscerlo e bloccarlo.",
    docUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP',
    guides: {
      altro: { steps: ['Questa protezione va definita con attenzione, elencando solo le fonti che il sito usa davvero: chiedi a chi ha sviluppato il sito di configurarla.', CONTACT_HOST.steps[0]] },
      wordpress: {
        steps: [
          'Aggiungi al file .htaccess, nello stesso blocco usato per le altre intestazioni, una riga Content-Security-Policy con solo le fonti che il sito usa davvero (immagini, font, script): un elenco sbagliato può rompere il sito, quindi va provato con calma.',
          "Se non ti senti sicuro a farlo da solo, chiedi a chi ha sviluppato il sito o a un plugin di sicurezza dedicato.",
        ],
        sourceUrl: 'https://www.wpbeginner.com/beginners-guide/how-to-add-http-security-headers-in-wordpress/',
      },
      wix: WIX_HEADERS_UNAVAILABLE,
    },
  },

  framing: {
    title: 'Il sito può essere incorporato in altre pagine',
    passedTitle: 'Il sito non può essere incorporato in altre pagine senza permesso',
    consequence: 'Un sito estraneo potrebbe mostrare il tuo sito dentro una propria pagina camuffata, per ingannare chi clicca (una tecnica chiamata clickjacking).',
    docUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Frame-Options',
    guides: {
      altro: { steps: ['Chiedi a chi gestisce il server di impedire che il sito venga incorporato in pagine di altri siti.', CONTACT_HOST.steps[0]] },
      wordpress: {
        steps: ['Aggiungi al file .htaccess, nello stesso blocco usato per le altre intestazioni, la riga: Header set X-Frame-Options DENY'],
        sourceUrl: 'https://www.wpbeginner.com/beginners-guide/how-to-add-http-security-headers-in-wordpress/',
      },
      wix: WIX_HEADERS_UNAVAILABLE,
    },
  },

  'content-type': {
    title: 'Il browser può reinterpretare i file del sito',
    passedTitle: 'Il browser rispetta il tipo dichiarato dei file',
    consequence: 'In alcuni casi un file caricato sul sito potrebbe essere eseguito dal browser come codice invece che mostrato come semplice immagine o documento.',
    docUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Content-Type-Options',
    guides: {
      altro: { steps: ['Chiedi a chi gestisce il server di attivare questa protezione sui file del sito.', CONTACT_HOST.steps[0]] },
      wordpress: {
        steps: ['Aggiungi al file .htaccess, nello stesso blocco usato per le altre intestazioni, la riga: Header set X-Content-Type-Options nosniff'],
        sourceUrl: 'https://www.wpbeginner.com/beginners-guide/how-to-add-http-security-headers-in-wordpress/',
      },
      wix: WIX_HEADERS_UNAVAILABLE,
    },
  },

  referrer: {
    title: "Il sito condivide sempre l'indirizzo di provenienza",
    passedTitle: 'Il sito limita le informazioni condivise quando si clicca un link',
    consequence: "Quando qualcuno clicca un link che porta fuori dal tuo sito, il sito di destinazione può vedere l'indirizzo esatto della pagina di provenienza, anche quando contiene informazioni che dovrebbero restare private.",
    docUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Headers/Referrer-Policy',
    guides: {
      altro: { steps: ['Chiedi a chi gestisce il server di impostare una politica più prudente su quali informazioni condividere quando si esce dal sito.', CONTACT_HOST.steps[0]] },
      wordpress: {
        steps: ['Aggiungi al file .htaccess, nello stesso blocco usato per le altre intestazioni, la riga: Header set Referrer-Policy: no-referrer-when-downgrade (o un valore più prudente come strict-origin-when-cross-origin).'],
        sourceUrl: 'https://www.wpbeginner.com/beginners-guide/how-to-add-http-security-headers-in-wordpress/',
      },
      wix: WIX_HEADERS_UNAVAILABLE,
    },
  },

  cookies: {
    title: 'Alcuni cookie non sono protetti',
    passedTitle: 'I cookie del sito sono protetti',
    consequence: 'Un cookie senza queste protezioni può essere intercettato più facilmente, o inviato per errore ad altri siti, mettendo a rischio chi ha effettuato l\'accesso.',
    docUrl: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie',
    guides: {
      altro: { steps: ["I cookie sono di solito impostati dal software del sito o dai suoi plugin: chiedi a chi lo gestisce o lo ha sviluppato di correggere gli attributi del cookie indicato nei dettagli tecnici.", CONTACT_HOST.steps[0]] },
      wordpress: {
        steps: ["Se il cookie è impostato da un plugin (per esempio di carrello, statistiche o accessi), aggiorna il plugin all'ultima versione o scrivi a chi lo sviluppa segnalando il nome esatto del cookie.", "Se il sito gira su https in modo stabile, verifica anche le impostazioni di sicurezza dei cookie nel pannello del tuo hosting."],
        sourceUrl: 'https://www.wpbeginner.com/beginners-guide/how-to-add-http-security-headers-in-wordpress/',
      },
      wix: { steps: ["I cookie di un sito Wix sono gestiti dalla piattaforma stessa: se noti un cookie non protetto, segnalalo all'assistenza Wix indicando il nome esatto del cookie."] },
    },
  },
}

export const UNVERIFIED_COPY: Record<UnverifiedReason, string> = {
  network: 'Il sito non ha risposto durante il controllo: potrebbe essere momentaneamente irraggiungibile, oppure la rete ha bloccato la richiesta.',
  rejected: "Il sito ha rifiutato questo controllo, probabilmente per una protezione automatica anti-robot.",
  'error-page': 'La pagina principale ha risposto con un errore, quindi questo aspetto non si può giudicare.',
  'fix-https-first': "Prima va risolto il problema sulla connessione sicura: finché non è a posto, questo controllo non si può fare.",
  unavailable: 'Non è stato possibile leggere questa informazione durante il controllo.',
  timeout: 'Il controllo si è fermato perché ha richiesto troppo tempo.',
}

export const SITE_ISSUE_COPY: Record<'rejected' | 'error-page' | 'network', string> = {
  rejected: 'Il sito ha rifiutato il controllo automatico, probabilmente per una protezione anti-robot.',
  'error-page': 'La pagina principale del sito ha risposto con un errore.',
  network: 'Non è stato possibile raggiungere il sito entro il tempo previsto.',
}
