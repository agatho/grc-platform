# ARCTOS — Umsetzungsplan der offenen Punkte

**Grundlage:** `docs/OFFENE-PUNKTE-REGISTER.md` — 166 Punkte, belegt aus 17 Berichten und dem Code.
**Stand:** `4caff361` · **Branch:** `audit/full-2026-08-31`

---

## 1. Wie dieser Plan gebaut ist

Das Register führt 166 Punkte. Sie nach Nummer abzuarbeiten wäre falsch — die Reihenfolge ergibt sich aus drei Fragen, in dieser Ordnung:

1. **Ist gerade etwas kaputt?** Vier Ratschen und Tore sind _verletzt_, teils durch unsere eigene Arbeit. Solange die CI rot ist, misst jede weitere Änderung gegen einen defekten Maßstab.
2. **Trifft es einen Nutzer oder ein Deployment?** Produktdefekte und deploy-blockierende Betriebspunkte vor allem, was nur intern stört.
3. **Blockiert es anderes?** Ein Punkt, an dem drei andere hängen, geht vor einem gleich großen, der allein steht.

Was nicht durch Arbeit lösbar ist — Zeitkriterien und Entscheidungen des Eigentümers — steht in Abschnitt 8 und wird nicht eingeplant, sondern vorgelegt.

## 2. Welle 0 — die CI wieder grün bekommen

**Zuerst, vor allem anderen.** Diese Punkte sind keine Altlast, sondern frische Regressionen; drei davon stammen aus der Arbeit der letzten Tage.

| OP                             | Was                                                                                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| OP-064                         | Lint-Ratsche verletzt: 418 gegen Baseline 404, `no-console` 135 gegen 121. Verursacher benannt.                                                     |
| OP-071                         | i18n-Untranslated-Ratsche verletzt: 171 gegen Budget 169.                                                                                           |
| OP-072                         | i18n-Bundle out of sync — ein Schlüssel fehlt in **beiden** Sprachen, der Nutzer sieht den Rohschlüssel.                                            |
| OP-066                         | Coverage-Gate rot: Function-Coverage in `auth` und `email` gefallen.                                                                                |
| OP-067                         | Coverage-Baseline steht auf dem Audit-Stand und misst gegen eine überholte Zahl.                                                                    |
| OP-068                         | `packages/bpmn` fehlt in der Coverage-Aggregation, Floor provisorisch.                                                                              |
| OP-107, OP-108, OP-109, OP-110 | Vier rote oder untaugliche Testdateien: ein toter Mock, ein `it.fails` auf einem echten Defekt, ein lastabhängiger Test, drei unvollständige Mocks. |
| OP-141                         | Prettier-Tor im Arbeitsbaum.                                                                                                                        |

**Abnahme:** Alle Tore grün, alle Ratschen auf gemessene Werte gesetzt statt auf geerbte. Eine Ratsche, die man beim Reißen höher stellt, ist keine Ratsche — jede Anhebung braucht eine Begründung in der Datei.

## 3. Welle 1 — Produktdefekte

Was Nutzer trifft oder ein Deployment blockiert. Drei Stränge, parallel, entlang der Systemgrenzen.

**1a — Betrieb und Zugriff (deploy-blockierend).** OP-090 (Worker läuft als DB-Superuser, Compose und CI nicht auf `grc_worker` umgestellt — der einzige unmittelbar deploy-relevante Punkt), OP-091, OP-095, OP-083 (kontextlose Disjunktion in der `user`-Policy), OP-084 (115 Routen weiterhin auf dem Basis-Pool), OP-085 (keine Session-Invalidierung beim Rollenentzug), OP-086, OP-096 (SAML prüft weder Ablauf noch Kette des IdP-Zertifikats), OP-097, OP-099, OP-139, OP-142.

**1b — Datenpfade und Integrität.** OP-050 (UI-Aufrufe mit `limit > 100` → stiller Leerzustand; die gefährlichste Fehlerform in diesem Produkt), OP-052, OP-111 (`ENABLE TRIGGER` stuft `ENABLE ALWAYS`-Guards zurück), OP-124, OP-105, OP-129, OP-137, OP-140, OP-014.

**1c — Oberfläche.** OP-157 (verschachtelte interaktive Elemente), OP-049, OP-082, OP-030, OP-033.

## 4. Welle 2 — BPMN-Engine fertigstellen

**2a — Divergenzen und Modellierung.** OP-020 bis OP-025 (die 77 verbliebenen `ours-wrong`-Fälle in sechs Klassen), OP-041, OP-042, OP-040, OP-044, OP-043 (XSD-Validator), OP-039.

