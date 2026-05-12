import { redirect } from "next/navigation";

// #NIGHT-040: bare /audits 404'd. The audit module lives under /audit
// (singular). Redirect for back-compat with external links.
export default function AuditsRedirect() {
  redirect("/audit");
}
