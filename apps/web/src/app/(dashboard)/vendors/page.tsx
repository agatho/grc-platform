import { redirect } from "next/navigation";

// #NIGHT-040: /vendors 404'd. Vendor management is the TPRM landing page.
export default function VendorsRedirect() {
  redirect("/tprm");
}
