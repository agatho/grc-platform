import { redirect } from "next/navigation";

// #NIGHT-002: /whistleblowing was 404. The cases list is the canonical
// landing for the whistleblowing officer role.
export default function WhistleblowingHome() {
  redirect("/whistleblowing/cases");
}
