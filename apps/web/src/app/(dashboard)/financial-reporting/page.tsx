import { redirect } from "next/navigation";

// #NIGHT-003: /financial-reporting was 404. Board reports are the
// most-used FinRep landing.
export default function FinancialReportingHome() {
  redirect("/financial-reporting/board-reports");
}
