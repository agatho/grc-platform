import { redirect } from "next/navigation";

// #NIGHT-001: /erm was 404. The ERM register lives under /risks (separate
// top-level sidebar entry), so /erm now redirects there to keep the URL
// space consistent with the management-system grouping.
export default function ErmHome() {
  redirect("/risks");
}
