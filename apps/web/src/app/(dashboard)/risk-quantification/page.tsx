import { redirect } from "next/navigation";

// #NIGHT-053: /risk-quantification root 404'd. The overview page is
// the canonical landing for the unified quantification dashboard.
export default function RiskQuantificationHome() {
  redirect("/risk-quantification/overview");
}
