# Sub-Prozessoren und Drittlandübermittlung

_Stand: 2026-09-01 · Bezug: Audit ARCTOS-FULL-2026-08-31 (S07-18), Cross-Ref S05-01/-03/-22_

> **Abgrenzung.** Technische Bestandsaufnahme, keine Rechtsberatung. Die
> Bewertung eines Transfers nach Art. 44 ff. DSGVO und die Auswahl der
> Garantien (Angemessenheitsbeschluss, SCC, TIA) obliegen der
> verantwortlichen Stelle.

## Warum dieses Dokument existiert

`gdpr-readiness-checklist.md` führte bis 2026-09-01 unter „ARCTOS als
Verarbeiter":

> „Rechenzentrum in DE (Hetzner) -> keine Drittlandsuebermittlung
> Sub-Processor: Resend (Email, EU/DE), Backblaze B2 (EU-Region, geplant)"

Die Aussage war unvollständig. Der AI-Router unterstützt Anthropic, OpenAI und
Google; der Einbettungspfad ist auf OpenAI festverdrahtet
(`packages/ai/src/embeddings.ts`, `text-embedding-3-small`,
`https://api.openai.com/v1`), und die Anbieterauswahl erfolgt **prozessglobal
über Umgebungsvariablen**, nicht je Mandant. Sobald `OPENAI_API_KEY` gesetzt ist,
fliessen Risikobeschreibungen, Prozessdokumentationen und DMS-Inhalte — laut
PII-Inventar 418 Freitextspalten mit möglichem Personenbezug — an einen
US-Verarbeiter, ohne dass der Mandant das sieht, steuern kann oder in seinem
eigenen VVT wiederfindet. Eine Minimierungs- oder Redaktionsschicht vor dem
Versand existiert nicht (`grep -niln "redact|anonymi[sz]e|scrub|mask"
packages/ai/src/` → keine Treffer).

Ebenfalls nicht genannt waren **FreeTSA** (`freetsa.org`) und die
**OpenTimestamps-Calendar-Server**. Beide erhalten nur einen Merkle-Root-Hash,
also keine personenbezogenen Daten im engeren Sinn — die Verbindung selbst
offenbart aber Existenz, Zeitpunkt und Frequenz der Audit-Aktivität eines
Mandanten.

## Bestandsaufnahme — wer welche Daten bekommt

| Empfänger                                           | Zweck                                | Daten                                                           | Ort       | Aktiv, wenn                  |
| --------------------------------------------------- | ------------------------------------ | --------------------------------------------------------------- | --------- | ---------------------------- |
| Hetzner Online GmbH                                 | Hosting, Rechenzentrum               | alle Mandantendaten                                             | DE        | immer                        |
| Resend                                              | Transaktions-E-Mail                  | Empfängeradresse, Betreff, Inhalt der Benachrichtigung          | EU/DE     | `RESEND_API_KEY` gesetzt     |
| Backblaze B2                                        | Objektspeicher (geplant)             | Dokumente, Beweismittel                                         | EU-Region | Storage-Backend konfiguriert |
| **Anthropic**                                       | KI-Assistenz (Copilot, Vorschläge)   | Prompt-Inhalte aus Fach- und Freitextfeldern                    | **US**    | `ANTHROPIC_API_KEY` gesetzt  |
| **OpenAI**                                          | KI-Assistenz **und Einbettungen**    | Prompt- und Einbettungstexte                                    | **US**    | `OPENAI_API_KEY` gesetzt     |
| **Google**                                          | KI-Assistenz                         | Prompt-Inhalte                                                  | **US**    | `GOOGLE_AI_API_KEY` gesetzt  |
| FreeTSA                                             | RFC-3161-Zeitstempel für Audit-Anker | Merkle-Root-Hash (kein Personenbezug); Metadaten der Verbindung | AT        | Ankerlauf aktiv              |
| OpenTimestamps-Calendars                            | Zusätzliche Verankerung              | Merkle-Root-Hash                                                | verteilt  | Ankerlauf aktiv              |
| Lokale Modelle (`claude_cli`, `ollama`, `lmstudio`) | KI-Assistenz                         | verlassen die Installation nicht                                | lokal     | entsprechend konfiguriert    |

## Was daraus folgt

**Die Zusage „keine Drittlandsübermittlung" ist nur richtig, solange
ausschliesslich lokale Modelle konfiguriert sind.** Das Produkt erzwingt das
nicht, prüft es nicht und zeigt es dem Mandanten nicht an. Wer sie geben will,
muss `ANTHROPIC_API_KEY`, `OPENAI_API_KEY` und `GOOGLE_AI_API_KEY`
**nicht setzen** — und dann steht auch der Einbettungspfad nicht zur Verfügung.

Die technische Behebung — Anbieterwahl je Mandant, `fail-closed` statt stillem
Cloud-Rückfall, Auswertung des vorhandenen `data_residency`-Modells — liegt in
`packages/ai/**` und ist als S05-01, S05-03 und S05-22 an WP6 adressiert. Dieses
Dokument stellt bis dahin den Ist-Zustand richtig dar, statt ihn zu beschönigen.

## Was ein Mandant tun sollte

1. **Vor Inbetriebnahme entscheiden**, ob KI-Funktionen mit externen Anbietern
   genutzt werden. Die Entscheidung ist heute eine Betriebsentscheidung des
   Betreibers, nicht des Mandanten.
2. Bei Nutzung: die betroffenen Verarbeitungstätigkeiten im eigenen VVT um einen
   `ropa_recipient`-Eintrag je Anbieter ergänzen und eine `tia` (Transfer Impact
   Assessment) anlegen. Beide Entitäten existieren im Produkt; sie werden nur
   nicht automatisch befüllt.
3. Die Garantie für den Transfer (SCC, Angemessenheitsbeschluss) im
   `contract`-Modul hinterlegen.
4. **Prüfen, welche Felder tatsächlich an das Modell gehen.** Es gibt keine
   Redaktionsschicht; was im Prompt steht, verlässt die Installation.

## Zeitstempeldienste

FreeTSA und die OpenTimestamps-Calendars erhalten nur einen Hash. Als
Übermittlung personenbezogener Daten ist das nicht zu bewerten; die
Verbindungsmetadaten (IP der Instanz, Zeitpunkt, Frequenz) sind es potenziell.
Wer das ausschliessen will, betreibt eine eigene TSA und setzt
`FREETSA_URL`/`FREETSA_CA_PEM` entsprechend; die Ankerkette funktioniert auch
ohne externen Zeitstempel, verliert dann aber die unabhängige Zeitbestätigung.
