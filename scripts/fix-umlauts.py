#!/usr/bin/env python3
"""Fix German umlauts in i18n JSON files: ae->ä, oe->ö, ue->ü (context-aware)."""
import json, os, re, sys

de_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'apps', 'web', 'messages', 'de')

# Known German word patterns where ae/oe/ue should be umlauts
# Using word stems to catch all inflections
REPLACEMENTS = {
    # ae -> ä patterns
    'Aenderung': 'Änderung', 'aenderung': 'änderung', 'Aender': 'Änder', 'aender': 'änder',
    'Aktivitaet': 'Aktivität', 'aktivitaet': 'aktivität',
    'Abhaengig': 'Abhängig', 'abhaengig': 'abhängig',
    'Abschaetz': 'Abschätz', 'abschaetz': 'abschätz',
    'Abwaeg': 'Abwäg',
    'Anfaellig': 'Anfällig', 'anfaellig': 'anfällig',
    'Ankuendig': 'Ankündig', 'ankuendig': 'ankündig',
    'Auffaellig': 'Auffällig', 'auffaellig': 'auffällig',
    'Aufklaer': 'Aufklär', 'aufklaer': 'aufklär',
    'Ausfuehr': 'Ausführ', 'ausfuehr': 'ausführ',
    'Ausfuell': 'Ausfüll', 'ausfuell': 'ausfüll',
    'Ausloes': 'Auslös', 'ausloes': 'auslös',
    'Beeintraechtig': 'Beeinträchtig', 'beeintraechtig': 'beeinträchtig',
    'Begruend': 'Begründ', 'begruend': 'begründ',
    'Behoerde': 'Behörde', 'behoerde': 'behörde',
    'Beruecksichtig': 'Berücksichtig', 'beruecksichtig': 'berücksichtig',
    'Bestaetigen': 'Bestätigen', 'bestaetigen': 'bestätigen',
    'Bestaetigt': 'Bestätigt', 'bestaetigt': 'bestätigt',
    'Bestaetigung': 'Bestätigung', 'bestaetigung': 'bestätigung',
    'Durchfuehr': 'Durchführ', 'durchfuehr': 'durchführ',
    'Einfuehr': 'Einführ', 'einfuehr': 'einführ',
    'eingefuehrt': 'eingeführt',
    'Empfaenger': 'Empfänger', 'empfaenger': 'empfänger',
    'Ergaenz': 'Ergänz', 'ergaenz': 'ergänz',
    'Erklaer': 'Erklär', 'erklaer': 'erklär',
    'Erlaeuterung': 'Erläuterung', 'erlaeuterung': 'erläuterung',
    'Ermaechtigt': 'Ermächtigt',
    'Faehigkeit': 'Fähigkeit', 'faehigkeit': 'fähigkeit',
    'Faellig': 'Fällig', 'faellig': 'fällig', 'faell': 'fäll',
    'Foerder': 'Förder', 'foerder': 'förder',
    'Gefaehrd': 'Gefährd', 'gefaehrd': 'gefährd',
    'Geloescht': 'Gelöscht', 'geloescht': 'gelöscht',
    'Genuegt': 'Genügt', 'genuegt': 'genügt',
    'Geprueft': 'Geprüft', 'geprueft': 'geprüft',
    'Geraet': 'Gerät', 'geraet': 'gerät',
    'Geringfuegig': 'Geringfügig', 'geringfuegig': 'geringfügig',
    'Geschaeft': 'Geschäft', 'geschaeft': 'geschäft',
    'Gewaehr': 'Gewähr', 'gewaehr': 'gewähr',
    'Groesse': 'Größe', 'groesse': 'größe',
    'Grundsaetz': 'Grundsätz', 'grundsaetz': 'grundsätz',
    'Haeufig': 'Häufig', 'haeufig': 'häufig',
    'Halbjaehr': 'Halbjähr', 'halbjaehr': 'halbjähr',
    'Jaehrlich': 'Jährlich', 'jaehrlich': 'jährlich',
    'Koerper': 'Körper',
    'Kuendig': 'Kündig', 'kuendig': 'kündig',
    'Kuerzlich': 'Kürzlich', 'kuerzlich': 'kürzlich',
    'Laender': 'Länder', 'laender': 'länder',
    'Loeschen': 'Löschen', 'loeschen': 'löschen', 'Loesung': 'Lösung', 'loesung': 'lösung',
    'Maengel': 'Mängel', 'maengel': 'mängel',
    'Moeglich': 'Möglich', 'moeglich': 'möglich',
    'Nachtraeg': 'Nachträg', 'nachtraeg': 'nachträg',
    'Naechst': 'Nächst', 'naechst': 'nächst',
    'Notfallplaene': 'Notfallpläne', 'notfallplaene': 'notfallpläne',
    'Plaene': 'Pläne', 'plaene': 'pläne',
    'Praeventiv': 'Präventiv', 'praeventiv': 'präventiv', 'Praezis': 'Präzis',
    'Pruef': 'Prüf', 'pruef': 'prüf',
    'Regelmaessig': 'Regelmäßig', 'regelmaessig': 'regelmäßig',
    'Rueckgaengig': 'Rückgängig',
    'Saeule': 'Säule',
    'Schaed': 'Schäd', 'schaed': 'schäd',
    'Schaetz': 'Schätz', 'schaetz': 'schätz',
    'Schluess': 'Schlüss', 'schluess': 'schlüss',
    'Schoepfung': 'Schöpfung', 'schoepfung': 'schöpfung',
    'Schwaeche': 'Schwäche', 'schwaeche': 'schwäche',
    'Sorgfaeltig': 'Sorgfältig', 'sorgfaeltig': 'sorgfältig',
    'Spaet': 'Spät', 'spaet': 'spät',
    'Staerke': 'Stärke', 'staerke': 'stärke',
    'Stoerung': 'Störung', 'stoerung': 'störung',
    'Stuetz': 'Stütz', 'stuetz': 'stütz',
    'Taeglich': 'Täglich', 'taeglich': 'täglich',
    'Taetigkeit': 'Tätigkeit', 'taetigkeit': 'tätigkeit',
    'Traeger': 'Träger', 'traeger': 'träger',
    'Ueberfaellig': 'Überfällig', 'ueberfaellig': 'überfällig',
    'Ueberpruef': 'Überprüf', 'ueberpruef': 'überprüf',
    'Uebersicht': 'Übersicht', 'uebersicht': 'übersicht',
    'Uebertrag': 'Übertrag', 'uebertrag': 'übertrag',
    'Uebung': 'Übung', 'uebung': 'übung',
    'Ueberwach': 'Überwach', 'ueberwach': 'überwach',
    'Uebergreifend': 'Übergreifend', 'uebergreifend': 'übergreifend',
    'Unterstuetz': 'Unterstütz', 'unterstuetz': 'unterstütz',
    'Unzulaessig': 'Unzulässig', 'unzulaessig': 'unzulässig',
    'Veraender': 'Veränder', 'veraender': 'veränder',
    'Verfuegbar': 'Verfügbar', 'verfuegbar': 'verfügbar',
    'Verguetung': 'Vergütung',
    'Verlaesslich': 'Verlässlich', 'verlaesslich': 'verlässlich',
    'Veroeffentlich': 'Veröffentlich', 'veroeffentlich': 'veröffentlich',
    'Verschluesselung': 'Verschlüsselung', 'verschluesselung': 'verschlüsselung',
    'Vierteljaehr': 'Vierteljähr', 'vierteljaehr': 'vierteljähr',
    'Vollstaendig': 'Vollständig', 'vollstaendig': 'vollständig',
    'Waehrend': 'Während', 'waehrend': 'während',
    'Woechentlich': 'Wöchentlich', 'woechentlich': 'wöchentlich',
    'Zugehoer': 'Zugehör',
    'Zulaessig': 'Zulässig', 'zulaessig': 'zulässig',
    'Zurueck': 'Zurück', 'zurueck': 'zurück',
    'Zusaetzlich': 'Zusätzlich', 'zusaetzlich': 'zusätzlich',
    'Zustaendig': 'Zuständig', 'zustaendig': 'zuständig',
    'Zuverlaessig': 'Zuverlässig', 'zuverlaessig': 'zuverlässig',
    # Additional common patterns
    'ausgefuehrt': 'ausgeführt', 'Ausgefuellt': 'Ausgefüllt',
    'Zeitgemaess': 'Zeitgemäß',
    'Massnahme': 'Maßnahme', 'massnahme': 'maßnahme',
    'Aeltere': 'Ältere', 'aeltere': 'ältere',
    'Betrueger': 'Betrüger',
    'Vorlaeufig': 'Vorläufig', 'vorlaeufig': 'vorläufig',
    'Aehnlich': 'Ähnlich', 'aehnlich': 'ähnlich',
    'Aerger': 'Ärger',
    'Oeffentlich': 'Öffentlich', 'oeffentlich': 'öffentlich',
    'Oekonomisch': 'Ökonomisch', 'oekonomisch': 'ökonomisch',
    'Oekologisch': 'Ökologisch', 'oekologisch': 'ökologisch',
    'Ueber': 'Über', 'ueber': 'über',
}

