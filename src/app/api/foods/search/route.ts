import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Full-text + trigram fallback search over the public `foods` catalog. */
export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) return NextResponse.json({ foods: [] });

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("foods")
    .select("id, name_ar, name_en, category, calories_per_100g, protein_per_100g, carbs_per_100g, fat_per_100g, image_url")
    .or(`name_en.ilike.%${q}%,name_ar.ilike.%${q}%`)
    .limit(20);

  if (error) return NextResponse.json({ foods: [] }, { status: 500 });
  return NextResponse.json({ foods: data });
}
