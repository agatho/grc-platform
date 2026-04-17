import { redirect } from "next/navigation";

// R-01 Fix: /audit/findings lieferte bisher 404, weil die Route nicht
// existierte. Der Audit-Dashboard-Quick-Nav linkt aber dorthin. Da die
// zentrale Findings-UI unter /controls/findings lebt (shared entity quer
// ueber ICS, Audit, BCMS), leiten wir hier nach /controls/findings um und
// pinnen den Source-Filter auf "audit", damit der User nur Audit-Findings
// sieht -- also genau das was die Quick-Nav-Kachel impliziert.
//
// Eine eigene Audit-spezifische Findings-Uebersicht (ohne Redirect) koennen
// wir spaeter bauen, wenn sich die Use-Cases unterscheiden. Fuer den
// Moment ist Redirect + Preselect der saubere UX-Fix mit Null Code-
// Duplizierung.
export default function AuditFindingsRedirect() {
  redirect("/controls/findings?source=audit");
}
