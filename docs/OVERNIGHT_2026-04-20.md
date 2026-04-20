# Overnight Session 2026-04-20 — Handover

Zusammenfassung der autonomen Overnight-Session auf `main`. Drei Commits auf main gepusht.

## Auslieferungsstatus

### Abgeschlossen

| #   | Task                                             | Status | Dateien / Evidence                                                                                                                                                            |
| --- | ------------------------------------------------ | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Settings-Seite befüllen                          | ✅     | [settings/page.tsx](<../apps/web/src/app/(dashboard)/settings/page.tsx>) — 6 Sektionen × ~4 Karten                                                                            |
| 2   | AI-Provider-Layer um LM Studio erweitern         | ✅     | [packages/ai/src/providers/lmstudio.ts](../packages/ai/src/providers/lmstudio.ts) + Router + 7 Tests                                                                          |
| 3   | AI-Providers-Settings-Seite                      | ✅     | [settings/ai-providers/page.tsx](<../apps/web/src/app/(dashboard)/settings/ai-providers/page.tsx>) + [/api/v1/ai/providers](../apps/web/src/app/api/v1/ai/providers/route.ts) |
| 4   | Module-Settings-Seite (Config-Button funktional) | ✅     | [settings/modules/[moduleKey]/page.tsx](<../apps/web/src/app/(dashboard)/settings/modules/[moduleKey]/page.tsx>)                                                              |
| 5   | ARCTOS-Namens-Erklärung im Login                 | ✅     | [login/page.tsx](<../apps/web/src/app/(auth)/login/page.tsx>) + identity.json DE/EN                                                                                           |
| 6   | Vertikales Menü auf CONDENSED                    | ✅     | [modern-sidebar.tsx](../apps/web/src/components/layout/modern-sidebar.tsx), [mobile-sidebar.tsx](../apps/web/src/components/layout/mobile-sidebar.tsx)                        |
| 7   | Inline-Handbuch 15 Kernmodule                    | ✅     | [module-handbook.ts](../apps/web/src/lib/module-handbook.ts) + [module-help-button.tsx](../apps/web/src/components/help/module-help-button.tsx) → Help-Icon im Header         |
| 8   | Testplan für alle 15 Module                      | ✅     | [TEST_PLAN_MODULES.md](./TEST_PLAN_MODULES.md)                                                                                                                                |
| 9   | Academy-Migrationen nach drizzle/ übernommen     | ✅     | [0108-0112*academy*\*.sql](../packages/db/drizzle/)                                                                                                                           |
| 10  | .env.example um LMSTUDIO\_\* erweitert           | ✅     | [.env.example](../.env.example)                                                                                                                                               |

### Review-Punkte (nicht automatisch gefixt, absichtlich)

| #   | Thema                                             | Begründung                                                                                                                                                                                                                                                                                                                                        |
| --- | ------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A   | **Audit-Log Hash-Chain: 4756/5008 chainMismatch** | `/api/v1/audit-log/integrity` zeigt `healthy: false`. Row-Hashes OK, aber `previous_hash`-Verknüpfung zwischen Rows bricht. Vermutlich Race-Condition im `audit_trigger()` bei parallelem Seed. Braucht ADR-011-Review + advisory_xact_lock oder Single-Writer-Pattern, nicht Overnight-Fix.                                                      |
| B   | **Zwei parallele Migrationsordner**               | `packages/db/drizzle/` (0001-0112) vs `packages/db/src/migrations/` (100-1057). `migrate-all.ts` liest nur ersteren. Ein frisches Setup verpasst systematisch 59 Migrationen. Empfehlung: `drizzle/` als source-of-truth festlegen, `src/migrations/` archivieren.                                                                                |
| C   | **Modul-Konsolidierung**                          | CLAUDE.md sagt „15 Kernmodule", die UI hat aber in `(dashboard)/` noch ~90 Ordner (meist Unterseiten dieser 15). Das ist struktuell in Ordnung (Next.js App-Router-Konvention), aber für die User-Kommunikation konsistenter, wenn wir die Top-15-Keys als „Module", alles darunter als „Features" bezeichnen. Ist Sprachregelung, kein Code-Fix. |
| D   | **Rate-Limit noch In-Memory**                     | `apps/web/src/lib/rate-limit.ts` Zeile 83 hat `// TODO: Phase 2 — echte Redis-Implementation`. Für Produktion mit >1 Instanz ein echtes Thema.                                                                                                                                                                                                    |

