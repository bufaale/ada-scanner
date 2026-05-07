import { redirect } from "next/navigation";

/**
 * /dashboard/sites without a domain parameter is not a real route. The sites
 * list lives on /dashboard. Forward there instead of returning a 404.
 */
export default function SitesIndexPage() {
  redirect("/dashboard");
}
