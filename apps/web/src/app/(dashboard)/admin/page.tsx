import { redirect } from "next/navigation";

// #NIGHT-003: /admin was 404. The platform settings (org switcher, users,
// modules) are reachable via the sidebar but the bare /admin URL led
// nowhere. Redirect to the org list which is the most common entry point.
export default function AdminHome() {
  redirect("/organizations");
}
