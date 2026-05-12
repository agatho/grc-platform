import { redirect } from "next/navigation";

// #NIGHT-003: /role-dashboards was 404. The board view is the canonical
// landing; users select their persona-specific dashboard from there.
export default function RoleDashboardsHome() {
  redirect("/role-dashboards/board");
}
