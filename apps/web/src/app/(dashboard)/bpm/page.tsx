import { redirect } from "next/navigation";

// #NIGHT-003: /bpm was 404. The process list is the canonical BPM
// landing; the /bpm/* sub-pages (kpis, mining, maturity) are advanced
// views that branch off from there.
export default function BpmHome() {
  redirect("/processes");
}
