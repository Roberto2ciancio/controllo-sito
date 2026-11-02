# Identità visiva — Controllo Sito

> Nota: il piano indica di usare la skill `impeccable` per definire l'identità visiva. Quella skill non è disponibile in questo ambiente (nessun plugin la fornisce). Le scelte sotto sono state fatte applicando lo stesso obiettivo — "Operate", professionale, da mostrare su un CV — senza quel tool specifico. Da segnalare a Roberto come sostituzione, non come scelta sua.

## Modalità: Operate

Chi usa questo strumento ha un problema concreto da risolvere (capire se il proprio sito ha un problema di sicurezza) ed è probabilmente sotto una leggera pressione. L'interfaccia deve essere immediatamente leggibile, senza fronzoli, e deve guidare verso l'azione (capire il problema → sapere come risolverlo).

## Principi

- **Testo prima del colore.** Ogni esito (Ok / Da sistemare / Non verificato) è sempre scritto per intero. Il colore (bordo sinistro delle card, colore del testo nella tabella tecnica) è un rinforzo, non il canale primario — vale per chi non distingue bene i colori e per chi usa uno screen reader.
- **Due livelli di lettura.** "Spiegami semplice" per chi non è tecnico (il caso comune), "Dettagli tecnici" per chi vuole la prova grezza (intestazioni, valori osservati, fonte).
- **Gerarchia d'urgenza visibile.** I problemi critici, importanti e consigliati sono sempre mostrati in quest'ordine ed è il primo segnale, prima ancora del colore.
- **Niente decorazione gratuita.** Nessuna illustrazione, nessuna icona personalizzata: superfici bianche, un solo colore d'accento, bordi sottili. Coerente con un progetto da mostrare come esempio di lavoro professionale, non come prodotto consumer.

## Palette

| Token | Valore | Uso |
|---|---|---|
| `--bg` | `#f6f7f9` | sfondo pagina |
| `--surface` | `#ffffff` | card, form, tabella |
| `--text` | `#1a1d23` | testo principale |
| `--muted` | `#5b6270` | testo secondario, stato "non verificato" |
| `--accent` | `#1d4ed8` | pulsanti, link, scheda attiva |
| `--critical` | `#b3261e` | bordo/testo problemi critici |
| `--important` | `#9a5b00` | bordo/testo problemi importanti |
| `--recommended` | `#3a5a8c` | bordo/testo problemi consigliati |
| `--ok` | `#1d7a46` | testo "Ok" nella tabella tecnica |

Tutte le combinazioni testo/sfondo rispettano un contrasto minimo 4.5:1 (testo normale) su `--bg` e `--surface`.

## Tipografia

Font di sistema (`system-ui`), nessun caricamento di font esterni: meno peso, meno rischio di flash di testo invisibile, e coerente con l'idea di uno strumento "da developer" piuttosto che "da marketing".

## Layout

Colonna singola, larghezza massima ~48rem, centrata. Stesso layout da mobile a desktop: non ci sono informazioni che vale la pena mostrare affiancate, quindi niente breakpoint complessi — solo il form che passa da riga a colonna sotto 480px.

## Componenti

- **AddressForm**: un solo campo, un solo pulsante. Durante il controllo il pulsante si disabilita e un'etichetta testuale invisibile (`role="status"`) annuncia "Controllo in corso" agli screen reader.
- **ProblemCard**: una card per problema, con un bordo sinistro colorato per urgenza, il titolo, il perché conta, e tre scheda per piattaforma (Altro predefinita, WordPress, Wix) con i passaggi e — quando esiste — il link alla fonte verificata.
- **TechnicalView**: una tabella (controllo / stato / valore osservato / documentazione) per chi vuole la prova invece della spiegazione.
- **PrivacyPage**: testo semplice, nessuna tabella, nessuna illustrazione — è una pagina di fiducia, deve leggersi come una dichiarazione chiara.

## Verificato a:

- 390×844 (telefono)
- 1280×800 (desktop)

con ogni stato: voto A (nessun problema), voto con problemi di più urgenze, voto non calcolabile, e i quattro stati di errore (indirizzo non valido, non trovato, troppi controlli, errore).
