import { redirect } from "next/navigation";

export default function EsgReportPage() {
  redirect(`/esg/report/${new Date().getFullYear()}`);
}
