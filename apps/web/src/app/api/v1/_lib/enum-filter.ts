// Filterwerte gegen eine Datenbank-Aufzaehlung pruefen.
//
// [ARCTOS-FULL-2026-08-31 / Welle 4b · OP-076]
//
// Anlass: An mehreren Stellen unter `api/v1/**` wurde ein roher
// Abfrageparameter mit `as any` in eine `pgEnum`-Spalte gereicht:
//
//   const status = searchParams.get("status");
//   if (status) conditions.push(eq(wbCase.status, status as any));
//
// Das `as any` war nicht nur eine Typluecke, es hatte eine Wirkung. Postgres
// weist einen unbekannten Aufzaehlungswert zurueck — nachgemessen gegen die
// laufende Datenbank:
//
//   SELECT count(*) FROM wb_case WHERE status = 'bogus';
//   ERROR:  invalid input value for enum wb_case_status: "bogus"
//
// Ein Aufrufer, der `?status=bogus` schickt, bekam damit einen 500er aus der
// Datenbank statt einer Aussage ueber seine Eingabe. `isEnumValue` macht aus
// derselben Stelle eine Eingabepruefung: die erlaubten Werte stehen an der
// Spalte selbst (`column.enumValues`), es gibt also keine zweite Liste, die
// von der Datenbank wegdriften kann.

/**
 * Engt `value` auf die Werte von `values` ein. Die Liste kommt aus
 * `<column>.enumValues`, damit sie nicht neben dem Schema gepflegt wird.
 */
export function isEnumValue<T extends string>(
  values: readonly T[],
  value: string,
): value is T {
  return (values as readonly string[]).includes(value);
}
