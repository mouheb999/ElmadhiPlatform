import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * The diary now lives at /diet?view=today; this route redirects for old links
 * (dashboard tiles, the AI estimator), preserving a browsed `?date=`.
 */
export default async function DietLogRedirect({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date } = await searchParams;
  redirect(date ? `/diet?view=today&date=${date}` : "/diet?view=today");
}
