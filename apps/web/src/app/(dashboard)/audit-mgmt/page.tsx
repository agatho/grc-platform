import { redirect } from "next/navigation";

// #NIGHT-040: /audit-mgmt was an older name for the audit module;
// canonical URL is /audit. Redirect to keep deep links from docs working.
export default function AuditMgmtRedirect() {
  redirect("/audit");
}
