import { redirect } from "next/navigation";

// #NIGHT-051: German URL slug; the canonical page lives at /esg/materiality.
// Redirect for back-compat with users who copy URLs from German UI labels.
export default function WesentlichkeitRedirect() {
  redirect("/esg/materiality");
}
