import { redirect } from "next/navigation";

// #NIGHT-003: /policies was 404. The distributions list is the
// authoring landing; users without authoring rights still hit this page
// from the sidebar group header and need a sensible default.
export default function PoliciesHome() {
  redirect("/policies/distributions");
}
