import { redirect } from "next/navigation";

// #NIGHT-013: this slug appeared in old links / docs but the canonical
// URL is /dpms/tia. Redirect to keep external bookmarks working.
export default function TransferImpactAssessmentsRedirect() {
  redirect("/dpms/tia");
}
