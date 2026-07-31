"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requirePaidUser } from "@/lib/subscription-server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/auth";
import { getLocale } from "@/lib/i18n-server";
import { t } from "@/lib/i18n";
import { getQaQuota } from "@/lib/qa";
import { type ActionResult, ok, fail } from "@/lib/action-result";

/**
 * §8 — user-submitted questions an admin can triage and promote to a card.
 *
 * Each user gets `qa_settings.monthly_question_limit` questions per calendar
 * month. The check here is what produces a readable message; the database
 * trigger (migration 031) is what actually enforces it, since a Server Action
 * is reachable by direct POST.
 */
export async function submitQaRequest(
  questionText: string,
): Promise<ActionResult<{ remaining: number }>> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);
  if (!questionText.trim()) return fail("Question can't be empty.");

  const locale = await getLocale();
  const quota = await getQaQuota(supabase, user.id);
  if (quota.remaining <= 0) {
    return fail(
      t(locale, "qa.quota_none").replace("{total}", String(quota.limit)),
    );
  }

  const { error } = await supabase.from("qa_requests").insert({ user_id: user.id, question_text: questionText.trim() });
  if (error) {
    // The trigger fires when two submissions race past the check above.
    if (error.message.includes("qa_monthly_quota_exceeded")) {
      return fail(t(locale, "qa.quota_blocked"));
    }
    return fail(error.message);
  }

  revalidatePath("/qa");
  return ok({ remaining: quota.remaining - 1 });
}

/** User clicked through to read their answered question — stop notifying. */
export async function markQaAnswerSeen(requestId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { user, denied } = await requirePaidUser();
  if (!user) return fail(denied);

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

/**
 * Admin: take a card out of the library, or put it back.
 *
 * The reversible half of removing a card — nothing is lost, the card just
 * stops being served. Prefer this over deleting for the seeded cards, which
 * `npm run seed:qa` would otherwise restore.
 */
export async function setQaCardPublished(
  cardId: string,
  isPublished: boolean,
): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("qa_cards")
    .update({ is_published: isPublished })
    .eq("id", cardId);
  if (error) return fail(error.message);

  revalidatePath("/admin/qa");
  revalidatePath("/qa");
  revalidatePath("/dashboard");
  return ok(undefined);
}

/**
 * Admin: delete a card outright.
 *
 * A card promoted from a user question is still referenced by that request
 * (`qa_requests.promoted_qa_card_id`), and the foreign key would block the
 * delete. So the request is unlinked first and dropped back to `dismissed`:
 * its answer no longer exists, so it should stop showing the asker a
 * "we answered your question" banner pointing at nothing.
 */
export async function deleteQaCard(cardId: string): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }

  const admin = createAdminClient();

  const { error: unlinkError } = await admin
    .from("qa_requests")
    .update({ promoted_qa_card_id: null, status: "dismissed" })
    .eq("promoted_qa_card_id", cardId);
  if (unlinkError) return fail(unlinkError.message);

  const { error } = await admin.from("qa_cards").delete().eq("id", cardId);
  if (error) return fail(error.message);

  revalidatePath("/admin/qa");
  revalidatePath("/qa");
  revalidatePath("/dashboard");
  return ok(undefined);
}

/** Admin: change how many questions a user may ask per calendar month. */
export async function setQaMonthlyLimit(limit: number): Promise<ActionResult> {
  try {
    await requireAdmin();
  } catch {
    return fail("Not authorized.");
  }
  if (!Number.isInteger(limit) || limit < 0 || limit > 100) {
    return fail("Pick a whole number between 0 and 100.");
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("qa_settings")
    .update({ monthly_question_limit: limit, updated_at: new Date().toISOString() })
    .eq("id", 1);
  if (error) return fail(error.message);

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