## AI-Provider-Konfiguration

Der neue `/settings/ai-providers`-Endpoint zeigt den Status aller sechs Provider:

- **claude_cli** — Nutzt Claude-Abo via lokaler CLI, kein API-Key nötig (aktiv wenn CLI im PATH)
- **claude_api** — Anthropic-API-Key-basiert (`ANTHROPIC_API_KEY`)
- **openai** — ChatGPT (`OPENAI_API_KEY`)
- **gemini** — Google Gemini (`GOOGLE_AI_API_KEY`)
- **ollama** — Lokal, GDPR-sicher (`OLLAMA_BASE_URL` / `OLLAMA_ENABLED`)
- **lmstudio** — Lokal mit GUI, OpenAI-kompatibel (`LMSTUDIO_BASE_URL` / `LMSTUDIO_ENABLED`) **← NEU**

Privacy-Routing: Wenn `containsPersonalData=true` im Request, wird bevorzugt Ollama, dann LM Studio gewählt — _unabhängig_ davon, was der Standard-Provider ist. Verhindert GDPR-Leak durch versehentliche Cloud-Calls.

Keys werden ausschließlich aus ENV gelesen — die UI zeigt nur "konfiguriert/nicht konfiguriert". Absicht: Secrets landen nie in der DB oder im Browser-Cache.

## Inline-Handbuch

Der Help-Button (`?`-Icon) im Header erscheint automatisch, wenn der aktuelle Pfad zu einem der 15 Module gehört. Ein Pfad-Alias-Mapping sorgt dafür, dass `/risks`, `/rcsa`, `/erm/fair`, `/budget` alle das ERM-Handbuch öffnen. Neue Module erweitern [module-handbook.ts](../apps/web/src/lib/module-handbook.ts) — kein UI-Code nötig.

Das Handbuch pro Modul enthält:

- Titel + Tagline
- Regulatorische Frameworks als Badge-Strip
- Abschnitte: Zweck, Kernartefakte, typischer Workflow, Three-Lines-of-Defense-Attribution, wichtige Einstellungen
- DE + EN gleichwertig

## Menü-Bereinigung

`ModernSidebar` und `MobileSidebar` nutzen jetzt `NAV_GROUPS_CONDENSED` (vorher `NAV_GROUPS`). Das spiegelt die Entscheidung hinter der horizontalen Tab-Navigation auf Modul-Unterseiten — die linke Sidebar bleibt kurz, deep-links erreicht der User über die Tabs. Der klassische `Sidebar` nutzte bereits die Condensed-Version als Default (über User-Präferenz `sidebarMode: "condensed"`).

## Git-Historie

```
ccf7b83 fix(gap-hunt): academy migrations + LM Studio test + integrity findings
332c5e0 feat(docs): inline handbook for 15 core modules + test plan review doc
64c368c feat(platform): overnight settings + AI-provider + ARCTOS branding batch
```

Alle drei commits auf `origin/main`.

## Nächste Schritte (Vorschlag für dich)

1. **Review dieser Datei + TEST_PLAN_MODULES.md** — entscheiden, welche Testlücken priorisiert werden.
2. **Audit-Chain-Integrität** — ADR-011-Review starten, Single-Writer-Pattern entscheiden.
3. **Migrations-Konsolidierung** — `src/migrations/` sichten, nach `drizzle/` umziehen.
4. **AI-Keys** — Echte Keys in `.env` (nicht in `.env.example`) setzen, dann können die Provider sofort genutzt werden.
5. **Testplan abarbeiten** — pro Modul die „Fehlen"-Punkte in Sprint-Backlog überführen.
