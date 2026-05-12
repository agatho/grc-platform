import { redirect } from "next/navigation";

// #NIGHT-040: /incidents 404'd. Incident management lives under ISMS
// (security incidents) and AI Act (AI-system incidents); default to
// the larger ISMS list.
export default function IncidentsRedirect() {
  redirect("/isms/incidents");
}
