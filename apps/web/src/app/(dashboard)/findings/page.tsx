import { redirect } from "next/navigation";

// #NIGHT-040: /findings 404'd. The cross-domain findings list lives at
// /grc-findings; sub-domain findings are under /audit/findings,
// /isms/incidents (incident findings), etc. Default to the cross list.
export default function FindingsRedirect() {
  redirect("/grc-findings");
}
