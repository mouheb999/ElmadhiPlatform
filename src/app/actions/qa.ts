"use server";

import { createClient } from "@/lib/supabase/server";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/** §8 — user-submitted questions an admin can triage and promote to a card. */
export async function submitQaRequest(questionText: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");
  if (!questionText.trim()) return fail("Question can't be empty.");

  const { error } = await supabase.from("qa_requests").insert({ user_id: user.id, question_text: questionText.trim() });
  if (error) return fail(error.message);
  return ok(undefined);
}