# Also fix double-encoded UTF-8
ENCODING_FIXES = {
    '\u00e2\u20ac\u201c': '\u2013',  # â€" -> –
    '\u00e2\u20ac\u201d': '\u2014',  # â€" -> —
    '\u00e2\u20ac\u2122': '\u2019',  # â€™ -> '
    '\u00e2\u20ac\u0153': '\u201c',  # â€œ -> "
    '\u00e2\u20ac\u009d': '\u201d',  # â€ -> "
    '\u00c3\u00a4': 'ä', '\u00c3\u00b6': 'ö', '\u00c3\u00bc': 'ü',
    '\u00c3\u0084': 'Ä', '\u00c3\u0096': 'Ö', '\u00c3\u009c': 'Ü',
    '\u00c3\u009f': 'ß',
    'â€"': '–', 'â€"': '—', 'â€™': "'", 'â€œ': '"', 'â€\u009d': '"',
    'Ã¤': 'ä', 'Ã¶': 'ö', 'Ã¼': 'ü', 'Ã„': 'Ä', 'Ã–': 'Ö', 'Ãœ': 'Ü', 'ÃŸ': 'ß',
}

total_replacements = 0
files_changed = 0

for fn in sorted(os.listdir(de_dir)):
    if not fn.endswith('.json'):
        continue
    fp = os.path.join(de_dir, fn)
    with open(fp, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content

    # Fix encoding issues first
    for old, new in ENCODING_FIXES.items():
        content = content.replace(old, new)

    # Fix umlaut replacements (longest match first to avoid partial replacements)
    sorted_repls = sorted(REPLACEMENTS.items(), key=lambda x: -len(x[0]))
    for old, new in sorted_repls:
        content = content.replace(old, new)

    if content != original:
        # Count actual changes
        changes = 0
        for old, new in {**ENCODING_FIXES, **REPLACEMENTS}.items():
            changes += original.count(old)
        total_replacements += changes
        files_changed += 1
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'  {fn}: {changes} replacements')

print(f'\nDone: {files_changed} files changed, {total_replacements} total replacements')
