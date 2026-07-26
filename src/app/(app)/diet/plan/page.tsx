import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/** The plan now lives at /diet?view=plan; this route redirects for old links. */
export default function DietPlanRedirect() {
  redirect("/diet?view=plan");
}
