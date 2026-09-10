// pagination-contract.ts — die eine Zahl, an die sich Server und Browser halten.
//
// [ARCTOS-FULL-2026-08-31 · OP-050]
//
// Warum eine eigene Datei und nicht `lib/api.ts`: `lib/api.ts` zieht `@/auth`,
// `@grc/db` und `next/headers` herein. Wer von dort `MAX_PAGE_SIZE` importiert,
// zieht den halben Serverbaum in ein Client-Bundle — also hat es bisher
// niemand getan, und die Grenze stand im Browser als Zahlenliteral (`limit=200`,
// `limit=500`) neben einer Serverregel, die sie längst verbietet. Zwei Kopien
// einer Zahl, die auseinanderlaufen können, sind der Defekt; ein Blattmodul
// ohne Importe ist die Reparatur.
//
// Die Regel selbst stammt aus #NIGHT-059: `paginate()` lehnt `limit > 100` mit
// 422 ab, statt still zu kappen. Das ist richtig — ein Client, der 200 Zeilen
// anfordert und 100 bekommt, hält 100 für alles. Der Preis ist, dass jeder
// Aufruf mit einer zu grossen Zahl leer zurückkommt; siehe `api-client.ts`.

/** Grösste vom Server akzeptierte Seitengrösse. Grösser ⇒ 422. */
export const MAX_PAGE_SIZE = 100;

/** Seitengrösse, wenn der Aufrufer keine nennt. */
export const DEFAULT_PAGE_SIZE = 20;
