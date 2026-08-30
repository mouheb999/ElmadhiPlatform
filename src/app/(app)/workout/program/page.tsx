import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The program moved up to /workout, so that the tab the bottom nav prefetches
 * is the tab that renders it. This route stays as the redirect the other way
 * round: every existing link, bookmark and `revalidatePath("/workout/program")`
 * keeps working, and the extra hop is now paid by the rare direct visit rather
 * than by every tap on the Workout tab.
 */
export default async function WorkoutProgramPage() {
  redirect("/workout");
}