**2b — Bedienung und Reichweite.** OP-018 (Drill-down in Subprozesse — der Importer zeichnet nur die erste Ebene), OP-019, OP-028, OP-029, OP-031, OP-032, OP-026, OP-045, OP-046, OP-037 (`packages/shared` parst BPMN weiterhin selbst — zwei Interpretationen desselben Formats), OP-038, OP-160.

## 5. Welle 3 — GRC-Oberfläche

**Der größte Einzelposten des ganzen Registers.** Zehn Tabellen tragen Daten, die heute nur per SQL pflegbar sind; 23 Layer lesen sie. Ohne Pflegeoberfläche ist die Diagrammschicht ein Leseraum.

OP-001 (XL, je Modul ein eigener Schnitt), OP-003, OP-004, OP-005, OP-006, OP-008, OP-010, OP-011, OP-016, OP-002 (Importer legt keine `process_lane`-Zeilen an — ohne ihn bleibt die Lane-Zuordnung Raten), OP-012, OP-013, OP-015, OP-017.

Zurückgestellt mit Begründung: OP-007 (EAM-Landschaft, XL, braucht eine zweite Zeichenebene), OP-009 (Zeitreise, braucht zwei Szenen gleichzeitig), OP-103 (vierzehn ehrlich als „nicht implementiert" gemeldete Pfade — das ist Produktarbeit, kein Nachziehen).

## 6. Welle 4 — Test- und Codequalität

**4a — Testabdeckung dort, wo sie fehlt.** OP-027 (kein E2E-Test bedient die BPMN-Fläche — dass ein Mensch zeichnen kann, ist unbewiesen), OP-047, OP-058, OP-088, OP-092, OP-093, OP-036, OP-163, OP-155.

**4b — Compiler und Lint.** OP-065 (Pakete mit abgeschwächten Optionen, XL), OP-063, OP-076, OP-077, OP-078, OP-080, OP-081, OP-087, OP-152, OP-116, OP-079.

**4c — Coverage und toter Code.** OP-069 (XL), OP-073, OP-074, OP-075, OP-089.

## 7. Welle 5 — i18n, Dokumentation, Betrieb

OP-070 (96 Seiten ohne i18n, XL), OP-104 (Doku führt mehr als fertig, was ehrlich als „nicht implementiert" meldet — nach allem, was der Audit über Doku-Drift ergeben hat, gehört das korrigiert), OP-106, OP-115, OP-117, OP-128, OP-130 bis OP-136, OP-138, OP-143, OP-145, OP-151, OP-159, OP-051, OP-053, OP-048, OP-055, OP-100, OP-101, OP-102, OP-112, OP-114.

## 8. Was nicht durch Arbeit lösbar ist

**Zeitkriterien** — nicht abkürzbar, nur beginnbar: OP-161 (Shadow-Compare, 30 Tage), OP-162 (Pilotphase), OP-097 (Rotationsfenster).

**Entscheidungen des Eigentümers** — 20 Punkte, unter anderem: Repository öffentlich (OP-059), Git-Historie (OP-060), bpmn.io-Lizenz (OP-061), `@grc`-Scope auf npmjs (OP-144, Dependency Confusion), Required Checks (OP-150), Alarm-Zustellkanal (OP-147), AI-Egress-Default (OP-118), Verschlüsselung at rest (OP-120), zweite Replik (OP-148), Seed-Admin-Rotation (OP-156), Marketingaussage zur Cloud-Unabhängigkeit (OP-158), rechtliche Würdigung (OP-165).

**Ressourcen, nicht Zeit** — aufwendig, aber machbar, sobald eine Umgebung da ist: OP-062 (EN 301 549 mit Browserlauf), OP-035 (Screenreader), OP-146/OP-164 (Staging-Lauf), OP-166 (Penetrationstest).

## 10. Stand nach der Abarbeitung (2026-09-05)

Alle geplanten Wellen sind gelaufen: 0, 1a–1c, 2a–2b, 3, 4a, 4b (sieben
Stränge), 4c, 5a, 5b, 5c. Der Verlauf steht in `docs/UMSETZUNG-WELLE-*.md`,
die Befunde als Nachträge in `docs/OFFENE-PUNKTE-REGISTER.md`.

**Gemessen am Ende:** 428/428 Migrationen von Null (617 Tabellen), 13
Typprüfungen ohne Fehler, 7.616 Tests grün in 13/13 Tasks, RLS-Suite 186/186,
und zehn Tore — Prettier, Lint (zwei Bereiche), Coverage, Tor-Eingaben,
Dead-Exports, i18n (zwei Ratschen), DB-Integrität, Geheimnisse, Audit —
allesamt grün und jedes durch künstliche Verletzung als auslösefähig
nachgewiesen.

**Was der Plan nicht vorhergesehen hat, und die eigentliche Ausbeute ist:**

Der Plan war nach 166 Punkten gebaut. Die Arbeit an ihnen hat **weitere 29
Punkte** (OP-167 bis OP-195) hervorgebracht, darunter einen Sicherheits- und
zwei Schwerbefunde, die in keinem der 17 Ausgangsberichte standen. Sie kamen
fast alle auf demselben Weg: **nicht durch Suchen, sondern durch Einschalten**.
Eine abgeschaltete Lint-Regel, ein abgeschalteter Compiler-Schalter, ein
Testkanal auf der falschen Rolle — jedes Mal lag darunter Produktcode, den
niemand je hatte scheitern sehen.

**Die Zahl, die dieser Plan im Rückblick am meisten unterschätzt hat, ist
nicht die der Defekte, sondern die der Tore, die nicht auslösen konnten: zehn.**

Eine ignorierte Tor-Eingabe; ein `git diff` auf ungetrackte Pfade; ein `tee`
ohne `pipefail`; ein Datenbanktest, der an seiner eigenen Vorbedingung starb
(OP-168); eine Suite, die ihre Voraussetzung erriet und dabei gegen eine
andere Datenbank lief (OP-170); eine `allow`-Liste, die genau das Gefährliche
durchliess (OP-171); ein Prettier-Lauf, der die falsche Dateimenge prüfte
(OP-183); eine Smoke-Suite, die einen Befund ausdrücklich als zulässig führte;
ein Geheimnis-Scanner mit `continue-on-error: true` **und** `|| true`
(OP-193); und ein Platzhalterfilter, der die ganze Zeile prüfte, so dass ein
echter Schlüssel neben einem `example.com` unsichtbar war (OP-194). Dazu ein
Tor, das zum Löschen benutzter Exporte aufgefordert hätte (OP-195), und eine
„Löschliste" von 6.796 Übersetzungsschlüsseln, deren Abarbeitung die
Hauptnavigation entbeschriftet hätte (OP-073).

**Die Regel aus Abschnitt 9 hat sich in jeder Welle bestätigt** — und eine
zweite ist dazugekommen, die der Plan noch nicht kannte:

> Die Wache über der Sache war öfter kaputt als die Sache. Wer ein Tor grün
> sieht, hat noch nichts gemessen; er hat gesehen, dass es nicht rot war.

**Dreimal ist derselbe Fehler in dieser Arbeit selbst passiert** und steht
benannt im Register: ein „Compiled successfully" als Beleg für einen behobenen
Absturz gelesen (OP-167), ein Coverage-Tor gegen einen veralteten Bericht
grün gemeldet, und ein Geheimnis-Report, der vor der Zeile erzeugt wurde, die
er hätte finden müssen. Jedes Mal ein Artefakt als Ergebnis gelesen — dieselbe
Fehlerform, gegen die dieses Register angetreten ist.

**Was offen bleibt**, unverändert nach Abschnitt 8 sortiert: die Zeitkriterien
(OP-161, OP-162, OP-097), die Entscheidungen des Eigentümers (20 Punkte), die
ressourcengebundenen Punkte (OP-062, OP-035, OP-146/164, OP-166) — und neu:
der blockierte Produktionsbau (OP-167, Fremdfehler, mit sechs trennscharfen
Messungen belegt), OP-112 (eine fehlende Zeile in einem Manifest), die
restliche i18n (`ai-act`, `settings`, `admin`), die 255 rohen Query-Leser aus
OP-116, und der QA-Bewertungspfad, der gar nicht verdrahtet ist.

---

## 9. Arbeitsweise

Wie bei der Remediation: Wellen mit Dateihoheit je Strang, keine Testabschwächung, jede Änderung mit Nachweis, Ratschen werden gemessen und nicht geraten. Nach jeder Welle: Migrationen von Null, Typecheck über alle Projekte, alle Testsuiten, Playwright, die Tore — und ein Commit, damit ein Abbruch nichts kostet.

**Eine Regel aus der bisherigen Arbeit gilt weiter und ist der wichtigste Satz dieses Plans:** Wo ein Test einen Defekt zeigt, wird der Defekt behoben, nicht die Erwartung. Jede der drei E2E-Runden hat mehr echte Produktdefekte gefunden als Testfehler.
