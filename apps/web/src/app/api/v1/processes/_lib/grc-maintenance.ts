// grc-maintenance.ts — die Umrechnungen der Pflegemasken, als reine
// Funktionen und damit prüfbar.
//
// [ARCTOS-FULL-2026-08-31 · OP-001] Beide Funktionen hier bilden je einen
// Unterschied ab, den ein `||` verschluckt und ein `??` erhält. In einem
// GRC-Produkt ist dieser Unterschied nicht kosmetisch:
//
//   * **Lane:** „das Feld war nicht im Aufruf" (nicht anfassen) gegen „das
//     Feld war ausdrücklich `null`" (Zuordnung löschen). Ein PATCH, der beides
//     gleich behandelt, löscht bei jeder Teiländerung den Dienstleister mit.
//   * **BIA:** `0` gegen „nicht bewertet". `simulateOutage` liest 0 als „die
//     Übergangslösung trägt nicht" (STUFE2-A2 §7.4). Ein `|| null` machte aus
//     dieser Aussage eine Lücke — und aus einem Ausfallszenario ein anderes.

export interface LanePatchInput {
  orgUnitId?: string | null;
  customRoleId?: string | null;
  vendorId?: string | null;
  isExternal?: boolean;
  thirdCountry?: string | null;
}

/**
 * Baut die Menge der Spalten, die ein PATCH tatsächlich schreibt.
 *
 * Nur Schlüssel, die im Aufruf STANDEN, landen im Ergebnis. `null` ist ein
 * Wert (löschen), `undefined` ist keiner (unverändert lassen).
 */
export function lanePatchFrom(
  v: LanePatchInput,
  actor: { userId: string; now: Date },
): Record<string, unknown> {
  const patch: Record<string, unknown> = {
    updatedAt: actor.now,
    updatedBy: actor.userId,
  };
  if ("orgUnitId" in v) patch.orgUnitId = v.orgUnitId ?? null;
  if ("customRoleId" in v) patch.customRoleId = v.customRoleId ?? null;
  if ("vendorId" in v) patch.vendorId = v.vendorId ?? null;
  if ("isExternal" in v) patch.isExternal = v.isExternal;
  if ("thirdCountry" in v) {
    patch.thirdCountry = v.thirdCountry ? v.thirdCountry.toUpperCase() : null;
  }
  return patch;
}

export interface BiaInput {
  criticality: string;
  mtpdMinutes?: number | null;
  rtoMinutes?: number | null;
  rpoMinutes?: number | null;
  workaround?: string | null;
  workaroundMaxDurationMinutes?: number | null;
  biaAssessmentId?: string | null;
}

export interface BiaValues {
  criticality: string;
  mtpdMinutes: number | null;
  rtoMinutes: number | null;
  rpoMinutes: number | null;
  workaround: string | null;
  workaroundMaxDurationMinutes: number | null;
  biaAssessmentId: string | null;
}

/**
 * Normalisiert die BIA-Eingaben eines Schritts auf die Spaltenwerte.
 *
 * Jedes `?? null` hier ist Absicht: `0` ist ein Messwert, kein fehlender Wert.
 * `workaround` wird auf `null` normalisiert, wenn die Zeichenkette leer ist —
 * eine leere Beschreibung ist keine Beschreibung, und `''` in einer
 * `text`-Spalte sähe in jeder Auswertung wie eine hinterlegte aus.
 */
export function biaValuesFrom(v: BiaInput): BiaValues {
  return {
    criticality: v.criticality,
    mtpdMinutes: v.mtpdMinutes ?? null,
    rtoMinutes: v.rtoMinutes ?? null,
    rpoMinutes: v.rpoMinutes ?? null,
    workaround: v.workaround ? v.workaround : null,
    workaroundMaxDurationMinutes: v.workaroundMaxDurationMinutes ?? null,
    biaAssessmentId: v.biaAssessmentId ?? null,
  };
}
