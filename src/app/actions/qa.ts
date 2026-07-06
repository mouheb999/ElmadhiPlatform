"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
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

/** User clicked through to read their answered question — stop notifying. */
export async function markQaAnswerSeen(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return fail("Not signed in.");

  const { error } = await supabase
    .from("qa_requests")
    .update({ answered_seen_at: new Date().toISOString() })
    .eq("id", requestId)
    .eq("user_id", user.id);
  if (error) return fail(error.message);

  revalidatePath("/dashboard");
  revalidatePath("/qa");
  return ok(undefined);
}

export type PublishQaInput = {
  categoryId: string | null;
  questionEn: string;
  questionAr: string;
  answerShortEn: string;
  answerShortAr: string;
  answerLongEn: string;
  answerLongAr: string;
};

/**
 * Admin triage: turn a user question into a published Q&A card and flag the
 * request so the asker gets a "your question was answered" notification.
 */
export async function publishQaRequest(
  requestId: string,
  input: PublishQaInput,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }
  if (!input.questionEn.trim() && !input.questionAr.trim()) {
    return fail("Write the question in at least one language.");
  }
  if (!input.answerShortEn.trim()) {
    return fail("The short answer (English) is required.");
  }

  const admin = createAdminClient();

  const { data: request, error: requestError } = await admin
    .from("qa_requests")
    .select("id, status")
    .eq("id", requestId)
    .maybeSingle();
  if (requestError) return fail(requestError.message);
  if (!request) return fail("Request not found.");
  if (request.status !== "pending") return fail("Request already handled.");

  const { data: card, error: cardError } = await admin
    .from("qa_cards")
    .insert({
      category_id: input.categoryId,
      question_en: input.questionEn.trim() || null,
      question_ar: input.questionAr.trim() || null,
      answer_short: input.answerShortEn.trim(),
      answer_short_ar: input.answerShortAr.trim() || null,
      answer_long_md: input.answerLongEn.trim() || null,
      answer_long_md_ar: input.answerLongAr.trim() || null,
      is_published: true,
    })
    .select("id")
    .single();
  if (cardError || !card) return fail(cardError?.message ?? "Could not create the card.");

  const { error: updateError } = await admin
    .from("qa_requests")
    .update({ status: "published", promoted_qa_card_id: card.id })
    .eq("id", requestId);
  if (updateError) return fail(updateError.message);

  revalidatePath("/admin/qa");
  revalidatePath("/qa");
  return ok(undefined);
}

/** Admin triage: drop a question without publishing. */
export async function dismissQaRequest(requestId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("qa_requests")
    .update({ status: "dismissed" })
    .eq("id", requestId)
    .eq("status", "pending");
  if (error) return fail(error.message);

  revalidatePath("/admin/qa");
  return ok(undefined);
}
