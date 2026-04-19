import { redirect } from "next/navigation";

export default function AiActAnnualReportIndex() {
  redirect(`/ai-act/annual-report/${new Date().getUTCFullYear()}`);
}
