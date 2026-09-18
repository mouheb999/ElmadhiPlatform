/**
 * Locale model for HYPE FITNESS.
 * - "en" → English, left-to-right
 * - "tn" → Tunisian Arabic (Derja), right-to-left
 *
 * Default is Tunisian Arabic per product direction (most users are Tunisian).
 * NOTE: there is NO French locale anywhere in the product.
 *
 * This module is client-safe (no server-only imports). The cookie reader lives
 * in `i18n-server.ts` so client components can import t()/dir()/pick() freely.
 */
export type Locale = "en" | "tn";

export const DEFAULT_LOCALE: Locale = "tn";
export const LOCALE_COOKIE = "elmadhi_locale";

export function isLocale(value: string | undefined | null): value is Locale {
  return value === "en" || value === "tn";
}

/** Text direction for a locale. */
export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "tn" ? "rtl" : "ltr";
}

/**
 * Pick the right column value for the current locale from a bilingual pair.
 * The DB stores `_en` / `_ar` suffixed columns; "tn" maps to the Arabic copy.
 */
export function pick(
  locale: Locale,
  en: string | null | undefined,
  ar: string | null | undefined,
): string {
  const value = locale === "tn" ? ar : en;
  return value ?? en ?? ar ?? "";
}

/** Minimal dictionary covering the checkout + admin surfaces. */
const STRINGS = {
  // ---- checkout ----
  "checkout.title": { en: "Choose your plan", tn: "اختر عرضك" },
  "checkout.subtitle": {
    en: "The same powerful features. Just choose how long you want to train with us.",
    tn: "نفس المزايا الكاملة. اختر فقط كم تريد أن تتمرّن معنا.",
  },
  "checkout.lifetime": { en: "Lifetime access", tn: "دخول دائم" },
  "checkout.renewal_banner": {
    en: "Your subscription has ended — pick a plan to keep your coaching going.",
    tn: "انتهى اشتراكك — اختر عرضاً لتواصل مع مدرّبك.",
  },
  "checkout.active_until": { en: "Active until", tn: "مفعّل حتى" },
  "checkout.no_plans": {
    en: "Plans are not configured yet. Please contact support.",
    tn: "العروض لم تُضبط بعد. تواصل مع الدعم.",
  },

  // ---- subscription plans ----
  "plans.standard": { en: "Standard", tn: "ستاندرد" },
  "plans.premium": { en: "Premium", tn: "بريميوم" },
  "plans.best_value": { en: "Best value", tn: "أفضل سعر" },
  "plans.duration": { en: "Duration", tn: "المدة" },
  "plans.your_choice": { en: "Your choice", tn: "اختيارك" },
  "plans.total_today": { en: "Total today", tn: "الإجمالي اليوم" },
  "plans.per_month": { en: "/month", tn: "/شهر" },
  "plans.month_1": { en: "1 month", tn: "شهر" },
  "plans.months_3": { en: "3 months", tn: "3 أشهر" },
  "plans.months_6": { en: "6 months", tn: "6 أشهر" },
  "plans.months_12": { en: "12 months", tn: "12 شهر" },
  "plans.save": { en: "Save", tn: "وفّر" },
  "plans.billed_every": { en: "billed every", tn: "تُدفع كل" },
  // One offer, four terms: the card copy is about the term, not about a tier.
  "plans.full_access": { en: "Full access", tn: "دخول كامل" },
  "plans.term_1": { en: "Full access. No commitment.", tn: "دخول كامل. بدون التزام." },
  "plans.term_3": { en: "Better results. Less per month.", tn: "نتائج أفضل. أقلّ في الشهر." },
  "plans.term_6": { en: "Most popular. Maximum value.", tn: "الأكثر طلباً. أفضل قيمة." },
  "plans.term_12": { en: "Biggest savings. Longest progress.", tn: "أكبر توفير. أطول تقدّم." },
  "checkout.choose_method": {
    en: "Choose how you want to pay",
    tn: "اختر طريقة الدفع",
  },
  "checkout.copy": { en: "Copy", tn: "نسخ" },
  "checkout.copied": { en: "Copied", tn: "تم النسخ" },
  "checkout.whatsapp_cta": {
    en: "I've paid — confirm on WhatsApp",
    tn: "دفعت — أكّد عبر واتساب",
  },
  "checkout.whatsapp_hint": {
    en: "Send us your payment screenshot on WhatsApp. We'll activate your account.",
    tn: "أرسل لنا صورة الدفع على واتساب وسنفعّل حسابك.",
  },
  "checkout.pending_title": { en: "Payment under review", tn: "الدفع قيد المراجعة" },
  "checkout.pending_body": {
    en: "We received your request. Once we confirm your payment on WhatsApp, your account will be activated.",
    tn: "وصلنا طلبك. بمجرّد تأكيد الدفع على واتساب، يُفعّل حسابك.",
  },
  "checkout.active_title": { en: "You're all set", tn: "كل شيء جاهز" },
  "checkout.active_body": {
    en: "Your account is active. Enjoy your plan!",
    tn: "حسابك مفعّل. استمتع ببرنامجك!",
  },
  "checkout.go_dashboard": { en: "Go to dashboard", tn: "إلى لوحة التحكّم" },
  "checkout.no_whatsapp": {
    en: "WhatsApp number not set yet. Please contact support.",
    tn: "رقم واتساب لم يُضبط بعد. تواصل مع الدعم.",
  },

  // ---- locked features (free account reaching a paid control) ----
  // The wall names what the user just reached for. One generic "upgrade" for
  // every control tells them nothing about what they are buying.
  "lock.title": { en: "Part of the full plan", tn: "من الاشتراك الكامل" },
  "lock.session": {
    en: "Recording your sets and reps is part of the full plan.",
    tn: "تسجيل المجموعات والتكرارات جزء من الاشتراك الكامل.",
  },
  "lock.meal_log": {
    en: "The food diary is part of the full plan.",
    tn: "يوميات الطعام جزء من الاشتراك الكامل.",
  },
  "lock.checkin": {
    en: "The morning check-in is part of the full plan.",
    tn: "تسجيل الصباح جزء من الاشتراك الكامل.",
  },
  "lock.progress": {
    en: "Progress charts are part of the full plan.",
    tn: "رسوم التقدّم جزء من الاشتراك الكامل.",
  },
  "lock.ai": {
    en: "The AI calorie camera is part of the full plan.",
    tn: "كاميرا السعرات جزء من الاشتراك الكامل.",
  },
  "lock.qa": {
    en: "Asking the coach is part of the full plan.",
    tn: "سؤال المدرّب جزء من الاشتراك الكامل.",
  },
  "lock.free_note": {
    en: "Your program and your macros stay free — always.",
    tn: "برنامجك وماكروزك يبقيان مجاناً — دائماً.",
  },
  "lock.cta": { en: "See plans", tn: "شاهد العروض" },
  "lock.not_now": { en: "Not now", tn: "ليس الآن" },

  // ---- AI walkthrough, shown to anyone not on Premium ----
  "ai.how_title": { en: "How it works", tn: "كيف تعمل" },
  "ai.how_1": { en: "Photograph your meal", tn: "صوّر وجبتك" },
  "ai.how_1_body": {
    en: "One photo from your phone camera — no weighing, no searching a database.",
    tn: "صورة واحدة بكاميرا هاتفك — بدون وزن، وبدون بحث في قاعدة بيانات.",
  },
  "ai.how_2": { en: "It reads the plate", tn: "تقرأ الصحن" },
  "ai.how_2_body": {
    en: "Each food is identified with its portion, calories and macros — and you can correct anything before it counts.",
    tn: "كل طعام يُتعرّف عليه بكميته وسعراته وماكروزه — ويمكنك تصحيح أي شيء قبل أن يُحتسب.",
  },
  "ai.how_3": { en: "It lands in your diary", tn: "يُسجَّل في يومياتك" },
  "ai.how_3_body": {
    en: "One tap logs it against today's targets, like anything else you eat.",
    tn: "ضغطة واحدة تسجّله مقابل أهداف اليوم، مثل أي شيء آخر تأكله.",
  },
  "ai.premium_only": {
    en: "Part of Premium — it costs us per photo, so it isn't in Standard.",
    tn: "من بريميوم — يكلّفنا على كل صورة، لذلك ليس في ستاندرد.",
  },

  // ---- one consolidated upgrade card, for the dashboard ----
  "up.title": { en: "Ready to start tracking?", tn: "مستعدّ لتبدأ التسجيل؟" },
  "up.body": {
    en: "Your program and your macros are free to keep. A subscription adds the daily side:",
    tn: "برنامجك وماكروزك يبقيان مجاناً. الاشتراك يضيف الجانب اليومي:",
  },
  "up.i1": { en: "Log your sets, reps and weights", tn: "سجّل مجموعاتك وتكراراتك وأوزانك" },
  "up.i2": { en: "Food diary against your macros", tn: "يوميات طعام مقابل ماكروزك" },
  "up.i3": { en: "Progress charts and the weekly review", tn: "رسوم التقدّم والمراجعة الأسبوعية" },
  "up.i4": { en: "Ask the coach your own questions", tn: "اسأل المدرّب أسئلتك أنت" },

  // ---- the journey, from the price to an open account ----
  //
  // Four steps across three routes. The step strip used to say "Step 1 of 2"
  // and count only the two screens of /checkout — which meant the account form
  // in between them was, from the reader's side, an unannounced third screen
  // in a two-screen process, and activation was not part of the count at all.
  // These labels are short because four of them share the width of a phone.
  "jn.plan": { en: "Plan", tn: "العرض" },
  "jn.account": { en: "Account", tn: "الحساب" },
  "jn.pay": { en: "Payment", tn: "الدفع" },
  "jn.access": { en: "Access", tn: "الدخول" },
  // Said on the sign-up screen, which is the one place in the flow the reader
  // is asked for something before being told why it is the next thing.
  "jn.after_account": {
    en: "Next: your payment method and the receipt. The plan and price you chose are saved.",
    tn: "بعدها: طريقة الدفع والوصل. العرض والسعر اللذان اخترتهما محفوظان.",
  },

  // ---- what happens after the button ----
  //
  // The payment here is a bank transfer confirmed by a human, and that is not
  // going to change this quarter. What can change is whether the reader finds
  // out about it before or after they commit: an unexpected step is friction,
  // the same step named in advance is just a step. Every line below is what the
  // code actually does — see actions/payment.ts and the checkout screen.
  "act.title": { en: "How activation works", tn: "كيف يُفتح حسابك" },
  "act.sub": {
    en: "Four steps from here. Nothing is charged on this page.",
    tn: "أربع خطوات من هنا. لا يُخصم منك شيء في هذه الصفحة.",
  },
  "act.s1": { en: "Create your account", tn: "أنشئ حسابك" },
  "act.s1_body": {
    en: "Name, phone, email, password — about a minute.",
    tn: "الاسم، الهاتف، البريد، كلمة السر — حوالي دقيقة.",
  },
  "act.s2": { en: "Choose how you want to pay", tn: "اختر طريقة دفعك" },
  "act.s2_body": {
    en: "Pick your method and copy the account number off the screen.",
    tn: "اختر طريقتك وانسخ رقم الحساب من الشاشة.",
  },
  "act.s3": { en: "Transfer, then attach the receipt", tn: "حوّل ثم أرفق الوصل" },
  "act.s3_body": {
    en: "The transfer itself happens in your own bank app. Come back to the same screen and attach the screenshot — that is the only thing we need from you.",
    tn: "التحويل نفسه يتمّ من تطبيق بنكك. ارجع إلى نفس الشاشة وأرفق الصورة — هذا كل ما نحتاجه منك.",
  },
  "act.s4": { en: "Your access opens", tn: "يُفتح حسابك" },
  "act.s4_body": {
    en: "A person checks the transfer, usually within a few hours, and we message you on WhatsApp. Leave this page open and it unlocks itself.",
    tn: "يتحقّق شخص من التحويل، عادةً في غضون ساعات، ونراسلك على واتساب. اترك هذه الصفحة مفتوحة وتُفتح وحدها.",
  },

  // ---- checkout, step by step ----
  "co.step": { en: "Step", tn: "خطوة" },
  "co.of": { en: "of", tn: "من" },
  "co.s1": { en: "Pick your plan", tn: "اختر عرضك" },
  // Step 2 is now the transfer *and* the receipt on one screen. They used to be
  // two, and the second one converted at 5%: a customer who had already done
  // the thing they think of as paying had no reason left to come back.
  "co.s2": { en: "Pay and send the receipt", tn: "ادفع وأرسل الوصل" },
  "co.s3": { en: "Send the receipt", tn: "أرسل الوصل" },
  "co.attach_receipt": { en: "Attach your receipt", tn: "أرفق الوصل" },
  "co.pay_and_send": {
    en: "Send the receipt and open my account",
    tn: "أرسل الوصل وافتح حسابي",
  },
  "co.later": { en: "I'll send the receipt later", tn: "سأرسل الوصل لاحقاً" },
  // What a customer sees when they come back to an order they never finished.
  // Deliberately not "we're checking your payment" — nothing is being checked
  // until a receipt exists, and saying otherwise is how 83 people ended up
  // waiting for a review that was never going to happen.
  "co.saved_title": { en: "Your order is saved", tn: "طلبك محفوظ" },
  "co.saved_body": {
    en: "Once you've made the transfer, come back here and attach the receipt — that is what opens your account.",
    tn: "بعد أن تتمّ التحويل، ارجع إلى هنا وأرفق الوصل — هو ما يفتح حسابك.",
  },
  // The wait, stated where the decision is made rather than on the screen after
  // it. Real average today is about twelve hours.
  "co.promise": {
    en: "We open your account within a few hours, and message you on WhatsApp the moment it's done.",
    tn: "نفتح حسابك في غضون ساعات، ونراسلك على واتساب فور فتحه.",
  },
  "co.next": { en: "Continue", tn: "تابع" },
  // The same button for somebody who has not made an account yet. It says what
  // the tap does, because a button labelled "continue" that produces a sign-up
  // form reads as a bait-and-switch.
  "co.next_signup": { en: "Create my account", tn: "أنشئ حسابي" },
  "co.next_signup_why": {
    en: "Takes a minute. We need it to open your plan and to reach you when your payment lands.",
    tn: "دقيقة واحدة. نحتاجه لفتح برنامجك وللوصول إليك عند وصول الدفع.",
  },
  "co.back": { en: "Back", tn: "رجوع" },
  "co.you_pay": { en: "You pay", tn: "تدفع" },
  "co.send_to": { en: "Send it to", tn: "أرسلها إلى" },
  "co.transfer_done": { en: "I've sent it", tn: "أرسلتها" },
  "co.upload_title": { en: "Send us the receipt", tn: "أرسل لنا الوصل" },
  "co.upload_body": {
    en: "A screenshot of the transfer is enough. We check it and open your account.",
    tn: "صورة للتحويل تكفي. نتحقّق منها ونفتح حسابك.",
  },
  "co.choose_file": { en: "Choose screenshot", tn: "اختر الصورة" },
  "co.change_file": { en: "Choose a different one", tn: "اختر صورة أخرى" },
  "co.note_label": { en: "Anything we should know? (optional)", tn: "هل هناك ما يجب أن نعرفه؟ (اختياري)" },
  "co.note_ph": {
    en: "e.g. I paid from my brother's account",
    tn: "مثال: دفعت من حساب أخي",
  },
  "co.submit": { en: "Send for review", tn: "أرسل للمراجعة" },
  "co.sending": { en: "Sending…", tn: "جارٍ الإرسال…" },
  "co.file_too_big": { en: "Image must be under 5 MB.", tn: "يجب أن تكون الصورة أقل من 5 ميغا." },
  "co.file_not_image": { en: "That file isn't an image.", tn: "هذا الملف ليس صورة." },
  "co.need_help": { en: "Something wrong? Message us", tn: "هل هناك مشكلة؟ راسلنا" },
  // The reassurance strip under the Continue button.
  "co.secure_title": { en: "Secure payment", tn: "دفع آمن" },
  "co.secure_body": { en: "Your data is safe", tn: "بياناتك في أمان" },
  "co.cancel_title": { en: "Cancel anytime", tn: "أوقف متى شئت" },
  "co.cancel_body": { en: "No questions asked", tn: "بدون أسئلة" },

  // ---- the payment method picker ----
  //
  // The long walkthroughs are gone from this screen. Each method gets one line
  // in the database (`hint_*`, migration 048) answering whatever the account
  // number does not already say; these are the strings around it.
  "co.method_no_account": {
    en: "This method isn't ready yet — pick another one.",
    tn: "هذه الطريقة غير جاهزة بعد — اختر واحدة أخرى.",
  },
  "co.suggest_cta": { en: "My method isn't here", tn: "طريقتي ليست موجودة" },
  "co.suggest_title": { en: "How do you want to pay?", tn: "كيف تريد أن تدفع؟" },
  "co.suggest_ph": { en: "e.g. Poste, e-Dinar, cash", tn: "مثال: البريد، e-Dinar، نقداً" },
  "co.suggest_send": { en: "Send", tn: "أرسل" },
  "co.suggest_note": {
    en: "We'll message you on WhatsApp to sort it out.",
    tn: "سنراسلك على واتساب لترتيبها.",
  },
  "co.suggest_sent": {
    en: "Got it — we'll be in touch shortly.",
    tn: "وصلتنا — سنتواصل معك قريباً.",
  },

  // ---- the app preview on checkout ----
  //
  // With the paywall in front of everything, a stranger reaches the price
  // having seen no product at all. This is the product, played back on the
  // checkout screen itself: real screens, sample numbers, and a lock on the
  // moment where the plan would become theirs.
  //
  // The sample data is labelled as sample data. A preview that pretends to be
  // the customer's own plan is a lie they discover ten seconds after paying.
  "tour.title": { en: "Look inside first", tn: "شاهد التطبيق من الداخل" },
  "tour.sub": {
    en: "Tap around — this is the app, with someone else's numbers in it.",
    tn: "تصفّحه كما تحب — هذا هو التطبيق، بأرقام شخص آخر.",
  },
  "tour.sample": { en: "Sample", tn: "نموذج" },
  "tour.skip": { en: "Skip to the plans", tn: "انتقل إلى العروض" },
  "tour.open": { en: "Open the preview", tn: "افتح المعاينة" },

  // Today
  "tour.t_greeting": { en: "Today", tn: "اليوم" },
  "tour.t_name": { en: "Yassine", tn: "ياسين" },
  "tour.t_streak": { en: "5 day streak", tn: "5 أيام متتالية" },
  "tour.t_week": { en: "Week: 2/3", tn: "الأسبوع: 2/3" },
  "tour.t_workout": { en: "Today's session", tn: "حصة اليوم" },
  "tour.t_day": { en: "Push A", tn: "دفع A" },
  "tour.t_meta": { en: "6 exercises · about 45 min", tn: "6 تمارين · حوالي 45 دقيقة" },
  "tour.t_start": { en: "Start the session", tn: "ابدأ الحصة" },
  "tour.t_checkin": { en: "Morning check-in", tn: "تسجيل الصباح" },
  "tour.t_weight": { en: "Weight", tn: "الوزن" },
  "tour.t_on_track": { en: "On track", tn: "في الطريق الصحيح" },
  "tour.t_progress": { en: "Weight, 8 weeks", tn: "الوزن، 8 أسابيع" },

  // Program
  "tour.p_title": { en: "Your program", tn: "برنامجك" },
  "tour.p_meta": { en: "3 days a week · built from your answers", tn: "3 أيام في الأسبوع · مبني على إجاباتك" },
  "tour.p_day1": { en: "Push A", tn: "دفع A" },
  "tour.p_day2": { en: "Pull B", tn: "سحب B" },
  "tour.p_day3": { en: "Legs", tn: "الأرجل" },
  "tour.p_ex1": { en: "Barbell Bench Press", tn: "ضغط بار للصدر" },
  "tour.p_ex2": { en: "Incline Dumbbell Press", tn: "ضغط دمبل مائل" },
  "tour.p_ex3": { en: "Lateral Raise", tn: "رفع جانبي" },
  "tour.p_ex4": { en: "Triceps Pushdown", tn: "دفع الترايسبس" },
  "tour.p_ex5": { en: "Cable Crossover", tn: "تقاطع الكابل" },
  "tour.p_rest": { en: "90 s rest", tn: "90 ثانية راحة" },
  "tour.p_swap": { en: "Swap an exercise", tn: "استبدل تمريناً" },

  // Nutrition
  "tour.f_title": { en: "Your meals", tn: "وجباتك" },
  "tour.f_left": { en: "left today", tn: "المتبقّي اليوم" },
  "tour.f_b": { en: "Breakfast", tn: "الفطور" },
  "tour.f_b_items": { en: "Eggs, bread, olive oil", tn: "بيض، خبز، زيت زيتون" },
  "tour.f_l": { en: "Lunch", tn: "الغداء" },
  "tour.f_l_items": { en: "Chicken, rice, salad", tn: "دجاج، أرز، سلطة" },
  "tour.f_d": { en: "Dinner", tn: "العشاء" },
  "tour.f_d_items": { en: "Tuna, couscous, vegetables", tn: "تونة، كسكسي، خضار" },
  "tour.f_s": { en: "Snack", tn: "وجبة خفيفة" },
  "tour.f_s_items": { en: "Yoghurt, almonds", tn: "ياغورت، لوز" },
  "tour.f_swap": { en: "Swap this meal", tn: "استبدل هذه الوجبة" },

  // AI camera
  "tour.ai_title": { en: "Point it at your plate", tn: "صوّر صحنك" },
  "tour.ai_sub": { en: "Premium", tn: "بريميوم" },
  "tour.ai_i1": { en: "Grilled chicken · 180 g", tn: "دجاج مشوي · 180 غ" },
  "tour.ai_i2": { en: "White rice · 150 g", tn: "أرز أبيض · 150 غ" },
  "tour.ai_i3": { en: "Olive oil · 10 g", tn: "زيت زيتون · 10 غ" },
  "tour.ai_shoot": { en: "Take a photo", tn: "التقط صورة" },

  // Q&A
  "tour.qa_title": { en: "Answers", tn: "الأسئلة" },
  "tour.qa_q1": {
    en: "Should I train if I'm still sore?",
    tn: "هل أتمرّن وأنا ما زلت أشعر بألم؟",
  },
  "tour.qa_a1": {
    en: "Mild soreness is fine — train. Sharp pain in a joint is not; move that muscle later in the week.",
    tn: "الألم الخفيف عادي — تمرّن. أما الألم الحادّ في مفصل فلا؛ أجّل تلك العضلة إلى آخر الأسبوع.",
  },
  "tour.qa_q2": {
    en: "Do I have to eat exactly what the plan says?",
    tn: "هل يجب أن آكل بالضبط ما في البرنامج؟",
  },
  "tour.qa_a2": {
    en: "No. Hit your protein and stay near the calories — swap anything else for what you actually have at home.",
    tn: "لا. أكمل البروتين وابقَ قريباً من السعرات — وبدّل أي شيء آخر بما تجده في البيت.",
  },
  "tour.qa_q3": {
    en: "How fast should I be losing weight?",
    tn: "بأي سرعة يجب أن أنقص؟",
  },
  "tour.qa_a3": {
    en: "About 0.5–1% of your bodyweight a week. Faster than that and you start giving back muscle.",
    tn: "حوالي 0.5 إلى 1% من وزنك في الأسبوع. أسرع من ذلك وتبدأ بخسارة العضل.",
  },
  "tour.qa_ask": { en: "Ask the coach", tn: "اسأل المدرّب" },

  // Inside the session
  "tour.back": { en: "Back", tn: "رجوع" },
  "tour.s_kg": { en: "kg", tn: "كغ" },
  "tour.s_reps": { en: "reps", tn: "تكرار" },
  "tour.s_done": { en: "sets done", tn: "مجموعة منجزة" },
  "tour.s_volume": { en: "Volume", tn: "الحجم" },
  "tour.s_rest": { en: "Rest 90 s", tn: "راحة 90 ثانية" },
  "tour.s_finish": { en: "Finish the session", tn: "أنهِ الحصة" },
  "tour.s_tap": { en: "Tap a set to log it", tn: "اضغط على مجموعة لتسجيلها" },

  // Inside the diary
  "tour.f_eaten": { en: "eaten", tn: "المستهلك" },
  "tour.f_target": { en: "target", tn: "الهدف" },
  "tour.f_add": { en: "Add food", tn: "أضف طعاماً" },
  "tour.f_log": { en: "Log it", tn: "سجّلها" },
  "tour.f_logged": { en: "Logged", tn: "تم التسجيل" },
  "tour.f_pick": { en: "Choose a food", tn: "اختر طعاماً" },
  "tour.fd_1": { en: "Eggs · 2", tn: "بيض · 2" },
  "tour.fd_2": { en: "Bread · 80 g", tn: "خبز · 80 غ" },
  "tour.fd_3": { en: "Tuna · 100 g", tn: "تونة · 100 غ" },
  "tour.fd_4": { en: "Chicken · 150 g", tn: "دجاج · 150 غ" },
  "tour.fd_5": { en: "Rice · 150 g", tn: "أرز · 150 غ" },
  "tour.fd_6": { en: "Yoghurt · 1", tn: "ياغورت · 1" },
  "tour.fd_7": { en: "Almonds · 30 g", tn: "لوز · 30 غ" },
  "tour.fd_8": { en: "Dates · 3", tn: "تمر · 3" },

  // The camera
  "tour.ai_scan": { en: "Reading the plate…", tn: "يقرأ الصحن…" },
  "tour.ai_add": { en: "Add to my diary", tn: "أضفها إلى يومياتي" },
  "tour.ai_retake": { en: "Take another", tn: "التقط صورة أخرى" },

  // The wall
  "tour.lock_save_title": { en: "This is the part that saves", tn: "هنا يُحفظ كل شيء" },
  "tour.lock_save_body": {
    en: "You just logged a session and a day of food. With an account it stays — the charts move, the coach adapts next week's plan, and none of it is typed twice.",
    tn: "سجّلت الآن حصة ويوماً كاملاً من الطعام. مع حساب، كل هذا يبقى — الرسوم تتحرّك، والمدرّب يعدّل برنامج الأسبوع القادم، ولا تكتب شيئاً مرتين.",
  },
  "tour.lock_title": { en: "This part becomes yours", tn: "هذا الجزء يصبح لك" },
  "tour.lock_body": {
    en: "Everything here fills with your own numbers — your split, your macros, your meals — built from eight questions. Pick a plan and we open it today.",
    tn: "كل شيء هنا يمتلئ بأرقامك أنت — تقسيمك، وماكروزك، ووجباتك — مبنيّة على ثمانية أسئلة. اختر عرضاً ونفتحه لك اليوم.",
  },
  "tour.lock_cta": { en: "Pick your plan", tn: "اختر عرضك" },
  "tour.lock_back": { en: "Keep looking", tn: "واصل التصفّح" },
  "co.review_title": { en: "We're checking your payment", tn: "نتحقّق من دفعك" },
  "co.review_body": {
    en: "Usually within a few hours. We'll message you the moment your account opens.",
    tn: "عادةً في غضون ساعات. سنراسلك فور فتح حسابك.",
  },
  "co.review_have_proof": { en: "Receipt received", tn: "وصلنا الوصل" },
  "co.review_no_proof": {
    en: "We don't have your receipt yet — sending it gets you opened up faster.",
    tn: "لم يصلنا وصلك بعد — إرساله يسرّع فتح الحساب.",
  },
  "co.meanwhile": {
    en: "Meanwhile, your program and macros are still yours to read.",
    tn: "في الأثناء، يمكنك قراءة برنامجك وماكروزك كالعادة.",
  },
  // The free tier has to be visible *on the paid page*, or landing here still
  // reads as "pay or leave" — which is the thing that broke the old funnel.
  "co.stay_free": {
    en: "Not now — keep using the free plan",
    tn: "ليس الآن — أواصل بالخطة المجانية",
  },
  "co.free_line": {
    en: "Your program and your macros stay free either way. You're paying to track against them.",
    tn: "برنامجك وماكروزك يبقيان مجاناً في كل الحالات. أنت تدفع لتسجّل عليهما.",
  },
  "co.rejected_title": {
    en: "We couldn't confirm that payment",
    tn: "لم نتمكّن من تأكيد ذلك الدفع",
  },
  "co.rejected_body": {
    en: "Nothing was taken from your account by us. Check the transfer went through, then try again — or message us and we'll sort it out.",
    tn: "لم نأخذ شيئاً من حسابك. تأكّد أن التحويل تمّ، ثم أعد المحاولة — أو راسلنا ونحلّها.",
  },

  // ---- admin: payment proof ----
  "admin.proof": { en: "Receipt", tn: "الوصل" },
  "admin.hint_en": { en: "One line, shown at checkout (EN)", tn: "سطر واحد، يظهر عند الدفع (EN)" },
  "admin.hint_ar": { en: "One line, shown at checkout (AR)", tn: "سطر واحد، يظهر عند الدفع (AR)" },
  "admin.logo_url": {
    en: "Logo URL — blank draws a monogram tile",
    tn: "رابط الشعار — إن كان فارغاً يُرسم مربّع بالحروف",
  },
  "admin.proof_none": { en: "No receipt uploaded", tn: "لا يوجد وصل مرفوع" },
  // How long this person has been waiting. The queue is newest-first, which is
  // right for confirming payments and wrong for noticing who has been left —
  // the one customer who has waited two days sits at the bottom. The badge
  // carries that to the top of each row instead of reordering the list.
  "admin.waiting_h": { en: "waiting {n}h", tn: "ينتظر {n} ساعة" },
  "admin.waiting_d": { en: "waiting {n}d", tn: "ينتظر {n} يوماً" },
  "admin.waiting_new": { en: "just now", tn: "الآن" },
  "admin.proof_note": { en: "Customer note", tn: "ملاحظة العميل" },
  "admin.proof_open": { en: "Open full size", tn: "افتح بالحجم الكامل" },

  // ---- admin ----
  "admin.title": { en: "Admin", tn: "الإدارة" },
  "admin.settings": { en: "Payment settings", tn: "إعدادات الدفع" },
  "admin.price": { en: "Price (DT)", tn: "السعر (دينار)" },
  "admin.compare_at": { en: "Compare-at price (DT)", tn: "السعر السابق (دينار)" },
  "admin.offer_en": { en: "Offer label (EN)", tn: "نص العرض (إنجليزي)" },
  "admin.offer_ar": { en: "Offer label (AR)", tn: "نص العرض (عربي)" },
  "admin.whatsapp_number": { en: "WhatsApp number", tn: "رقم واتساب" },
  "admin.msg_en": { en: "WhatsApp message (EN)", tn: "رسالة واتساب (إنجليزي)" },
  "admin.msg_ar": { en: "WhatsApp message (AR)", tn: "رسالة واتساب (عربي)" },
  "admin.methods": { en: "Payment methods", tn: "طرق الدفع" },
  "admin.method_enabled": { en: "Enabled", tn: "مفعّل" },
  "admin.account_value": { en: "Account / number / address", tn: "الحساب / الرقم / العنوان" },
  "admin.instructions_en": { en: "Instructions (EN)", tn: "الشرح (إنجليزي)" },
  "admin.instructions_ar": { en: "Instructions (AR)", tn: "الشرح (عربي)" },
  "admin.requests": { en: "Pending requests", tn: "الطلبات المعلّقة" },
  "admin.activate": { en: "Activate", tn: "فعّل" },
  "admin.reject": { en: "Reject", tn: "ارفض" },
  "admin.no_requests": { en: "No pending requests.", tn: "لا توجد طلبات معلّقة." },
  "admin.wa_confirm": { en: "WhatsApp", tn: "واتساب" },
  "admin.contacted": { en: "Contacted", tn: "تواصلنا معه" },
  "admin.not_contacted": { en: "Not contacted", tn: "لم نتواصل معه" },
  "admin.contact_all": { en: "Everyone", tn: "الكل" },
  "admin.mark_uncontacted": {
    en: "Mark as not contacted",
    tn: "أعِده إلى: لم نتواصل معه",
  },
  "admin.no_phone": {
    en: "No number yet",
    tn: "لا يوجد رقم بعد",
  },
  // Written in the *customer's* language, not the admin's — t() takes the
  // locale, so the draft arrives in the language they chose. {name} {plan}
  // {amount} are substituted before the link is built.
  "admin.wa_msg": {
    en:
      "Hi {name}, welcome to HYPE FITNESS. We received your payment request " +
      "({plan} · {amount} DT). Would you like us to walk you through activating " +
      "your account step by step?",
    tn:
      "أهلاً {name}، مرحباً بك في HYPE FITNESS. وصلنا طلب الدفع الخاص بك " +
      "({plan} · {amount} دينار). تحب نعاونك خطوة بخطوة كيفاش t’activi الcompte متاعك ؟",
  },
  "admin.save": { en: "Save", tn: "احفظ" },
  "admin.plans_title": { en: "Subscription plans", tn: "عروض الاشتراك" },
  "admin.months_short": { en: "mo", tn: "شهر" },
  "admin.saved": { en: "Saved", tn: "حُفظ" },

  // ---- admin nav ----
  "admin.nav_app": { en: "Back to app", tn: "العودة إلى التطبيق" },
  "admin.nav_payments": { en: "Payments", tn: "المدفوعات" },
  "admin.nav_foods": { en: "Foods", tn: "الأطعمة" },
  "admin.nav_exercises": { en: "Exercises", tn: "التمارين" },

  // ---- foods admin ----
  "foods.title": { en: "Foods", tn: "الأطعمة" },
  "foods.add": { en: "Add food", tn: "أضف طعاماً" },
  "foods.search": { en: "Search foods…", tn: "ابحث عن طعام…" },
  "foods.edit": { en: "Edit", tn: "عدّل" },
  "foods.delete": { en: "Delete", tn: "احذف" },
  "foods.save": { en: "Save", tn: "احفظ" },
  "foods.cancel": { en: "Cancel", tn: "إلغاء" },
  "foods.saved": { en: "Saved", tn: "حُفظ" },
  "foods.empty": { en: "No foods yet. Add the first one.", tn: "لا توجد أطعمة بعد. أضف الأول." },
  "foods.confirm_delete": { en: "Delete this food?", tn: "هل تحذف هذا الطعام؟" },
  "foods.name_ar": { en: "Name (Arabic)", tn: "الاسم (عربي)" },
  "foods.name_en": { en: "Name (English)", tn: "الاسم (إنجليزي)" },
  "foods.category": { en: "Category", tn: "الصنف" },
  "foods.calories": { en: "Calories /100g", tn: "السعرات /100غ" },
  "foods.protein": { en: "Protein /100g", tn: "البروتين /100غ" },
  "foods.carbs": { en: "Carbs /100g", tn: "الكربوهيدرات /100غ" },
  "foods.fat": { en: "Fat /100g", tn: "الدهون /100غ" },
  "foods.fiber": { en: "Fiber /100g", tn: "الألياف /100غ" },
  "foods.serving": { en: "Typical serving (g)", tn: "الحصة المعتادة (غ)" },
  "foods.price": { en: "Price (DT/kg)", tn: "السعر (دينار/كغ)" },
  "foods.price_tier": { en: "Price tier", tn: "مستوى السعر" },
  "foods.allergens": {
    en: "Allergens (separate with commas)",
    tn: "مسبّبات الحساسية — افصل بينها بفاصلة",
  },
  "foods.tags": {
    en: "Search tags (separate with commas)",
    tn: "كلمات للبحث — افصل بينها بفاصلة",
  },
  "foods.is_common": { en: "Common food", tn: "طعام شائع" },
  "foods.none": { en: "—", tn: "—" },

  // ---- image upload (shared) ----
  "image.label": { en: "Picture", tn: "الصورة" },
  "image.upload": { en: "Upload picture", tn: "أضف صورة" },
  "image.uploading": { en: "Uploading…", tn: "جارٍ الرفع…" },
  "image.remove": { en: "Remove", tn: "احذف" },
  "image.too_big": { en: "Image must be under 5 MB.", tn: "يجب أن تكون الصورة أقل من 5 ميغا." },

  // ---- exercises admin ----
  "ex.title": { en: "Exercises", tn: "التمارين" },
  "ex.add": { en: "Add exercise", tn: "أضف تمريناً" },
  "ex.search": { en: "Search exercises…", tn: "ابحث عن تمرين…" },
  "ex.edit": { en: "Edit", tn: "عدّل" },
  "ex.delete": { en: "Delete", tn: "احذف" },
  "ex.save": { en: "Save", tn: "احفظ" },
  "ex.cancel": { en: "Cancel", tn: "إلغاء" },
  "ex.empty": { en: "No exercises yet. Add the first one.", tn: "لا توجد تمارين بعد. أضف الأول." },
  "ex.confirm_delete": { en: "Delete this exercise?", tn: "هل تحذف هذا التمرين؟" },
  "ex.name_ar": { en: "Name (Arabic)", tn: "الاسم (عربي)" },
  "ex.name_en": { en: "Name (English)", tn: "الاسم (إنجليزي)" },
  "ex.primary_muscle": { en: "Primary muscle", tn: "العضلة الرئيسية" },
  "ex.secondary_muscles": {
    en: "Secondary muscles (separate with commas)",
    tn: "العضلات الثانوية — افصل بينها بفاصلة",
  },
  "ex.equipment": { en: "Equipment", tn: "المعدات" },
  "ex.movement_pattern": { en: "Movement pattern", tn: "نمط الحركة" },
  "ex.difficulty": { en: "Difficulty", tn: "الصعوبة" },
  "ex.contraindicated_for": {
    en: "Avoid with these injuries (separate with commas)",
    tn: "الإصابات التي يجب تجنّبها — افصل بينها بفاصلة",
  },
  "ex.video_url": { en: "Video URL", tn: "رابط الفيديو" },
  "ex.instructions": { en: "Instructions", tn: "الشرح" },

  // ---- landing ----
  "home.hero": {
    en: "Your personal coach for eating and training, without a coach.",
    tn: "مدرّبك للأكل والتمرين، بدون أن تدفع لمدرّب.",
  },
  "home.sub": {
    en: "Answer a few simple questions. Get a plan made for you. Edit it however you like.",
    tn: "أجب عن أسئلة بسيطة. تحصل على برنامج مصنوع لك. وعدّله كما تشاء.",
  },
  "home.cta": { en: "Get started", tn: "لنبدأ" },

  // ---- auth / login ----
  "login.signin_title": { en: "Welcome back", tn: "أهلاً بعودتك" },
  "login.signup_title": { en: "Create your account", tn: "أنشئ حسابك" },
  "login.signin_sub": {
    en: "Sign in to continue your plan.",
    tn: "سجّل الدخول لتواصل برنامجك.",
  },
  "login.signup_sub": {
    en: "Start building your diet and workout plans.",
    tn: "ابدأ ببناء برنامج طعامك وتمرينك.",
  },
  "login.full_name": { en: "Full name", tn: "الاسم الكامل" },
  "login.full_name_ph": { en: "Your name", tn: "اسمك" },
  "login.email": { en: "Email", tn: "البريد الإلكتروني" },
  "login.password": { en: "Password", tn: "كلمة السر" },
  "login.phone": { en: "WhatsApp number", tn: "رقم الواتساب" },
  "login.phone_ph": { en: "26 341 616", tn: "26 341 616" },
  "login.phone_hint": {
    en: "So we can reach you about your account.",
    tn: "لنتمكّن من التواصل معك بخصوص حسابك.",
  },

  // The /phone gate — shown once, to anyone who has no number on file. Google
  // users always land here, since OAuth never gives us one.
  "phone.title": { en: "One last thing", tn: "شيء أخير" },
  "phone.sub": {
    en: "Leave us your WhatsApp number so we can reach you about your account.",
    tn: "اترك لنا رقم الواتساب لنتمكّن من التواصل معك بخصوص حسابك.",
  },
  "phone.label": { en: "WhatsApp number", tn: "رقم الواتساب" },
  "phone.save": { en: "Save and continue", tn: "احفظ وتابع" },
  "phone.saving": { en: "Saving…", tn: "جارٍ الحفظ…" },
  "phone.invalid": {
    en: "That doesn't look like a valid mobile number.",
    tn: "هذا الرقم لا يبدو صحيحاً.",
  },
  "phone.why": {
    en: "We only use it to contact you about your subscription. Never shared.",
    tn: "نستعمله فقط للتواصل معك بخصوص اشتراكك. ولا نشاركه مع أحد.",
  },
  "login.please_wait": { en: "Please wait…", tn: "انتظر قليلاً…" },
  "login.sign_in": { en: "Sign in", tn: "سجّل الدخول" },
  "login.create_account": { en: "Create account", tn: "أنشئ حساباً" },
  "login.or": { en: "or", tn: "أو" },
  "login.google": { en: "Continue with Google", tn: "تابع بـ Google" },
  "login.no_account": { en: "No account?", tn: "ليس لديك حساب؟" },
  "login.create_one": { en: "Create one", tn: "أنشئ واحداً" },
  "login.have_account": {
    en: "Already have an account?",
    tn: "لديك حساب؟",
  },
  "login.sign_in_link": { en: "Sign in", tn: "سجّل الدخول" },
  "login.failed": {
    en: "Sign-in failed. Please try again.",
    tn: "فشل تسجيل الدخول. أعد المحاولة.",
  },
  // What a failed sign-in or sign-up actually says. The auth server's own
  // messages are English whatever the user is reading, and some of them are
  // not sentences at all (a JSON parse error, when something between us and
  // Supabase returns a page instead of an answer). `actions/auth.ts` maps
  // every failure onto one of these codes.
  "login.err_bad_credentials": {
    en: "Wrong email or password.",
    tn: "البريد الإلكتروني أو كلمة السر غير صحيحة.",
  },
  "login.err_email_taken": {
    en: "That email already has an account — sign in instead.",
    tn: "هذا البريد له حساب بالفعل — سجّل الدخول به.",
  },
  "login.err_weak_password": {
    en: "Pick a longer password — at least 6 characters.",
    tn: "اختر كلمة سر أطول — 6 أحرف على الأقل.",
  },
  "login.err_email_unconfirmed": {
    en: "Confirm your email first — check your inbox.",
    tn: "أكّد بريدك أولاً — تحقّق من صندوق الوارد.",
  },
  "login.err_rate_limited": {
    en: "Too many attempts. Wait a minute and try again.",
    tn: "محاولات كثيرة. انتظر دقيقة وأعد المحاولة.",
  },
  "login.err_unavailable": {
    en: "We couldn't reach the server. Check your connection and try again.",
    tn: "لم نتمكّن من الوصول إلى الخادم. تحقّق من اتصالك وأعد المحاولة.",
  },
  "login.check_inbox": {
    en: "Check your inbox to confirm your email, then sign in.",
    tn: "تحقّق من بريدك لتأكيده، ثم سجّل الدخول.",
  },
  "login.choose_title": { en: "Where to?", tn: "إلى أين؟" },
  "login.choose_sub": {
    en: "You're an admin. Pick where to go.",
    tn: "أنت مشرف. اختر إلى أين تذهب.",
  },
  "login.go_admin": { en: "Admin panel", tn: "لوحة المشرف" },
  "login.go_app": { en: "Continue to the app", tn: "تابع إلى التطبيق" },

  // ---- common ----
  "common.error": { en: "Something went wrong.", tn: "حدث خطأ." },
  "common.error_title": {
    en: "That didn't go through",
    tn: "لم تنجح العملية",
  },
  "common.error_body": {
    en: "The connection dropped for a second. Nothing you saved was lost — try again.",
    tn: "انقطع الاتصال لحظة. ما حفظته لم يضع — أعد المحاولة.",
  },
  "common.retry": { en: "Try again", tn: "أعد المحاولة" },
  "common.go_home": { en: "Back to Home", tn: "العودة إلى الرئيسية" },

  // ---- app bottom nav ----
  "nav.home": { en: "Home", tn: "الرئيسية" },
  "nav.workouts": { en: "Workouts", tn: "التمارين" },
  "nav.nutrition": { en: "Nutrition", tn: "الأكل" },
  "nav.ai": { en: "AI", tn: "ذكاء" },
  "nav.qa": { en: "Q&A", tn: "أسئلة" },
  "nav.profile": { en: "Profile", tn: "حسابي" },

  // ---- dashboard ----
  "dashboard.greeting": { en: "Welcome back", tn: "أهلاً بك" },
  "dashboard.diet_title": { en: "Your diet", tn: "طعامك" },
  "dashboard.diet_not_started": {
    en: "Answer a few questions to get your plan.",
    tn: "أجب عن بضعة أسئلة لتحصل على برنامجك.",
  },
  "dashboard.workout_title": { en: "Your workout", tn: "تمرينك" },
  "dashboard.workout_not_started": {
    en: "Answer a few questions to get your program.",
    tn: "أجب عن بضعة أسئلة لتحصل على برنامجك.",
  },
  "dashboard.qa_title": { en: "Learn", tn: "تعلّم" },
  "dashboard.qa_sub": {
    en: "Answers to the most common fitness questions.",
    tn: "إجابات على أكثر الأسئلة شيوعاً.",
  },
  "dashboard.status_active": { en: "Active", tn: "نشط" },
  "dashboard.status_not_started": { en: "Not started", tn: "لم يبدأ بعد" },
  "dashboard.cta_start": { en: "Get started", tn: "لنبدأ" },
  "dashboard.cta_view": { en: "View plan", tn: "شاهد البرنامج" },
  "dashboard.cta_explore": { en: "Explore", tn: "اكتشف" },
  "dashboard.hero_eyebrow_plan": { en: "Your plan", tn: "برنامجك" },
  "dashboard.hero_eyebrow_setup": { en: "Get started", tn: "لنبدأ" },
  "dashboard.nutrition_label": { en: "Nutrition", tn: "الطعام" },
  "dashboard.training_label": { en: "Training", tn: "التمرين" },
  "dashboard.not_setup": { en: "Not set up yet", tn: "لم يُضبط بعد" },
  "dashboard.days_per_week_suffix": { en: "days/week", tn: "أيام/الأسبوع" },

  // ---- Q&A spark (dashboard random question card) ----
  "qa.spark_eyebrow": { en: "From the Q&A library", tn: "من مكتبة الأسئلة" },
  "qa.another": { en: "Show another question", tn: "أرني سؤالاً آخر" },
  "qa.open_answer": { en: "Open full answer", tn: "شاهد الإجابة كاملة" },

  // ---- settings ----
  "settings.title": { en: "Settings", tn: "الإعدادات" },
  "settings.language": { en: "Language", tn: "اللغة" },
  "settings.redo_diet": { en: "Redo my diet goals", tn: "أعد ضبط أهداف الطعام" },
  "settings.redo_workout": { en: "Redo my workout goals", tn: "أعد ضبط أهداف التمرين" },
  "settings.sign_out": { en: "Sign out", tn: "تسجيل الخروج" },
  "settings.admin_panel": { en: "Admin panel", tn: "لوحة المشرف" },
  "settings.edit_mode": { en: "Edit mode", tn: "وضع التعديل" },

  // ---- monthly plan rebuild allowance ----
  "redo.remaining": {
    en: "{remaining} of {total} left this month",
    tn: "بقي لك {remaining} من {total} هذا الشهر",
  },
  "redo.none_left": {
    en: "No rebuilds left this month — you can redo it next month.",
    tn: "لم يبقَ لك تبديل هذا الشهر — يمكنك الإعادة الشهر القادم.",
  },
  "redo.limit_title": { en: "Come back next month", tn: "ارجع الشهر القادم" },
  "redo.quota_blocked": {
    en: "You've used all {total} plan rebuilds for this month. Give this plan a real chance — you can redo it next month.",
    tn: "استعملت كل {total} إعادات بناء البرنامج هذا الشهر. أعطِ هذا البرنامج فرصة حقيقية — يمكنك الإعادة الشهر القادم.",
  },
  "redo.back_to_settings": { en: "Back to settings", tn: "العودة إلى الإعدادات" },

  // ---- diet maker: questions ----
  "diet.q_gender": { en: "Are you a man or a woman?", tn: "أنت رجل أم امرأة؟" },
  "diet.gender_male": { en: "Man", tn: "رجل" },
  "diet.gender_female": { en: "Woman", tn: "امرأة" },
  "diet.q_birthdate": { en: "How old are you?", tn: "كم عمرك؟" },
  "diet.q_height": { en: "How tall are you?", tn: "كم طولك؟" },
  "diet.q_weight": { en: "What's your weight right now?", tn: "كم وزنك الآن؟" },
  "diet.q_goal": { en: "What do you want?", tn: "ما الذي تريده؟" },
  "diet.goal_lose_fat": { en: "Lose fat", tn: "إنقاص الدهون" },
  "diet.goal_maintain": { en: "Stay the same, get healthier", tn: "الحفاظ على الوزن وتحسين الصحة" },
  "diet.goal_build_muscle": { en: "Build muscle", tn: "بناء العضلات" },
  "diet.goal_recomp": { en: "Lose fat and build muscle together", tn: "إنقاص الدهون وبناء العضلات معاً" },
  // Occupational activity only. Training used to be folded in here and into a
  // separate step bonus; the simplified calculator leaves both out and lets the
  // weekly calibration find the real number instead.
  "diet.q_activity": { en: "How does your day usually look?", tn: "كيف يمرّ يومك عادةً؟" },
  "diet.activity_sedentary": { en: "Sitting almost all day", tn: "أجلس أغلب اليوم" },
  "diet.activity_light": { en: "A mix of sitting and standing", tn: "بين الجلوس والوقوف" },
  "diet.activity_moderate": { en: "On my feet, walking a lot", tn: "واقف وأمشي كثيراً" },
  "diet.activity_active": { en: "Physical job", tn: "عمل فيه مجهود" },
  "diet.activity_very_active": { en: "Very physical job", tn: "عمل فيه مجهود كبير" },
  "diet.q_meals": { en: "How many times a day do you eat?", tn: "كم مرة تأكل في اليوم؟" },
  "diet.q_budget": { en: "What's your food budget like?", tn: "كيف هي ميزانيتك للطعام؟" },
  "diet.budget_low": { en: "Tight, I need cheap options", tn: "ضيّقة، أحتاج خيارات رخيصة" },
  "diet.budget_medium": { en: "Normal, comfortable", tn: "عادية، مريحة" },
  "diet.budget_high": { en: "Not a concern", tn: "ليست مشكلة" },
  "diet.q_allergies": { en: "Anything you can't eat?", tn: "هل هناك شيء لا تستطيع أكله؟" },
  "diet.q_disliked": { en: "Anything you really don't like?", tn: "هل هناك شيء لا تحبّه فعلاً؟" },
  "diet.q_restriction": { en: "Any way of eating you follow?", tn: "هل تتّبع نظام أكل معيّن؟" },
  "diet.restriction_none": { en: "No restriction", tn: "بدون قيود" },
  "diet.restriction_vegetarian": { en: "Vegetarian", tn: "نباتي" },
  "diet.restriction_pescatarian": { en: "Pescatarian", tn: "نباتي + سمك" },
  "diet.restriction_halal": { en: "Halal only", tn: "حلال فقط" },
  "diet.budget_no_pref": { en: "No preference", tn: "لا تفضيل لديّ" },

  // ---- professional questionnaire (20 Q) ----
  "diet.q_target_weight": { en: "What weight are you aiming for?", tn: "ما الوزن الذي تريد الوصول إليه؟" },
  "diet.q_bodyfat_pct": { en: "Do you know your body fat %?", tn: "هل تعرف نسبة الدهون في جسمك؟" },
  "diet.q_bodyfat_pct_hint": {
    en: "Only if you've actually measured it — a caliper, a scan or a smart scale. Skip this if you don't know: we'll work it out from your height, weight and age instead.",
    tn: "فقط إذا قسْتها فعلاً — بالكاليبر أو سكانر أو ميزان ذكي. إن كنت لا تعرفها فتجاوز السؤال: نحسبها من الطول والوزن والعمر.",
  },
  "diet.q_training_days": { en: "How many days do you train a week?", tn: "كم يوماً تتمرّن في الأسبوع؟" },
  "diet.td_0": { en: "0 days", tn: "0 يوم" },
  "diet.td_1_2": { en: "1–2 days", tn: "1–2 يوم" },
  "diet.td_3_4": { en: "3–4 days", tn: "3–4 أيام" },
  "diet.td_5_6": { en: "5–6 days", tn: "5–6 أيام" },
  "diet.td_7": { en: "7 days", tn: "7 أيام" },
  "diet.q_training_time": { en: "When do you usually train?", tn: "متى تتمرّن عادةً؟" },
  "diet.tt_morning": { en: "Morning", tn: "الصباح" },
  "diet.tt_afternoon": { en: "Afternoon", tn: "بعد الظهر" },
  "diet.tt_evening": { en: "Evening", tn: "المساء" },
  "diet.tt_night": { en: "Night", tn: "الليل" },
  "diet.tt_changes": { en: "It changes", tn: "يتغيّر" },
  "diet.q_restrictions": { en: "Any food restriction?", tn: "هل هناك قيود على طعامك؟" },
  "diet.restr_none": { en: "No restriction", tn: "بدون قيود" },
  "diet.restr_no_red_meat": { en: "No red meat", tn: "بدون لحم أحمر" },
  "diet.restr_no_fish": { en: "No fish / seafood", tn: "بدون سمك أو مأكولات بحرية" },
  "diet.restr_no_dairy": { en: "No dairy", tn: "بدون حليب ومشتقاته" },
  "diet.restr_no_eggs": { en: "No eggs", tn: "بدون بيض" },
  "diet.restr_vegetarian": { en: "Vegetarian", tn: "نباتي" },
  "diet.q_avoid": { en: "Any foods you'd rather avoid?", tn: "هل هناك أطعمة تفضّل تجنّبها؟" },
  "diet.avoid_none": { en: "I eat everything", tn: "آكل كل شيء" },
  "diet.avoid_chicken": { en: "Chicken", tn: "دجاج" },
  "diet.avoid_eggs": { en: "Eggs", tn: "بيض" },
  "diet.avoid_tuna": { en: "Tuna", tn: "تونة" },
  "diet.avoid_fish": { en: "Fish / seafood", tn: "سمك ومأكولات بحرية" },
  "diet.avoid_dairy": { en: "Milk / dairy", tn: "حليب ومشتقاته" },
  "diet.avoid_rice": { en: "Rice", tn: "أرز" },
  "diet.avoid_pasta": { en: "Pasta", tn: "معكرونة" },
  "diet.avoid_bread": { en: "Bread", tn: "خبز" },
  "diet.avoid_oats": { en: "Oats", tn: "شوفان" },
  "diet.avoid_legumes": { en: "Legumes", tn: "بقوليات" },
  "diet.avoid_vegetables": { en: "Vegetables", tn: "خضار" },
  "diet.q_cooking": { en: "How much time for cooking?", tn: "كم من الوقت لديك للطبخ؟" },
  "diet.cook_fast": { en: "Fast meals only", tn: "وجبات سريعة فقط" },
  "diet.cook_normal": { en: "Normal cooking", tn: "طبخ عادي" },
  "diet.cook_mealprep": { en: "Meal prep for several days", tn: "أحضّر لعدة أيام" },
  "diet.cook_no_pref": { en: "No preference", tn: "لا تفضيل لديّ" },
  "diet.q_digestion": { en: "Any digestion issues?", tn: "هل لديك مشاكل هضم؟" },
  "diet.dig_none": { en: "No", tn: "لا" },
  "diet.dig_bloating": { en: "Bloating", tn: "انتفاخ" },
  "diet.dig_lactose": { en: "Lactose problem", tn: "مشكلة مع اللاكتوز" },
  "diet.dig_high_fiber": { en: "High fiber bothers me", tn: "الألياف الكثيرة تتعبني" },
  "diet.dig_heavy_pre": { en: "Heavy meals before workout bother me", tn: "الوجبات الثقيلة قبل التمرين تتعبني" },
  "diet.q_water": { en: "How much water do you drink a day?", tn: "كم تشرب من الماء في اليوم؟" },
  "diet.water_lt1": { en: "Less than 1L", tn: "أقل من 1 لتر" },
  "diet.water_1_2": { en: "1–2L", tn: "1–2 لتر" },
  "diet.water_2_3": { en: "2–3L", tn: "2–3 لتر" },
  "diet.water_gt3": { en: "More than 3L", tn: "أكثر من 3 لتر" },
  "diet.water_unknown": { en: "I don't know", tn: "لا أعرف" },
  "diet.q_supplements": { en: "Do you use any supplements?", tn: "تستعمل مكمّلات؟" },
  "diet.supp_none": { en: "No supplements", tn: "بدون مكمّلات" },
  "diet.supp_whey": { en: "Whey protein", tn: "واي بروتين" },
  "diet.supp_creatine": { en: "Creatine", tn: "كرياتين" },
  "diet.supp_multivitamin": { en: "Multivitamin", tn: "ملتي فيتامين" },
  "diet.supp_omega3": { en: "Omega 3", tn: "أوميغا 3" },
  "diet.q_tracking": { en: "Have you tracked calories before?", tn: "هل حسبت السعرات من قبل؟" },
  "diet.track_never": { en: "No, never", tn: "لا، أبداً" },
  "diet.track_sometimes": { en: "Yes, sometimes", tn: "نعم، أحياناً" },
  "diet.track_expert": { en: "Yes, I know how to track", tn: "نعم، أعرف كيف أحسب" },
  "diet.water_advice": {
    en: "Aim for about 3L of water a day.",
    tn: "حاول أن تشرب حوالي 3 لتر ماء في اليوم.",
  },

  "diet.rationale_title": { en: "Why we picked this for you", tn: "لماذا اخترنا لك هذا" },
  "diet.rationale_bmr": { en: "Base metabolism", tn: "الأيض الأساسي" },
  "diet.rationale_tdee": { en: "Your daily burn", tn: "حرقك اليومي" },
  "diet.rationale_target": { en: "Your daily target", tn: "هدفك اليومي" },
  "diet.see_plan": { en: "See my plan", tn: "شاهد برنامجي" },
  "diet.redo_confirm": {
    en: "This will archive your current plan and ask the questions again.",
    tn: "سيُحفظ برنامجك الحالي وتُطرح عليك الأسئلة من جديد.",
  },

  // ---- workout maker ----
  // The 19 question texts and their options live in `questionnaire_questions`
  // (EN + AR columns), not here — migration 019/022. Only UI chrome remains.
  "workout.rationale_title": { en: "Why we picked this for you", tn: "لماذا اخترنا لك هذا" },
  "workout.see_program": { en: "See my program", tn: "شاهد برنامجي" },

  // ---- q&a ----
  "qa.title": { en: "Q&A Library", tn: "مكتبة الأسئلة" },
  "qa.subtitle": { en: "Learn, ask, and level up.", tn: "تعلّم، اسأل، وتطوّر." },
  "qa.search": { en: "Search a question…", tn: "ابحث عن سؤال…" },
  "qa.category_all": { en: "All", tn: "الكل" },
  "qa.ask_title": { en: "Can't find your answer?", tn: "لم تجد إجابتك؟" },
  "qa.ask_sub": {
    en: "Ask your question and we'll add it to the library.",
    tn: "اطرح سؤالك وسنضيفه إلى المكتبة.",
  },
  "qa.ask_cta": { en: "Ask a question", tn: "اطرح سؤالاً" },
  "qa.ask_placeholder": { en: "Type your question…", tn: "اكتب سؤالك…" },
  "qa.ask_sent": { en: "Thanks — we'll review it soon.", tn: "شكراً — سنراجعه قريباً." },
  "qa.empty": { en: "No questions in this category yet.", tn: "لا توجد أسئلة في هذا القسم بعد." },
  "qa.answered_banner": { en: "We answered your question", tn: "أجبنا على سؤالك" },
  "qa.answered_read": { en: "Read the answer", tn: "اقرأ الإجابة" },

  // ---- q&a: the visual answer card (blocks are labelled, never a wall of text) ----
  "qa.block_question": { en: "The question", tn: "السؤال" },
  "qa.block_short_answer": { en: "Quick answer", tn: "الجواب السريع" },
  "qa.block_science": { en: "Why?", tn: "لماذا؟" },
  "qa.block_practical": { en: "What to do", tn: "ماذا تفعل؟" },
  "qa.block_mistake": { en: "Common mistake", tn: "خطأ شائع" },
  "qa.block_tip": { en: "HYPE FITNESS tip", tn: "نصيحة HYPE FITNESS" },
  "qa.block_warning": { en: "Heads up", tn: "تنبيه" },
  "qa.block_more": { en: "More detail", tn: "تفاصيل زيادة" },
  "qa.level": { en: "Level", tn: "المستوى" },
  "qa.level_beginner": { en: "Beginner", tn: "مبتدئ" },
  "qa.level_intermediate": { en: "Intermediate", tn: "متوسط" },
  "qa.level_advanced": { en: "Advanced", tn: "متقدم" },
  "qa.level_safety": { en: "Safety", tn: "سلامة" },
  "qa.read_time": { en: "Read time", tn: "وقت القراءة" },
  "qa.seconds": { en: "sec", tn: "ثانية" },

  // ---- q&a: monthly ask quota ----
  "qa.quota_left": {
    en: "{n} of {total} questions left this month",
    tn: "بقي {n} من {total} أسئلة هذا الشهر",
  },
  "qa.quota_none": {
    en: "You've used your {total} questions for this month. The counter resets on the 1st.",
    tn: "استهلكت {total} أسئلة هذا الشهر. العدّاد يُصفّر في الأول من الشهر القادم.",
  },
  "qa.quota_blocked": {
    en: "No questions left this month.",
    tn: "لم تبقَ أسئلة هذا الشهر.",
  },

  // ---- workout: start session ----
  "workout.start_day": { en: "Start this workout", tn: "ابدأ الحصة" },
  "workout.continue_day": { en: "Continue workout", tn: "أكمل الحصة" },
  "workout.day_done": { en: "Completed", tn: "اكتملت" },
  "workout.locked_until_monday": { en: "Locked until Monday", tn: "مقفلة حتى الاثنين" },

  // ---- workout session mode ----
  "session.kg": { en: "kg", tn: "كغ" },
  "session.reps": { en: "Reps", tn: "تكرارات" },
  "session.rir": { en: "RIR", tn: "RIR" },
  "session.rest": { en: "rest", tn: "راحة" },
  "session.resting": { en: "Rest", tn: "راحة" },
  "session.skip_rest": { en: "Skip rest", tn: "تجاوز الراحة" },
  "session.skip_exercise": { en: "Skip", tn: "تجاوز" },
  "session.unskip_exercise": { en: "Undo", tn: "تراجع" },
  "session.last_time": { en: "Last time", tn: "المرة السابقة" },
  "session.add_set": { en: "Add set", tn: "أضف مجموعة" },
  "session.progress_sets": { en: "sets", tn: "مجموعات" },
  "session.notes_label": { en: "Session notes (optional)", tn: "ملاحظات على الحصة (اختياري)" },
  "session.finish": { en: "Finish workout", tn: "أنهِ الحصة" },
  "session.saving": { en: "Saving…", tn: "جارٍ الحفظ…" },
  "session.save_error": {
    en: "Couldn't save — your session is kept safely on this phone. Check your connection and try again.",
    tn: "لم نتمكّن من الحفظ — حصتك محفوظة في هاتفك. تحقّق من الاتصال وأعد المحاولة.",
  },
  "session.done_title": { en: "Workout complete!", tn: "اكتملت الحصة!" },
  "session.done_sub": {
    en: "Logged and counted. See you next session.",
    tn: "سُجّلت واحتُسبت. نراك في الحصة القادمة.",
  },
  "session.stat_sets": { en: "Sets", tn: "مجموعات" },
  "session.stat_volume": { en: "Volume (kg)", tn: "الحجم (كغ)" },
  "session.stat_minutes": { en: "Minutes", tn: "دقائق" },
  "session.pr_badge": { en: "New PR!", tn: "رقم جديد!" },
  "session.pr_title": { en: "New personal records", tn: "أرقام قياسية جديدة" },
  "session.back_home": { en: "Back to home", tn: "العودة إلى اللوحة" },

  // ---- live sessions: resume / weekly lock / sync ----
  "session.continue": { en: "Continue workout", tn: "أكمل الحصة" },
  "session.other_in_progress": {
    en: "You already have a workout in progress",
    tn: "لديك حصة أخرى مفتوحة الآن",
  },
  "session.started_ago": { en: "Started", tn: "بدأتها" },
  "session.discard": { en: "Discard empty session", tn: "احذف الحصة الفارغة" },
  "session.week_locked": {
    en: "Done this week — unlocks Monday",
    tn: "أُنجزت هذا الأسبوع — تُفتح يوم الاثنين",
  },
  "session.locked_title": { en: "This workout is completed", tn: "هذه الحصة أنهيتها" },
  "session.locked_sub": {
    en: "Great work. It unlocks again on Monday — here's how it went.",
    tn: "أحسنت. تُفتح من جديد يوم الاثنين — وهذا ملخّصها.",
  },
  "session.skip_confirm": { en: "Skip for good?", tn: "هل تتجاوزها نهائياً؟" },
  "session.skipped_label": { en: "Skipped", tn: "متجاوَزة" },
  "session.sync_saved": { en: "All sets saved", tn: "حُفظت كل المجموعات" },
  "session.sync_saving": { en: "Saving…", tn: "جارٍ الحفظ…" },
  "session.sync_offline": {
    en: "Offline — will sync",
    tn: "لا يوجد اتصال — سيُحفظ عند عودته",
  },
  "session.sync_offline_finish": {
    en: "Can't finish while offline — your sets are safe, retry when you're back online.",
    tn: "لا يمكن الإنهاء بدون اتصال — مجموعاتك محفوظة، أعد المحاولة عند عودة الشبكة.",
  },
  "session.stat_prs": { en: "PRs", tn: "أرقام قياسية" },

  // ---- cardio (the default module: speed walking) ----
  "cardio.title": { en: "Cardio", tn: "كارديو" },
  "cardio.speed_walking": { en: "Speed Walking", tn: "مشي سريع" },
  "cardio.add": { en: "Add cardio to this day", tn: "أضف كارديو لهذا اليوم" },
  "cardio.remove": { en: "Remove cardio", tn: "احذف الكارديو" },
  "cardio.min": { en: "min", tn: "دقيقة" },
  "cardio.less": { en: "Five minutes less", tn: "خمس دقائق أقل" },
  "cardio.more": { en: "Five minutes more", tn: "خمس دقائق أكثر" },
  "cardio.intensity": {
    en: "Moderate pace — you should feel the effort but still be able to talk. On a treadmill: 5.5–6.5 km/h, 0–6% incline.",
    tn: "وتيرة متوسّطة — تشعر بالجهد لكن تستطيع الكلام. على السير: 5.5–6.5 كم/س، ميلان 0–6%.",
  },
  // The sheet's user message. Both halves matter: people assume cardio either
  // buys them food or replaces a session, and it does neither.
  "cardio.why": {
    en: "Speed Walking is added to improve your heart health, metabolism, recovery and conditioning. It does not change your food calories and it does not replace your workout.",
    tn: "أُضيف المشي السريع لتحسين صحة قلبك وأيضك واستشفائك ولياقتك. لا يغيّر سعرات طعامك ولا يعوّض تمرينك.",
  },
  "cardio.schedule": {
    en: "For your level: {times}× a week, {minutes} minutes.",
    tn: "حسب مستواك: {times} مرات في الأسبوع، {minutes} دقيقة.",
  },
  "cardio.avoid_legs": {
    en: "This is a lower-body day — cardio sits better after a push, pull or upper day, or on a rest day.",
    tn: "هذا يوم الأرجل — الكارديو أنسب بعد يوم دفع أو سحب أو علوي، أو في يوم راحة.",
  },
  "cardio.log_title": { en: "Finish with your walk", tn: "أنهِ بالمشي" },
  "cardio.log_cta": { en: "Log cardio", tn: "سجّل الكارديو" },
  "cardio.logged": { en: "Cardio logged", tn: "سُجّل الكارديو" },
  "cardio.burned": { en: "kcal burned", tn: "سعرة محروقة" },
  "cardio.burned_note": {
    en: "Burned calories are an estimate. They are not added back to your food targets.",
    tn: "السعرات المحروقة تقدير. لا تُضاف إلى أهداف طعامك.",
  },
  "session.stat_cardio": { en: "Cardio min", tn: "دقائق كارديو" },
  "session.need_reps": { en: "Enter reps first", tn: "أدخل التكرارات أولاً" },
  "session.already_logged": {
    en: "Already logged this session",
    tn: "مسجّلة بالفعل في هذه الحصة",
  },
  "session.locked_set": { en: "Logged", tn: "سُجّلت" },
  "session.go_program": { en: "Back to program", tn: "العودة إلى البرنامج" },

  // ---- dashboard: progress teaser ----
  "dashboard.progress_title": { en: "Your progress", tn: "تقدّمك" },
  "dashboard.progress_cta": { en: "See details", tn: "شوف التفاصيل" },

  // ---- progress page ----
  "progress.title": { en: "Progress", tn: "التقدّم" },
  "progress.subtitle": {
    en: "What your logging says about you.",
    tn: "ما تقوله أرقامك عنك.",
  },
  "progress.weight_title": { en: "Body weight", tn: "وزن الجسم" },
  "progress.strength_title": { en: "Strength", tn: "القوة" },
  "progress.volume_week": { en: "Weekly volume (kg)", tn: "الحجم في الأسبوع (كغ)" },
  "progress.consistency_title": { en: "Consistency", tn: "الانتظام" },
  "progress.muscles_title": { en: "By muscle group", tn: "حسب العضلة" },
  "progress.muscles_sub": {
    en: "Volume, last 4 weeks vs the 4 before",
    tn: "الحجم، آخر 4 أسابيع مقابل الـ4 التي قبلها",
  },
  "progress.top_exercises": { en: "Top exercises", tn: "أهم التمارين" },
  "progress.range_30": { en: "30 days", tn: "30 يوماً" },
  "progress.range_90": { en: "90 days", tn: "90 يوماً" },
  "progress.trend_up": { en: "trending up", tn: "في صعود" },
  "progress.trend_down": { en: "trending down", tn: "في نزول" },
  "progress.trend_flat": { en: "steady", tn: "ثابت" },
  "progress.sessions_label": { en: "sessions", tn: "حصص" },
  "progress.week_streak": { en: "week streak", tn: "أسبوع متتالٍ" },
  "progress.this_week": { en: "this week", tn: "هذا الأسبوع" },
  "progress.prior_label": { en: "before", tn: "قبل" },
  "progress.recent_label": { en: "recent", tn: "مؤخراً" },
  "progress.empty": {
    en: "Log a few workouts and check-ins to see your progress here.",
    tn: "سجّل بضع حصص وتسجيلات صباح لترى تقدّمك هنا.",
  },
  "progress.empty_weight": {
    en: "Log your weight in the morning check-in to see the trend.",
    tn: "سجّل وزنك في تسجيل الصباح لترى المنحنى.",
  },
  "progress.empty_strength": {
    en: "Finish a few workouts to see your strength build up.",
    tn: "أنهِ بضع حصص لترى قوّتك وهي تتقدّم.",
  },

  // ---- muscle groups ----
  "muscle.chest": { en: "Chest", tn: "الصدر" },
  "muscle.back": { en: "Back", tn: "الظهر" },
  "muscle.shoulders": { en: "Shoulders", tn: "الأكتاف" },
  "muscle.quads": { en: "Quads", tn: "الفخذ الأمامي" },
  "muscle.hamstrings": { en: "Hamstrings", tn: "الفخذ الخلفي" },
  "muscle.glutes": { en: "Glutes", tn: "الأرداف" },
  "muscle.calves": { en: "Calves", tn: "السمانة" },
  "muscle.biceps": { en: "Biceps", tn: "بايسبس" },
  "muscle.triceps": { en: "Triceps", tn: "ترايسبس" },
  "muscle.core": { en: "Core", tn: "البطن" },
  "muscle.forearms": { en: "Forearms", tn: "الساعد" },

  // ---- today screen: check-in ----
  "checkin.title": { en: "Morning check-in", tn: "تسجيل الصباح" },
  "checkin.subtitle": { en: "15 seconds — it powers your coaching.", tn: "15 ثانية — بها نتابع تقدّمك." },
  "checkin.weight": { en: "Weight (kg)", tn: "الوزن (كغ)" },
  "checkin.energy_1": { en: "Exhausted", tn: "منهك" },
  "checkin.energy_2": { en: "Low", tn: "ضعيفة" },
  "checkin.energy_3": { en: "Okay", tn: "لا بأس" },
  "checkin.energy_4": { en: "Good", tn: "جيّدة" },
  "checkin.energy_5": { en: "On fire", tn: "في القمة" },
  "checkin.sleep": { en: "Sleep (hours)", tn: "النوم (ساعات)" },
  "checkin.energy": { en: "Energy today", tn: "طاقتك اليوم" },
  "checkin.save": { en: "Save check-in", tn: "احفظ" },
  "checkin.saving": { en: "Saving…", tn: "جارٍ الحفظ…" },
  "checkin.done": { en: "Checked in for today", tn: "اكتمل تسجيل اليوم" },
  "checkin.edit": { en: "Edit", tn: "عدّل" },

  // ---- today screen ----
  "today.workout_title": { en: "Today's workout", tn: "تمرين اليوم" },
  "today.start_workout": { en: "Start workout", tn: "ابدأ التمرين" },
  "today.continue_workout": { en: "Continue workout", tn: "أكمل الحصة" },
  "today.workout_done": { en: "Workout done today", tn: "اكتمل تمرين اليوم" },
  "today.no_program": { en: "No program yet — build yours in 2 minutes.", tn: "لا يوجد برنامج بعد — ابنِه في دقيقتين." },
  "today.build_program": { en: "Build my program", tn: "ابنِ برنامجي" },
  "today.week_label": { en: "This week", tn: "هذا الأسبوع" },
  "today.sessions_label": { en: "workouts", tn: "حصص" },
  "today.streak_label": { en: "day check-in streak", tn: "يوم تسجيل متتالٍ" },
  "today.open_plan": { en: "Open plan", tn: "افتح البرنامج" },
  "today.see_workout": { en: "See the workout", tn: "شاهد التمرين" },
  "today.qa_answered": { en: "Your question was answered!", tn: "تمّت الإجابة على سؤالك!" },
  "today.rest_day": {
    en: "Rest day — recovery is where you grow.",
    tn: "اليوم راحة — الجسم ينمو وقت الراحة.",
  },
  "today.exercises": { en: "exercises", tn: "تمارين" },

  // ---- plan food swap ----
  "plan.swap_food": { en: "Swap this food", tn: "استبدل هذا الطعام" },
  "plan.swap_for": { en: "Swap for", tn: "استبدله بـ" },
  "plan.no_alternatives": {
    en: "No alternatives for this food yet.",
    tn: "لا توجد بدائل لهذا الطعام بعد.",
  },

  // ---- nutrition section tabs ----
  "nutrition.tab_today": { en: "Today", tn: "اليوم" },
  "nutrition.tab_plan": { en: "Plan", tn: "البرنامج" },

  // ---- food diary ----
  "diary.title": { en: "Food diary", tn: "يوميات الطعام" },
  "diary.subtitle": { en: "What you actually ate today.", tn: "ما أكلته فعلاً اليوم." },
  "diary.today_target": { en: "Today", tn: "اليوم" },
  "diary.no_target": {
    en: "Set up your diet first to get daily targets.",
    tn: "اضبط نظامك الغذائي أولاً لتحصل على أهداف يومية.",
  },
  "diary.copy_yesterday": { en: "Copy last logged day", tn: "انسخ آخر يوم مسجّل" },
  "diary.empty_slot": { en: "Nothing logged yet.", tn: "لم يُسجّل شيء بعد." },
  "diary.add_food": { en: "Add food", tn: "أضف طعاماً" },
  "diary.tab_plan": { en: "My plan", tn: "برنامجي" },
  "diary.tab_search": { en: "Search", tn: "بحث" },
  "diary.tab_recents": { en: "Recent", tn: "الأخيرة" },
  "diary.tab_favorites": { en: "Favorites", tn: "المفضّلة" },
  "diary.tab_quick": { en: "Quick", tn: "سريع" },
  "diary.search_placeholder": { en: "Search foods…", tn: "ابحث عن طعام…" },
  "diary.no_recents": {
    en: "Foods you log will show up here.",
    tn: "الأطعمة التي تسجّلها ستظهر هنا.",
  },
  "diary.no_favorites": {
    en: "Star foods you eat often and they'll live here.",
    tn: "ضع نجمة على الأطعمة التي تأكلها كثيراً فتظهر هنا.",
  },
  "diary.quantity": { en: "Quantity (grams)", tn: "الكمية (غرام)" },
  "diary.log_cta": { en: "Log it", tn: "سجّلها" },
  "diary.log_meal": { en: "Log the whole meal", tn: "سجّل الوجبة كاملة" },
  "diary.details": { en: "Details", tn: "التفاصيل" },
  // Bar labels — the value beside them already carries the unit, so no "(g)".
  "diary.macro_protein": { en: "Protein", tn: "بروتين" },
  "diary.macro_carbs": { en: "Carbs", tn: "كربوهيدرات" },
  "diary.macro_fat": { en: "Fat", tn: "دهون" },
  "diary.kcal_eaten": { en: "kcal eaten", tn: "سعرة مستهلكة" },
  "diary.goal": { en: "Goal", tn: "الهدف" },
  "diary.food_label": { en: "Food", tn: "الطعام" },
  "diary.remaining": { en: "Remaining", tn: "الباقي" },
  "diary.totals": { en: "Totals", tn: "المجموع" },
  "diary.back": { en: "Back", tn: "رجوع" },
  "diary.close": { en: "Close", tn: "إغلاق" },
  "diary.quick_name": { en: "Name (optional)", tn: "الاسم (اختياري)" },
  "diary.quick_calories": { en: "Calories", tn: "السعرات" },
  "diary.quick_protein": { en: "Protein (g)", tn: "بروتين (غ)" },
  "diary.quick_carbs": { en: "Carbs (g)", tn: "كربوهيدرات (غ)" },
  "diary.quick_fat": { en: "Fat (g)", tn: "دهون (غ)" },

  // ---- nutrition coach messages (rule-based) ----
  "coach.log_reminder": {
    en: "Nothing logged yet today — even a quick estimate keeps your coaching accurate.",
    tn: "لم تسجّل شيئاً اليوم — حتى تقدير سريع يبقي المتابعة دقيقة.",
  },
  "coach.protein_behind": {
    en: "Protein is behind today — add a protein-rich food to your next meal.",
    tn: "البروتين ناقص اليوم — أضف مصدر بروتين إلى وجبتك القادمة.",
  },
  "coach.protein_hit": {
    en: "Protein target hit — that's how muscle is kept and built.",
    tn: "تحقّق هدف البروتين — هكذا يُحفظ العضل ويُبنى.",
  },
  "coach.calories_over": {
    en: "You're over today's calories. One day won't hurt — get back on target tomorrow.",
    tn: "تجاوزت سعرات اليوم. يوم واحد لا يضرّ — ارجع إلى الهدف غداً.",
  },
  "coach.calories_low_evening": {
    en: "Calories are very low today — under-eating slows progress too.",
    tn: "السعرات منخفضة جداً اليوم — الأكل الناقص يعطّل التقدّم أيضاً.",
  },
  "coach.fat_high": {
    en: "Fat is running high today — go leaner on the next meal.",
    tn: "الدهون مرتفعة اليوم — خفّفها في الوجبة القادمة.",
  },
  "coach.great_day": {
    en: "Great day: calories on target and protein locked in.",
    tn: "يوم ممتاز: السعرات في الهدف والبروتين مكتمل.",
  },
  "coach.on_track": {
    en: "On track so far — keep it going.",
    tn: "في الطريق الصحيح حتى الآن — واصل.",
  },

  // ---- live nutrition tile ----
  "tile.log_food": { en: "Log food", tn: "سجّل طعاماً" },

  // ---- weekly review ----
  "review.title": { en: "Weekly review", tn: "المراجعة الأسبوعية" },
  "review.subtitle": { en: "Your last 7 days, through a coach's eyes.", tn: "أيامك السبعة الأخيرة، بعين المدرّب." },
  "review.workouts": { en: "Workouts", tn: "التمارين" },
  "review.nutrition_days": { en: "Days logged", tn: "أيام مسجّلة" },
  "review.avg_protein": { en: "Avg protein", tn: "معدل البروتين" },
  "review.avg_sleep": { en: "Avg sleep", tn: "معدل النوم" },
  "review.weight_change": { en: "Weight change", tn: "تغير الوزن" },
  "review.prs": { en: "New PRs", tn: "أرقام جديدة" },
  "review.coach_title": { en: "Coach summary", tn: "كلمة المدرّب" },
  "review.recommended": { en: "Recommended for you", tn: "مقترح لك" },
  "review.sum_no_data": {
    en: "Not enough data yet — log workouts, meals and check-ins this week and this review gets sharp.",
    tn: "لا توجد بيانات كافية بعد — سجّل تمارينك وطعامك هذا الأسبوع وتصبح المراجعة أدقّ.",
  },
  "review.sum_workouts_great": {
    en: "Training consistency was excellent this week.",
    tn: "التزامك بالتمرين كان ممتازاً هذا الأسبوع.",
  },
  "review.sum_workouts_ok": {
    en: "You trained, but a session or two slipped. Protect your training days.",
    tn: "تمرّنت، لكن فاتتك حصة أو اثنتان. احمِ أيام تمرينك.",
  },
  "review.sum_workouts_poor": {
    en: "Training slipped this week — restart with the very next session, not next Monday.",
    tn: "تراجع التمرين هذا الأسبوع — ابدأ من الحصة القادمة، لا من الاثنين القادم.",
  },
  "review.sum_prs": {
    en: "You set new personal records this week — strength is moving.",
    tn: "حقّقت أرقاماً قياسية جديدة هذا الأسبوع — القوة تتقدّم.",
  },
  "review.sum_nutrition_great": {
    en: "Nutrition logging was consistent — your targets mean something now.",
    tn: "تسجيل الطعام كان منتظماً — أهدافك صار لها معنى الآن.",
  },
  "review.sum_nutrition_poor": {
    en: "Little food logging this week — without data, coaching is guessing.",
    tn: "تسجيل الطعام قليل هذا الأسبوع — بدون بيانات، تصبح المتابعة تخميناً.",
  },
  "review.sum_protein_low": {
    en: "Average protein ran low — build every meal around a protein source.",
    tn: "معدّل البروتين كان منخفضاً — ابنِ كل وجبة على مصدر بروتين.",
  },
  "review.sum_sleep_low": {
    en: "Sleep averaged under 7 hours — recovery is limiting you more than training is.",
    tn: "معدّل النوم أقل من 7 ساعات — الاستشفاء يحدّك أكثر من التمرين.",
  },
  "review.sum_weight_cut_good": {
    en: "Weight is trending down — the plan is working.",
    tn: "الوزن في نزول — البرنامج ينجح.",
  },
  "review.sum_weight_cut_stall": {
    en: "Weight hasn't moved — if next week repeats this, we adjust calories.",
    tn: "الوزن لم يتحرّك — إن تكرّر ذلك الأسبوع القادم، نعدّل السعرات.",
  },
  "review.sum_weight_bulk_good": {
    en: "Weight is climbing slowly — clean gaining pace.",
    tn: "الوزن يرتفع ببطء — وتيرة زيادة نظيفة.",
  },

  // ---- adaptive coaching: diet adjustments (V2) ----
  "adapt.card_title": { en: "Coach proposal", tn: "اقتراح المدرّب" },
  // Calibration: we could solve for the user's real maintenance from what they
  // logged and what the scale did, so we say that rather than "eat less".
  "adapt.calibrated_up": {
    en: "Two weeks of your real food and your real weight say you burn more than we first estimated — your targets go up.",
    tn: "أسبوعان من طعامك الحقيقي ووزنك الحقيقي يقولان إنك تحرق أكثر ممّا قدّرنا — أهدافك ترتفع.",
  },
  "adapt.calibrated_down": {
    en: "Two weeks of your real food and your real weight say you burn less than we first estimated — your targets come down.",
    tn: "أسبوعان من طعامك الحقيقي ووزنك الحقيقي يقولان إنك تحرق أقلّ ممّا قدّرنا — أهدافك تنخفض.",
  },
  "adapt.cut_stall": {
    en: "Your weight hasn't moved in two weeks on a cut — time to lower calories a notch.",
    tn: "وزنك لم يتحرّك منذ أسبوعين وأنت في إنقاص — حان وقت خفض السعرات قليلاً.",
  },
  "adapt.cut_too_fast": {
    en: "You're losing weight too fast — we're adding calories back to protect your muscle.",
    tn: "تنقص بسرعة كبيرة — نعيد بعض السعرات لحماية عضلك.",
  },
  "adapt.bulk_stall": {
    en: "Weight is flat while building — a small calorie increase keeps you growing.",
    tn: "الوزن ثابت وأنت تبني — زيادة صغيرة في السعرات تبقيك في نموّ.",
  },
  "adapt.bulk_too_fast": {
    en: "Gaining too fast — trimming calories to keep the gain clean.",
    tn: "تزيد بسرعة كبيرة — نخفض السعرات لتبقى الزيادة نظيفة.",
  },
  "adapt.trend_label": { en: "2-week trend", tn: "التغيّر في أسبوعين" },
  "adapt.protein_note": { en: "Protein stays the same", tn: "البروتين لا يتغيّر" },
  "adapt.accept": { en: "Apply new targets", tn: "طبّق الأهداف الجديدة" },
  "adapt.applied": { en: "New targets applied", tn: "طُبّقت الأهداف الجديدة" },

  // ---- adaptive coaching: exercise progression (V2) ----
  "progress.suggested": { en: "Coach", tn: "المدرّب" },
  "progress.reason_up": {
    en: "You beat the top of the rep range with reps in reserve — go up.",
    tn: "تجاوزت أعلى نطاق التكرارات وما زال لديك احتياطي — ارفع الوزن.",
  },
  "progress.reason_deload": {
    en: "Three sessions stuck at this weight near failure — drop ~10% and rebuild.",
    tn: "ثلاث حصص عالقة على نفس الوزن قرب الفشل — انقص ~10% وأعد البناء.",
  },

  // ---- exercise media ----
  "media.watch_demo": { en: "Watch demo video", tn: "شاهد فيديو التمرين" },
  "media.close": { en: "Close", tn: "إغلاق" },

  // ---- AI calorie calculator ----
  "ai.title": { en: "AI Calorie Calculator", tn: "حاسبة السعرات بالذكاء الاصطناعي" },
  "ai.subtitle": {
    en: "Snap your plate — the AI estimates, you confirm.",
    tn: "صوّر صحنك — الذكاء يقدّر، وأنت تؤكّد.",
  },
  "ai.open_camera": { en: "Take a photo of your meal", tn: "صوّر وجبتك" },
  "ai.no_save_note": {
    en: "The photo stays in the app — nothing is saved.",
    tn: "الصورة تبقى في التطبيق فقط — لا تُحفظ في أي مكان.",
  },
  "ai.pick_instead": { en: "No camera? Pick a photo instead", tn: "لا توجد كاميرا؟ اختر صورة" },
  "ai.capture": { en: "Capture", tn: "صوّر" },
  "ai.retake": { en: "Retake", tn: "أعد التصوير" },
  "ai.notes_ph": {
    en: "Optional notes: portion size, what's inside…",
    tn: "ملاحظات اختيارية: حجم الحصة، ما بداخلها…",
  },
  "ai.camera_error": {
    en: "Camera unavailable — pick a photo instead.",
    tn: "الكاميرا غير متوفّرة — اختر صورة.",
  },
  "ai.camera_denied": {
    en: "Camera permission was blocked. Allow it in your browser settings, or pick a photo instead.",
    tn: "مُنعت الكاميرا. اسمح لها من إعدادات المتصفّح، أو اختر صورة.",
  },
  "ai.camera_missing": {
    en: "No camera found on this device — pick a photo instead.",
    tn: "لم نجد كاميرا في هذا الجهاز — اختر صورة.",
  },
  "ai.camera_insecure": {
    en: "The camera only works over HTTPS. Open the app on localhost or an https:// address, or pick a photo instead.",
    tn: "الكاميرا تعمل على HTTPS فقط. افتح التطبيق على localhost أو على عنوان https://، أو اختر صورة.",
  },
  "ai.camera_busy": {
    en: "The camera is being used by another app. Close it and try again.",
    tn: "الكاميرا مستعملة في تطبيق آخر. أغلقه وأعد المحاولة.",
  },
  "ai.camera_starting": { en: "Starting camera…", tn: "جارٍ فتح الكاميرا…" },
  "ai.camera_retry": { en: "Try again", tn: "أعد المحاولة" },
  "ai.estimate_cta": { en: "Estimate calories", tn: "قدّر السعرات" },
  "ai.estimating": { en: "Estimating…", tn: "جارٍ التقدير…" },
  "ai.results_title": { en: "Detected foods — edit anything", tn: "الأطعمة المتعرَّف عليها — عدّل ما تشاء" },
  "ai.simulated_note": {
    en: "Estimated from our food database (AI is not configured yet) — double-check the numbers.",
    tn: "تقدير من قاعدة بيانات الأطعمة (الذكاء غير مفعّل بعد) — تحقّق من الأرقام.",
  },
  "ai.grams": { en: "g", tn: "غ" },
  "ai.quantity": { en: "Quantity", tn: "الكمية" },
  "ai.qty_sync_hint": {
    en: "Change the quantity and the calories and macros follow it automatically.",
    tn: "غيّر الكمية فتتغيّر السعرات والماكروز معها تلقائياً.",
  },
  "ai.decrease": { en: "Less", tn: "أقلّ" },
  "ai.increase": { en: "More", tn: "أكثر" },
  "ai.remove_item": { en: "Remove this food", tn: "احذف هذا الطعام" },
  "ai.total": { en: "Total", tn: "المجموع" },
  "ai.slot_label": { en: "Log to", tn: "سجّل في" },
  "ai.log_cta": { en: "Log to my diary", tn: "سجّلها في يومياتي" },
  "ai.logging": { en: "Logging…", tn: "جارٍ التسجيل…" },
  "ai.logged_title": { en: "Logged!", tn: "سُجّلت!" },
  "ai.logged_sub": { en: "Added to today's diary.", tn: "أُضيفت إلى يوميات اليوم." },
  "ai.open_diary": { en: "Open diary", tn: "افتح اليوميات" },
  "ai.again": { en: "Estimate another meal", tn: "قدّر وجبة أخرى" },
  "ai.premium_title": { en: "A Premium feature", tn: "ميزة بريميوم" },
  "ai.premium_body": {
    en: "The AI calorie camera is part of the Premium plan. Upgrade to snap your meals and log them in seconds.",
    tn: "كاميرا السعرات جزء من عرض بريميوم. طوّر اشتراكك لتصوّر وجباتك وتسجّلها في ثوانٍ.",
  },
  "ai.premium_cta": { en: "Upgrade to Premium", tn: "طوّر إلى بريميوم" },

  // ---- full-screen camera + analysis ----
  "ai.frame_hint": {
    en: "Fill the frame with the plate. Only what you see here is sent.",
    tn: "املأ الإطار بالصحن. لا يُرسل إلا ما تراه هنا.",
  },
  "ai.gallery": { en: "Gallery", tn: "الصور" },
  "ai.close_camera": { en: "Close camera", tn: "أغلق الكاميرا" },
  "ai.analyzing_title": { en: "Reading your plate", tn: "يقرأ صحنك" },
  "ai.analyzing_1": { en: "Looking at the photo", tn: "ينظر في الصورة" },
  "ai.analyzing_2": { en: "Identifying the food", tn: "يتعرّف على الطعام" },
  "ai.analyzing_3": { en: "Estimating portions", tn: "يقدّر الكميات" },
  "ai.analyzing_4": { en: "Adding up the macros", tn: "يجمع الماكروز" },
  "ai.analyzing_note": {
    en: "This takes a few seconds. Keep the app open.",
    tn: "يستغرق بضع ثوانٍ. أبقِ التطبيق مفتوحاً.",
  },
  "ai.items_found": { en: "{n} foods found", tn: "{n} أطعمة وُجدت" },
  "ai.one_item_found": { en: "1 food found", tn: "طعام واحد وُجد" },
  "ai.conf_high": { en: "Confident", tn: "متأكّد" },
  "ai.conf_medium": { en: "Fairly sure", tn: "شبه متأكّد" },
  "ai.conf_low": { en: "Rough guess — check it", tn: "تقدير تقريبي — تحقّق منه" },

  // ---- admin: Q&A triage ----
  "admin.nav_qa": { en: "Q&A", tn: "الأسئلة" },
  "admin.qa_title": { en: "User questions", tn: "أسئلة المستخدمين" },
  "admin.qa_sub": {
    en: "Answer a question to publish it in the Q&A library. The asker gets notified.",
    tn: "أجب عن سؤال لينشر في المكتبة. صاحب السؤال يصله إشعار.",
  },
  "admin.qa_empty": { en: "No pending questions.", tn: "لا توجد أسئلة في الانتظار." },
  "admin.qa_from": { en: "From", tn: "من" },
  "admin.qa_category": { en: "Category", tn: "القسم" },
  "admin.qa_question_en": { en: "Question (English)", tn: "السؤال (إنجليزي)" },
  "admin.qa_question_ar": { en: "Question (Tunisian)", tn: "السؤال (عربي)" },
  "admin.qa_answer_short_en": { en: "Short answer (English)", tn: "إجابة قصيرة (إنجليزي)" },
  "admin.qa_answer_short_ar": { en: "Short answer (Tunisian)", tn: "إجابة قصيرة (عربي)" },
  "admin.qa_answer_long_en": { en: "Full answer (English, Markdown)", tn: "إجابة كاملة (إنجليزي، Markdown)" },
  "admin.qa_answer_long_ar": { en: "Full answer (Tunisian, Markdown)", tn: "إجابة كاملة (عربي، Markdown)" },
  "admin.qa_publish": { en: "Publish answer", tn: "انشر الإجابة" },
  "admin.qa_dismiss": { en: "Dismiss", tn: "تجاهل" },

  // ---- admin: monthly ask quota ----
  "admin.qa_quota_title": { en: "Monthly question allowance", tn: "حصة الأسئلة الشهرية" },
  "admin.qa_quota_sub": {
    en: "How many questions each user may ask per calendar month, and who has used theirs.",
    tn: "كم سؤالاً يمكن لكل مستخدم أن يطرح في الشهر، ومن استهلك حصته.",
  },
  "admin.qa_quota_limit": { en: "Questions per user / month", tn: "أسئلة لكل مستخدم / شهر" },
  "admin.qa_quota_save": { en: "Save", tn: "احفظ" },
  "admin.qa_quota_saved": { en: "Saved.", tn: "حُفظ." },
  "admin.qa_quota_usage": { en: "This month's usage", tn: "استهلاك هذا الشهر" },
  "admin.qa_quota_none": { en: "Nobody has asked a question this month.", tn: "لم يطرح أحد سؤالاً هذا الشهر." },
  "admin.qa_quota_user": { en: "User", tn: "المستخدم" },
  "admin.qa_quota_used": { en: "Asked", tn: "سأل" },
  "admin.qa_quota_pending": { en: "Waiting", tn: "في الانتظار" },
  "admin.qa_quota_published": { en: "Answered", tn: "تمّت الإجابة" },
  "admin.qa_quota_last": { en: "Last question", tn: "آخر سؤال" },

  // ---- admin: managing the published library ----
  "admin.qa_library_title": { en: "Q&A library", tn: "مكتبة الأسئلة" },
  "admin.qa_library_sub": {
    en: "Hide a card to take it out of the app, or delete it for good.",
    tn: "أخفِ بطاقة لتخرج من التطبيق، أو احذفها نهائياً.",
  },
  "admin.qa_library_search": { en: "Search a question…", tn: "ابحث عن سؤال…" },
  "admin.qa_library_count": { en: "{n} cards", tn: "{n} بطاقة" },
  "admin.qa_library_empty": { en: "No card matches.", tn: "لا توجد بطاقة مطابقة." },
  "admin.qa_library_hidden": { en: "Hidden", tn: "مخفيّة" },
  "admin.qa_library_hide": { en: "Hide", tn: "أخفِ" },
  "admin.qa_library_show": { en: "Show", tn: "أظهر" },
  "admin.qa_library_delete": { en: "Delete", tn: "احذف" },
  "admin.qa_library_confirm_delete": { en: "Delete for good", tn: "احذف نهائياً" },
  "admin.qa_library_cancel": { en: "Cancel", tn: "إلغاء" },
  "admin.qa_library_seed_note": {
    en: "Cards with an id like faq_007 come from the content file — running the seed again restores them. Hide those instead of deleting.",
    tn: "البطاقات التي لها معرّف مثل faq_007 تأتي من ملف المحتوى — إعادة تشغيل seed تعيدها. أخفِها بدل حذفها.",
  },

  // ---- admin: subscriptions ----
  "admin.nav_subs": { en: "Subscriptions", tn: "الاشتراكات" },
  "admin.subs_title": { en: "Subscriptions", tn: "الاشتراكات" },
  "admin.subs_sub": {
    en: "Who is paid up, and who is about to run out. Soonest to lapse first.",
    tn: "من دفع ومن قارب اشتراكه على الانتهاء. الأقرب انتهاءً أولاً.",
  },
  "admin.subs_active": { en: "Active", tn: "مفعّل" },
  "admin.subs_expiring": { en: "Expiring soon", tn: "قارب على الانتهاء" },
  "admin.subs_expired": { en: "Expired", tn: "انتهى" },
  "admin.subs_unpaid": { en: "Never paid", tn: "لم يدفع أبداً" },
  "admin.subs_admin": { en: "Admin — always has access", tn: "مشرف — لديه دخول دائم" },
  "admin.subs_search": {
    en: "Search by name, email or number…",
    tn: "ابحث بالاسم أو البريد أو الرقم…",
  },

  // Chase messages, written in the *customer's* language. {name} is replaced
  // before the wa.me link is built. One per situation — telling someone who
  // never started a payment to "renew" would make no sense to them.
  "admin.wa_msg_unpaid": {
    en:
      "Hi {name}, this is HYPE FITNESS. You have an account with us but it isn't active yet. " +
      "Anything blocking you? Happy to help you finish.",
    tn:
      "أهلاً {name}، هذا HYPE FITNESS. لديك حساب عندنا لكنه لم يُفعّل بعد. " +
      "فما حاجة واقفتلك؟ نجمو نعاونوك تكمّل.",
  },
  "admin.wa_msg_expiring": {
    en:
      "Hi {name}, this is HYPE FITNESS. Your subscription is about to run out — " +
      "renew and you keep your plan and your progress.",
    tn:
      "أهلاً {name}، هذا HYPE FITNESS. اشتراكك قارب على الانتهاء — " +
      "جدّدو وتبقى عندك البرنامج والتقدّم متاعك.",
  },
  "admin.wa_msg_expired": {
    en:
      "Hi {name}, this is HYPE FITNESS. Your subscription has ended. " +
      "Renew whenever you like — your plan and progress are still saved.",
    tn:
      "أهلاً {name}، هذا HYPE FITNESS. انتهى اشتراكك. " +
      "جدّدو وقتلي تحب — البرنامج والتقدّم متاعك مازالوا محفوظين.",
  },
  "admin.wa_msg_active": {
    en: "Hi {name}, this is HYPE FITNESS. Just checking in — how are you getting on?",
    tn: "أهلاً {name}، هذا HYPE FITNESS. نطمئنّ عليك فقط — كيف تسير الأمور معك؟",
  },
  "admin.subs_none": { en: "Nobody here.", tn: "لا أحد هنا." },
  "admin.subs_note": {
    en: "Access stops on its own the moment a term ends — nothing to switch off by hand. Confirm a payment on the Payments tab to extend one.",
    tn: "الدخول يتوقّف وحده عند انتهاء المدة — لا شيء تطفئه بيدك. للتمديد، أكّد الدفع في تبويب المدفوعات.",
  },
  "admin.subs_actions": { en: "Actions", tn: "إجراءات" },
  "admin.subs_cancel": { en: "Cancel", tn: "إلغاء" },
  "admin.subs_end": { en: "End access", tn: "أوقف الدخول" },
  "admin.subs_end_note": {
    en: "Cuts them off now and sends them to checkout. Their account, plan and history stay — confirming a payment brings them back.",
    tn: "يُقطع دخوله الآن ويُوجَّه إلى الدفع. حسابه وبرنامجه وسجلّه تبقى — وتأكيد دفعة يعيده كما كان.",
  },
  "admin.subs_end_confirm": { en: "Yes, end it", tn: "نعم، أوقفه" },
  "admin.subs_delete": { en: "Delete account", tn: "امسح الحساب" },
  "admin.subs_delete_note": {
    en: "Erases the account and everything logged under it — workouts, meals, check-ins. This cannot be undone. Type the email to confirm.",
    tn: "يمحو الحساب وكل ما سُجّل فيه — تمارين وطعام وتسجيلات. لا يمكن التراجع. اكتب البريد للتأكيد.",
  },
  "admin.subs_delete_confirm_label": {
    en: "Type the account email to confirm",
    tn: "اكتب بريد الحساب للتأكيد",
  },

  // ---- admin: user records ----
  "admin.nav_users": { en: "Users", tn: "المستخدمون" },
  "admin.users_title": { en: "User records", tn: "سجلات المستخدمين" },
  "admin.users_sub": {
    en: "Look up an account by email to reset its logged workout history. The training plan stays as it is.",
    tn: "ابحث عن حساب بالبريد لتصفير سجلّ تمارينه. برنامج التدريب يبقى كما هو.",
  },
  "admin.users_email_placeholder": { en: "user@example.com", tn: "user@example.com" },
  "admin.users_lookup": { en: "Look up", tn: "ابحث" },
  "admin.users_sessions": { en: "Sessions", tn: "حصص" },
  "admin.users_sets": { en: "Sets", tn: "المجموعات" },
  "admin.users_events": { en: "Events", tn: "أحداث" },
  "admin.users_open": { en: "In progress", tn: "قيد التنفيذ" },
  "admin.users_day": { en: "Day", tn: "اليوم" },
  "admin.users_started": { en: "Started", tn: "بدأت" },
  "admin.users_finished": { en: "Finished", tn: "انتهت" },
  "admin.users_in_progress": { en: "In progress", tn: "قيد التنفيذ" },
  "admin.users_plan_safe": {
    en: "The training plan is not touched. Active program:",
    tn: "برنامج التدريب لا يتغيّر. البرنامج الفعّال:",
  },
  "admin.users_no_program": { en: "none", tn: "لا يوجد" },
  "admin.users_nothing": {
    en: "This account has no workout history — nothing to reset.",
    tn: "هذا الحساب ليس له سجلّ تمارين — لا شيء لتصفيره.",
  },
  "admin.users_warning": {
    en: "This permanently deletes every session, every logged set and the completion events. It cannot be undone. Check-ins, meal logs and the program are kept.",
    tn: "هذا يحذف نهائياً كل الحصص وكل المجموعات المسجّلة وأحداث الإكمال. لا يمكن التراجع. تسجيلات الصباح وسجلّ الطعام والبرنامج تبقى محفوظة.",
  },
  "admin.users_confirm_label": {
    en: "Type the email to confirm",
    tn: "اكتب البريد للتأكيد",
  },
  "admin.users_reset": { en: "Reset workout history", tn: "صفّر سجلّ التمارين" },
  "admin.users_reset_done": { en: "Workout history reset.", tn: "صُفّر سجلّ التمارين." },

  // ---- report a problem (user side) ----
  "support.title": { en: "Report a problem", tn: "أبلغ عن مشكلة" },
  "support.subtitle": {
    en: "Something broken or confusing? Tell us and we'll answer you here.",
    tn: "هل هناك شيء معطّل أو غير مفهوم؟ أخبرنا وسنجيبك هنا.",
  },
  "support.category": { en: "What is it about?", tn: "بماذا يتعلّق؟" },
  "support.cat_bug": { en: "Something is broken", tn: "شيء لا يعمل" },
  "support.cat_payment": { en: "Payment", tn: "الدفع" },
  "support.cat_plan": { en: "My plan", tn: "برنامجي" },
  "support.cat_account": { en: "My account", tn: "حسابي" },
  "support.cat_other": { en: "Something else", tn: "شيء آخر" },
  "support.message": { en: "What happened?", tn: "ماذا حدث؟" },
  "support.message_placeholder": {
    en: "Tell us what you were doing and what went wrong.",
    tn: "أخبرنا بما كنت تفعله وبما حدث.",
  },
  "support.send": { en: "Send report", tn: "أرسل البلاغ" },
  "support.sending": { en: "Sending…", tn: "جارٍ الإرسال…" },
  "support.sent": {
    en: "Sent. We'll answer you right here.",
    tn: "أُرسل. سنجيبك هنا.",
  },
  "support.my_reports": { en: "My reports", tn: "بلاغاتي" },
  "support.empty": { en: "You haven't reported anything yet.", tn: "لم تبلّغ عن شيء بعد." },
  "support.status_open": { en: "Waiting for an answer", tn: "في انتظار الردّ" },
  "support.status_answered": { en: "Answered", tn: "تمّت الإجابة" },
  "support.status_closed": { en: "Closed", tn: "مغلق" },
  "support.new_reply": { en: "New reply", tn: "ردّ جديد" },
  "support.from_you": { en: "You", tn: "أنت" },
  "support.from_coach": { en: "HYPE FITNESS", tn: "HYPE FITNESS" },
  "support.reply_placeholder": { en: "Write a message…", tn: "اكتب رسالة…" },
  "support.reply_send": { en: "Send", tn: "أرسل" },

  // ---- report a problem (admin side) ----
  "admin.nav_support": { en: "Reports", tn: "التبليغات" },
  "admin.support_title": { en: "Problem reports", tn: "تبليغات المشاكل" },
  "admin.support_sub": {
    en: "What users report from the app. Your answer lands in their thread.",
    tn: "ما يبلّغ عنه المستخدمون من التطبيق. جوابك يصلهم في نفس المحادثة.",
  },
  "admin.support_empty": { en: "No reports.", tn: "لا توجد بلاغات." },
  "admin.support_answer_placeholder": { en: "Write your answer…", tn: "اكتب جوابك…" },
  "admin.support_send": { en: "Send answer", tn: "أرسل الجواب" },
  "admin.support_close": { en: "Close", tn: "إغلاق" },
  "admin.support_reopen": { en: "Reopen", tn: "أعد الفتح" },
  "admin.support_show_open": { en: "Needs an answer", tn: "تحتاج جواباً" },
  "admin.support_show_all": { en: "All", tn: "الكل" },

  // ---- guided vs. build-it-yourself (shared by both makers) ----
  "build.choose_title": { en: "How do you want to start?", tn: "كيف تريد أن تبدأ؟" },
  "build.guided_title": { en: "Answer a few questions", tn: "أجب عن بضعة أسئلة" },
  "build.guided_workout": {
    en: "We pick the split and the exercises for you. Takes about two minutes.",
    tn: "نختار لك التقسيم والتمارين. يستغرق حوالي دقيقتين.",
  },
  "build.guided_diet": {
    en: "We work out your calories and build the meals for you. Takes about three minutes.",
    tn: "نحسب لك السعرات ونبني لك الوجبات. يستغرق حوالي ثلاث دقائق.",
  },
  "build.custom_title": { en: "Build it myself", tn: "أبنيه بنفسي" },
  "build.custom_workout": {
    en: "Pick your own days and choose every exercise from our library.",
    tn: "اختر أيامك واختر كل تمرين من مكتبتنا.",
  },
  "build.custom_diet": {
    en: "We still work out your calories — you choose every food yourself.",
    tn: "نحسب لك السعرات — وأنت تختار كل طعام بنفسك.",
  },
  "build.recommended": { en: "Recommended", tn: "ننصح به" },
  "build.switch_to_custom": { en: "I'd rather build it myself", tn: "أفضّل أن أبنيه بنفسي" },
  "build.switch_to_guided": { en: "Just ask me questions instead", tn: "اسألوني أسئلة بدل ذلك" },
  "build.saving": { en: "Saving…", tn: "جارٍ الحفظ…" },

  // ---- custom split builder ----
  "cw.title": { en: "Build your split", tn: "ابنِ تقسيمك" },
  "cw.step_basics": { en: "About you", tn: "عنك" },
  "cw.step_shape": { en: "Your week", tn: "أسبوعك" },
  "cw.step_fill": { en: "Fill the days", tn: "املأ الأيام" },
  "cw.program_name": { en: "Program name", tn: "اسم البرنامج" },
  "cw.program_name_ph": { en: "My split", tn: "تقسيمي" },
  "cw.days_count": { en: "How many days a week?", tn: "كم يوماً في الأسبوع؟" },
  "cw.days_unit": { en: "days", tn: "أيام" },
  "cw.start_from": { en: "Start from a ready-made shape", tn: "ابدأ من هيكل جاهز" },
  "cw.start_blank": { en: "Start blank", tn: "ابدأ من الصفر" },
  "cw.start_from_hint": {
    en: "This only names the days — you still choose every exercise.",
    tn: "هذا يسمّي الأيام فقط — أنت من يختار كل تمرين.",
  },
  "cw.day_name": { en: "Day name", tn: "اسم اليوم" },
  "cw.add_exercise": { en: "Add exercise", tn: "أضف تمريناً" },
  "cw.search_exercises": { en: "Search exercises…", tn: "ابحث عن تمارين…" },
  "cw.no_exercises_found": { en: "Nothing matches that.", tn: "لا شيء يطابق ذلك." },
  "cw.empty_day": { en: "No exercises yet", tn: "لا توجد تمارين بعد" },
  "cw.sets": { en: "Sets", tn: "مجموعات" },
  "cw.reps": { en: "Reps", tn: "تكرارات" },
  "cw.rest": { en: "Rest", tn: "راحة" },
  "cw.remove": { en: "Remove", tn: "احذف" },
  "cw.filter_all": { en: "All", tn: "الكل" },
  "cw.save": { en: "Save my program", tn: "احفظ برنامجي" },
  "cw.day_needs_exercise": {
    en: "Every day needs at least one exercise.",
    tn: "كل يوم يحتاج تمريناً واحداً على الأقل.",
  },
  "cw.already_added": { en: "Already in this day", tn: "موجود في هذا اليوم" },
  "cw.exercise_count": { en: "exercises", tn: "تمارين" },

  // ---- custom meal plan builder ----
  "cd.title": { en: "Build your plan", tn: "ابنِ برنامجك" },
  "cd.step_numbers": { en: "Your numbers", tn: "أرقامك" },
  "cd.step_meals": { en: "Your meals", tn: "وجباتك" },
  "cd.targets_ready": { en: "Here are your daily targets", tn: "هذه أهدافك اليومية" },
  "cd.targets_hint": {
    en: "Same maths as the guided plan. Now put the food in yourself.",
    tn: "نفس حساب البرنامج الموجّه. الآن ضع الطعام بنفسك.",
  },
  "cd.meals_count": { en: "How many meals a day?", tn: "كم وجبة في اليوم؟" },
  "cd.meals_unit": { en: "meals", tn: "وجبات" },
  "cd.add_food": { en: "Add food", tn: "أضف طعاماً" },
  "cd.search_foods": { en: "Search foods…", tn: "ابحث عن طعام…" },
  "cd.empty_meal": { en: "Nothing in this meal yet", tn: "لا شيء في هذه الوجبة بعد" },
  "cd.meal_needs_food": {
    en: "Every meal needs at least one food.",
    tn: "كل وجبة تحتاج طعاماً واحداً على الأقل.",
  },
  "cd.save": { en: "Save my plan", tn: "احفظ برنامجي" },
  "cd.remaining": { en: "left", tn: "باقٍ" },
  "cd.over": { en: "over", tn: "زائد" },
  "cd.on_target": { en: "on target", tn: "على الهدف" },

  // ---- the nine answers the macro formula reads ----
  "ce.gender": { en: "You are", tn: "أنت" },
  "ce.male": { en: "Male", tn: "رجل" },
  "ce.female": { en: "Female", tn: "امرأة" },
  "ce.age": { en: "Age", tn: "العمر" },
  "ce.height": { en: "Height (cm)", tn: "الطول (سم)" },
  "ce.weight": { en: "Weight (kg)", tn: "الوزن (كغ)" },
  "ce.target_weight": { en: "Target (kg)", tn: "الهدف (كغ)" },
  "ce.goal": { en: "What are you after?", tn: "ما الذي تريد الوصول إليه؟" },
  "ce.goal_lose_fat": { en: "Lose fat", tn: "إنقاص الدهون" },
  "ce.goal_build_muscle": { en: "Build muscle", tn: "بناء العضلات" },
  "ce.goal_recomp": { en: "Both at once", tn: "الاثنان معاً" },
  "ce.goal_maintain": { en: "Stay where I am", tn: "أبقى كما أنا" },
  "ce.body_fat_pct": { en: "Body fat % (optional)", tn: "نسبة الدهون % (اختياري)" },
  "ce.body_fat_pct_hint": {
    en: "Only if you've actually measured it. Leave it empty otherwise — a guess makes the number worse, not better.",
    tn: "فقط إذا قسْتها فعلاً. وإلا اتركها فارغة — التخمين ينقص من دقة الرقم ولا يزيدها.",
  },
  // The activity question is about the DAY, not the training. Training is not
  // part of the estimate at all any more (see macros.ts).
  "ce.activity": { en: "How does your day usually go?", tn: "كيف يمرّ يومك عادةً؟" },
  "ce.act_sedentary": { en: "Sitting almost all day", tn: "أجلس أغلب اليوم" },
  "ce.act_light": { en: "A mix of sitting and standing", tn: "بين الجلوس والوقوف" },
  "ce.act_moderate": { en: "On my feet, walking a lot", tn: "واقف وأمشي كثيراً" },
  "ce.act_active": { en: "Physical job", tn: "عمل فيه مجهود" },
  "ce.act_very_active": { en: "Very physical job", tn: "عمل فيه مجهود كبير" },

  // ---- "my food isn't in the list" ----
  "uf.missing_cta": { en: "Can't find it? Add your own", tn: "لم تجده؟ أضفه بنفسك" },
  "uf.title": { en: "Add a food", tn: "أضف طعاماً" },
  "uf.hint": {
    en: "Copy the numbers off the packet, per 100 g. Only you will see this food.",
    tn: "انقل الأرقام من العلبة، لكل 100 غ. أنت وحدك من يرى هذا الطعام.",
  },
  "uf.name": { en: "Name", tn: "الاسم" },
  "uf.name_ph": { en: "e.g. my mother's couscous", tn: "مثال: كسكسي أمي" },
  "uf.kind": { en: "What is it mostly?", tn: "ما هو في الأغلب؟" },
  "uf.calories": { en: "Calories / 100 g", tn: "سعرات / 100 غ" },
  "uf.protein": { en: "Protein / 100 g", tn: "بروتين / 100 غ" },
  "uf.carbs": { en: "Carbs / 100 g", tn: "كربوهيدرات / 100 غ" },
  "uf.fat": { en: "Fat / 100 g", tn: "دهون / 100 غ" },
  "uf.save": { en: "Add it", tn: "أضفه" },
  "uf.cancel": { en: "Cancel", tn: "إلغاء" },
  "uf.mine": { en: "Mine", tn: "خاصّتي" },
  "uf.macros_exceed": {
    en: "Protein, carbs and fat can't add up to more than 100 g.",
    tn: "البروتين والكربوهيدرات والدهون لا يمكن أن تتجاوز 100 غ.",
  },
  "uf.slot_protein": { en: "Protein", tn: "بروتين" },
  "uf.slot_carb": { en: "Carbs", tn: "كربوهيدرات" },
  "uf.slot_vegetable": { en: "Vegetable", tn: "خضار" },
  "uf.slot_fat": { en: "Fat", tn: "دهون" },
  "uf.slot_fruit": { en: "Fruit", tn: "فاكهة" },
  "uf.slot_legume": { en: "Legume", tn: "بقوليات" },
  "uf.slot_beverage": { en: "Drink", tn: "مشروب" },

  // ---- payment thread (customer side) ----
  "pt.title": { en: "Your payment", tn: "عملية الدفع" },
  "pt.opened": {
    en: "We've got your receipt. Anything you need to tell us, write it here.",
    tn: "وصلنا وصلك. أي شيء تريد إخبارنا به، اكتبه هنا.",
  },
  "pt.placeholder": { en: "Write a message…", tn: "اكتب رسالة…" },
  "pt.send": { en: "Send", tn: "أرسل" },
  "pt.from_you": { en: "You", tn: "أنت" },
  "pt.from_us": { en: "HYPE FITNESS", tn: "HYPE FITNESS" },
  "pt.empty": { en: "No messages yet.", tn: "لا توجد رسائل بعد." },
  "pt.reply_soon": {
    en: "We usually answer within a few hours.",
    tn: "عادةً نجيب في غضون ساعات.",
  },

  // ---- payments queue (admin side) ----
  "admin.pay_unread": { en: "new", tn: "جديد" },
  "admin.pay_thread": { en: "Conversation", tn: "المحادثة" },
  "admin.pay_reply_ph": { en: "Reply to the customer…", tn: "ردّ على العميل…" },
  "admin.pay_send": { en: "Send", tn: "أرسل" },
  "admin.pay_no_thread": { en: "No messages yet.", tn: "لا توجد رسائل بعد." },

  // ---- the sign-up funnel (/start) ----
  //
  // This is the screen an ad points at, and every line in it is doing one of
  // two jobs: asking a question the plan genuinely needs, or telling the reader
  // what their own answer means. Nothing here claims a result on somebody
  // else's behalf — the testimonials that would do that live in
  // lib/social-proof.ts and ship empty until there are real ones.
  "fn.title": { en: "Build my plan", tn: "برنامجك في دقيقتين" },
  "fn.meta_desc": {
    en: "Answer eleven questions and see the training and nutrition plan your body actually needs.",
    tn: "أجب عن 11 سؤالاً وستحصل على برنامج التمرين والتغذية المناسب لجسمك.",
  },

  // Shell
  "fn.back": { en: "Back", tn: "رجوع" },
  "fn.next": { en: "Continue", tn: "تابع" },

  // The button on the landing page, and the two lines under the funnel's first
  // question. /start has no screen of its own before the questionnaire: the
  // title and subtitle that used to sit there said what the landing page had
  // just said, over a button that only asked permission to begin.
  "fn.hero_cta": { en: "Start — it takes 2 minutes", tn: "ابدأ — دقيقتان فقط" },
  "fn.hero_free": { en: "Free. No account, no card.", tn: "مجاني. بدون حساب، بدون بطاقة." },
  "fn.hero_signin": { en: "Already have an account?", tn: "عندك حساب؟" },

  // Questions
  "fn.q_goal": { en: "What are you here to change?", tn: "ما الذي تريد تغييره؟" },
  "fn.q_goal_hint": { en: "Pick the one that matters most right now.", tn: "اختر ما يهمّك أكثر الآن." },
  "fn.q_gender": { en: "Your body runs on different numbers", tn: "الأرقام تختلف من جسم لآخر" },
  "fn.q_gender_hint": {
    en: "Resting metabolism is calculated differently. This is the only reason we ask.",
    tn: "حرق الجسم في الراحة يُحسب بطريقة مختلفة. هذا هو السبب الوحيد للسؤال.",
  },
  "fn.q_age": { en: "How old are you?", tn: "كم عمرك؟" },
  "fn.q_height": { en: "How tall are you?", tn: "كم طولك؟" },
  "fn.q_weight": { en: "What do you weigh today?", tn: "كم وزنك اليوم؟" },
  "fn.q_weight_hint": { en: "Roughly is fine. The plan corrects itself weekly.", tn: "تقريبي يكفي. البرنامج يصحّح نفسه كل أسبوع." },
  "fn.q_target": { en: "And where do you want to be?", tn: "وإلى أين تريد أن تصل؟" },
  "fn.q_target_hint": { en: "Your target weight — we put a date on it at the end.", tn: "الوزن الذي تريده — في النهاية نضع له تاريخاً." },
  "fn.q_days": { en: "How many days a week can you really train?", tn: "كم يوماً في الأسبوع تستطيع التمرين فعلاً؟" },
  "fn.q_days_hint": {
    en: "Be honest. A plan you finish beats a plan that looks impressive.",
    tn: "كن صادقاً. برنامج تكمّله أفضل من برنامج يبدو قوياً.",
  },
  "fn.q_activity": { en: "How does your day usually go?", tn: "كيف يمرّ يومك عادةً؟" },
  "fn.q_activity_hint": {
    en: "Outside training — your job, your commute, your feet.",
    tn: "خارج التمرين — عملك، تنقّلك، وقوفك على قدميك.",
  },
  "fn.q_meals": { en: "How many times a day do you like to eat?", tn: "كم وجبة في اليوم تحبّ أن تأكل؟" },
  "fn.q_meals_hint": {
    en: "Your plan is built around this, not against it.",
    tn: "برنامجك يُبنى حول هذا، لا ضدّه.",
  },
  "fn.q_experience": { en: "Where are you starting from?", tn: "من أين تبدأ؟" },
  "fn.q_blocker": { en: "What stopped you last time?", tn: "ما الذي أوقفك في المرة السابقة؟" },
  "fn.q_blocker_hint": {
    en: "This one is not about your body. It decides what the plan protects you from.",
    tn: "هذا السؤال ليس عن جسمك. هو الذي يحدّد ممّ يحميك البرنامج.",
  },

  "fn.unit_years": { en: "years", tn: "سنة" },
  "fn.unit_cm": { en: "cm", tn: "سم" },
  "fn.unit_kg": { en: "kg", tn: "كغ" },
  "fn.out_of_range": { en: "That does not look right — check the number.", tn: "الرقم غير صحيح — راجعه من فضلك." },

  // Goal subtitles — the same four goals the questionnaire uses, said in the
  // reader's terms rather than the coach's.
  "fn.goal_lose_fat_sub": { en: "Smaller waist, same strength", tn: "خصر أنحف، ونفس القوة" },
  "fn.goal_build_muscle_sub": { en: "Add size without adding fat", tn: "حجم أكبر بدون دهون" },
  "fn.goal_recomp_sub": { en: "Both at once — slower, but it holds", tn: "أبطأ، لكن النتيجة تدوم" },
  "fn.goal_maintain_sub": { en: "Hold your weight, fix your habits", tn: "تحافظ على وزنك وتصلح عاداتك" },

  "fn.meals_3": { en: "3 meals", tn: "3 وجبات" },
  "fn.meals_4": { en: "4 meals", tn: "4 وجبات" },
  "fn.meals_5": { en: "5 meals", tn: "5 وجبات" },

  "fn.exp_new": { en: "I am starting from zero", tn: "أبدأ من الصفر" },
  "fn.exp_new_sub": { en: "Never trained, or never properly", tn: "لم أتمرّن من قبل، أو لم أتمرّن بشكل صحيح" },
  "fn.exp_returning": { en: "I have trained before and stopped", tn: "تمرّنت سابقاً ثم توقّفت" },
  "fn.exp_returning_sub": { en: "Coming back after a break", tn: "عائد بعد انقطاع" },
  "fn.exp_consistent": { en: "I train regularly", tn: "أتمرّن بانتظام" },
  "fn.exp_consistent_sub": { en: "Looking for structure and progress", tn: "أبحث عن تنظيم وتقدّم" },

  "fn.blk_what_to_eat": { en: "I never knew what to eat", tn: "لم أعرف ماذا آكل" },
  "fn.blk_no_program": { en: "I had no real program", tn: "لم يكن عندي برنامج حقيقي" },
  "fn.blk_motivation": { en: "I lost motivation after a few weeks", tn: "فقدت الحماس بعد أسابيع" },
  "fn.blk_no_time": { en: "I could not find the time", tn: "لم أجد الوقت" },
  "fn.blk_stalled": { en: "I trained hard and nothing moved", tn: "تمرّنت بجدّ ولم يتغيّر شيء" },

  // Interstitial 1 — straight after the target weight, while the gap they
  // just typed is still on their mind. The numbers are composed by the
  // component; these are the sentences around them.
  "fn.i1_title": { en: "We can put a date on that", tn: "نستطيع أن نضع لذلك تاريخاً" },
  "fn.i1_gap_lose": { en: "to lose", tn: "تنقصها" },
  "fn.i1_gap_gain": { en: "to gain", tn: "تزيدها" },
  "fn.i1_body": {
    en: "Not a promise — arithmetic. At the end of these questions you will see the week it lands on, worked out from your body at a pace a body can actually hold.",
    tn: "ليس وعداً — حساب. في نهاية هذه الأسئلة سترى الأسبوع الذي تصل فيه، محسوباً من جسمك وبوتيرة يتحمّلها الجسم فعلاً.",
  },
  "fn.i1_body_same": {
    en: "The scale is not the measure here. At the end of these questions you will see what your plan changes instead.",
    tn: "الميزان ليس المقياس هنا. في نهاية هذه الأسئلة سترى ما الذي يغيّره برنامجك بدلاً منه.",
  },

  // Interstitial 2 — after the body questions, before the personal ones. The
  // mechanism, since there is nothing else honest to fill this slot with yet.
  "fn.i2_title": { en: "What happens with your answers", tn: "ماذا يحدث بإجاباتك" },
  "fn.i2_sub": {
    en: "Not a template with your name on it.",
    tn: "ليس قالباً جاهزاً مكتوباً عليه اسمك.",
  },

  // Interstitial 3 — right after they name what stopped them last time.
  "fn.i3_title": { en: "You are not the first to say that", tn: "لست أول من يقول هذا" },
  "fn.ans_what_to_eat": {
    en: "So the plan gives you the meals, not a calorie number to solve on your own. Real food, your budget, swaps for anything you do not have at home.",
    tn: "لذلك يعطيك البرنامج الوجبات، لا رقم سعرات تحلّه وحدك. أكل حقيقي، في حدود ميزانيتك، وبدائل لكل ما لا تجده في البيت.",
  },
  "fn.ans_no_program": {
    en: "So the first thing you get is the program: which days, which exercises, which weights, and a video for every movement you have not done before.",
    tn: "لذلك أول ما تحصل عليه هو البرنامج: أيّ الأيام، أيّ التمارين، أيّ الأوزان، وفيديو لكل حركة لم تجرّبها من قبل.",
  },
  "fn.ans_motivation": {
    en: "So the plan is built around the week you actually have, and it changes when you stall. Motivation is what runs out; a plan that keeps working is what replaces it.",
    tn: "لذلك يُبنى البرنامج حول الأسبوع الذي تملكه فعلاً، ويتغيّر عندما تتوقّف. الحماس هو ما ينفد؛ والبرنامج الذي يواصل العمل هو ما يعوّضه.",
  },
  "fn.ans_no_time": {
    en: "So you tell it how many days you have and it fits inside them. Three honest sessions beat six that never happen.",
    tn: "لذلك تخبره بعدد الأيام التي تملكها فيدخل فيها. ثلاث حصص صادقة أفضل من ستّ لا تحدث أبداً.",
  },
  "fn.ans_stalled": {
    en: "So your weight and your sessions get reviewed every week. When the scale stops, the numbers change — that is the part most people never do.",
    tn: "لذلك يُراجَع وزنك وحصصك كل أسبوع. عندما يتوقّف الميزان، تتغيّر الأرقام — وهذا ما لا يفعله أغلب الناس.",
  },

  // The build screen. Four lines that tick over while the plan is assembled.
  "fn.build_title": { en: "Building your plan", tn: "نبني برنامجك" },
  "fn.build_sub": { en: "A few seconds.", tn: "ثوانٍ قليلة." },
  "fn.build_1": { en: "Reading your answers", tn: "نقرأ إجاباتك" },
  "fn.build_2": { en: "Working out your calories", tn: "نحسب سعراتك" },
  "fn.build_3": { en: "Choosing your training split", tn: "نختار تقسيم تمارينك" },
  "fn.build_4": { en: "Filling your meals", tn: "نملأ وجباتك" },

  // The reveal.
  "fn.r_title": { en: "Your plan is ready", tn: "برنامجك جاهز" },
  "fn.r_sub": {
    en: "Built from the eleven answers you just gave. Nothing here is a default.",
    tn: "مبنيّ على إجاباتك، لا على قالب جاهز.",
  },
  "fn.r_daily": { en: "Your daily target", tn: "هدفك اليومي" },
  "fn.m_kcal": { en: "kcal a day", tn: "سعرة في اليوم" },
  "fn.m_protein": { en: "Protein", tn: "بروتين" },
  "fn.m_carbs": { en: "Carbs", tn: "كربوهيدرات" },
  "fn.m_fat": { en: "Fat", tn: "دهون" },
  "fn.r_maintenance": { en: "Your maintenance", tn: "سعرات الثبات" },
  // The line above the milestone track. Composed around the numbers, so the
  // sentence reads "you will see +0.6 kg on the scale within 4 weeks."
  "fn.r_first_line": { en: "You should see", tn: "من المفروض تشوف" },
  "fn.r_first_line_tail": { en: "on the scale within", tn: "على الميزان في ظرف" },
  "fn.r_start_here": { en: "Where you are now", tn: "من هنا تبدأ" },
  "fn.r_chart_title": { en: "Your road to it", tn: "طريقك إليه" },
  "fn.r_today": { en: "Today", tn: "اليوم" },
  "fn.r_target": { en: "Target", tn: "الهدف" },
  "fn.r_by": { en: "by", tn: "قبل" },
  // Arabic counts weeks in four forms, not two. See `weeksLabel`.
  "fn.week_1": { en: "week", tn: "أسبوع" },
  "fn.week_2": { en: "weeks", tn: "أسبوعين" },
  "fn.weeks_few": { en: "weeks", tn: "أسابيع" },
  "fn.weeks_many": { en: "weeks", tn: "أسبوعاً" },
  "fn.r_weeks": { en: "weeks", tn: "أسبوع" },
  "fn.r_first_week": { en: "First week", tn: "الأسبوع الأول" },
  "fn.r_estimate": {
    en: "An estimate at a steady pace. The plan re-checks it against your real weight every week and adjusts — that is the part a calculator cannot do.",
    tn: "تقدير بوتيرة ثابتة. البرنامج يقارنه بوزنك الحقيقي كل أسبوع ويعدّل — وهذا ما لا تستطيع الآلة الحاسبة فعله.",
  },
  "fn.r_no_date": {
    en: "At a pace your body can hold, this target is more than two years out. The plan still works — the date is the part we will not invent.",
    tn: "بوتيرة يتحمّلها جسمك، هذا الهدف أبعد من سنتين. البرنامج يعمل — لكنّ التاريخ لا نخترعه.",
  },
  "fn.r_recomp_title": { en: "The scale is not your measure", tn: "الميزان ليس مقياسك" },
  "fn.r_recomp_body": {
    en: "At your target weight, what changes is what the weight is made of. Your plan tracks strength and measurements, not just the number.",
    tn: "عند وزنك المستهدف، ما يتغيّر هو ممّ يتكوّن هذا الوزن. برنامجك يتابع القوة والمقاسات، لا الرقم وحده.",
  },
  "fn.r_week_title": { en: "Your training week", tn: "أسبوع تمرينك" },
  "fn.r_week_body": {
    en: "Split across the days you said you have, with a video and a swap on every exercise.",
    tn: "مقسّم على الأيام التي ذكرتها، ولكل تمرين فيديو وبديل.",
  },
  "fn.r_kept": {
    en: "Your answers are saved. You will not be asked any of this a second time.",
    tn: "إجاباتك محفوظة. لن نسألك عنها مرة ثانية.",
  },
  "fn.r_cta": { en: "Unlock my plan", tn: "افتح برنامجي" },
  "fn.r_cta_sub": { en: "Next: choose how long you want to train with us.", tn: "الخطوة التالية: اختر كم تريد أن تتمرّن معنا." },
  "fn.r_inside": { en: "What you get", tn: "ما الذي تحصل عليه" },

  // ---- proof blocks, shared by /start and /checkout ----
  "proof.title": { en: "What people say", tn: "ماذا يقول الناس" },

  // ---- checkout: the recap of a plan built on /start ----
  "co.recap_title": { en: "Your plan is waiting", tn: "برنامجك ينتظرك" },
  "co.recap_body": {
    en: "Built from your answers a moment ago. It unlocks the second your subscription is confirmed.",
    tn: "مبنيّ على إجاباتك قبل قليل. يُفتح فور تأكيد اشتراكك.",
  },
  "co.recap_kcal": { en: "kcal a day", tn: "سعرة في اليوم" },
  "co.recap_days": { en: "training days", tn: "أيام تمرين" },
  "co.recap_target": { en: "target", tn: "الهدف" },
  "co.recap_redo": { en: "Answer again", tn: "أجب من جديد" },
  "co.build_plan": { en: "Build my plan first", tn: "ابدأ ببناء برنامجك" },
  "co.build_plan_sub": {
    en: "Two minutes, free, no account — see your own numbers before you decide.",
    tn: "دقيقتان، مجاناً، بدون حساب — شاهد أرقامك قبل أن تقرّر.",
  },

  // ---- checkout: the guarantee ----
  //
  // Worded as a promise the product can already keep: a coach can rebuild a
  // plan by hand (actions/custom-diet.ts, custom-training.ts) and the support
  // thread is how they are reached. A money-back line would convert better
  // still — it is the strongest single element on a paywall — but it is a
  // commitment for the owner to make, not for this file to invent. Add it
  // here, or in /admin → Copy, once it is decided.
  "co.guarantee_title": { en: "If the plan does not fit you, we rebuild it", tn: "إذا لم يناسبك البرنامج، نعيد بناءه" },
  "co.guarantee_body": {
    en: "Message us in your first week and a coach goes through your answers and writes you a new one. You are not stuck with what the calculator produced.",
    tn: "راسلنا في أسبوعك الأول، فيقرأ المدرّب إجاباتك ويكتب لك برنامجاً جديداً. لن تبقى مربوطاً بما أخرجته الحسابات.",
  },

  // ---- checkout: the questions a first-time buyer actually has ----
  "faq.title": { en: "Before you pay", tn: "قبل أن تدفع" },
  "faq.q_when": { en: "When do I get access?", tn: "متى يُفتح لي الحساب؟" },
  "faq.a_when": {
    en: "As soon as a human checks the transfer — usually within a few hours, and the screen unlocks itself while you have it open.",
    tn: "فور تأكّد شخص من التحويل — عادةً في غضون ساعات، والصفحة تُفتح وحدها وأنت فيها.",
  },
  "faq.q_auto": { en: "Does it renew on its own?", tn: "هل يتجدّد تلقائياً؟" },
  "faq.a_auto": {
    en: "No. There is no card on file and nothing charges you again. When your term ends you choose whether to renew.",
    tn: "لا. لا توجد بطاقة مسجّلة ولا يُخصم منك شيء مرة أخرى. عند انتهاء المدة، أنت من يقرّر التجديد.",
  },
  "faq.q_gym": { en: "Do I need a gym?", tn: "هل أحتاج قاعة رياضة؟" },
  "faq.a_gym": {
    en: "No. The program is built from the equipment you say you have, and every exercise can be swapped for one you can actually do.",
    tn: "لا. البرنامج يُبنى على المعدات التي تقول إنك تملكها، ولكل تمرين بديل تستطيع أداءه.",
  },
  "faq.q_beginner": { en: "I have never trained. Is this for me?", tn: "لم أتمرّن من قبل. هل هذا يناسبني؟" },
  "faq.a_beginner": {
    en: "Yes — most people who start here have not. Every movement has a video, and the first weeks are deliberately light so the form comes before the weight.",
    tn: "نعم — أغلب من يبدأ معنا لم يتمرّن من قبل. لكل حركة فيديو، والأسابيع الأولى خفيفة عن قصد حتى يأتي الأداء قبل الوزن.",
  },
  "faq.q_food": { en: "Will I have to eat food I hate?", tn: "هل سأضطر لأكل ما لا أحبّه؟" },
  "faq.a_food": {
    en: "No. You list what you will not eat and it never appears. Meals are built from Tunisian food at the budget you pick.",
    tn: "لا. تكتب ما لا تأكله فلا يظهر لك أبداً. الوجبات مبنيّة على أكل تونسي في حدود الميزانية التي تختارها.",
  },
  "faq.q_help": { en: "What if I get stuck?", tn: "وإذا تعثّرت؟" },
  "faq.a_help": {
    en: "You ask inside the app and a coach — a person, not a bot — answers in Derja.",
    tn: "تسأل داخل التطبيق فيجيبك مدرّب — إنسان، لا روبوت.",
  },
} as const;

export type StringKey = keyof typeof STRINGS;

/** Translate a known key for the given locale. */
/**
 * Admin-published copy, keyed `"<locale>:<key>"`, overlaid on STRINGS.
 *
 * Module-level rather than threaded through context, which is what lets `t()`
 * stay a plain synchronous call at ~1500 existing call sites instead of every
 * one of them becoming a hook.
 *
 * That is only safe because this data is global. It is the product's own
 * wording — identical for every visitor, signed in or not — so a value cached
 * in the server process cannot leak one user's data to another. Do not put
 * anything user-specific in here; that reasoning stops holding immediately.
 */
let copyOverrides: Record<string, string> = {};

export function applyCopyOverrides(next: Record<string, string> | null | undefined): void {
  copyOverrides = next ?? {};
}

export function t(locale: Locale, key: StringKey): string {
  const override = copyOverrides[`${locale}:${key}`];
  if (override !== undefined) return override;
  const entry = STRINGS[key];
  return locale === "tn" ? entry.tn : entry.en;
}

/**
 * A subscription term, in words.
 *
 * Lives here rather than in the checkout page because the sign-up screen
 * restates the chosen term above its form, and the two drifted the last time a
 * term was added: the login form's chain of ternaries called every unknown
 * length "6 months".
 */
export function monthsLabel(locale: Locale, months: number): string {
  if (months === 1) return t(locale, "plans.month_1");
  if (months === 3) return t(locale, "plans.months_3");
  if (months === 6) return t(locale, "plans.months_6");
  if (months === 12) return t(locale, "plans.months_12");
  return `${months} ${t(locale, "admin.months_short")}`;
}

/**
 * A count of weeks, in words.
 *
 * Arabic does not pluralise like English. One is "أسبوع", two has its own dual
 * form "أسبوعين", three to ten take the broken plural "أسابيع", and eleven
 * upwards goes back to the singular. The milestone track prints this beside a
 * number on every row, so getting it wrong reads as broken to a native speaker
 * four times on the screen that is trying to sell them something.
 *
 * English has one plural and does not care; the same keys carry it.
 */
export function weeksLabel(locale: Locale, weeks: number): string {
  if (weeks === 1) return t(locale, "fn.week_1");
  if (weeks === 2) return t(locale, "fn.week_2");
  if (weeks <= 10) return t(locale, "fn.weeks_few");
  return t(locale, "fn.weeks_many");
}

/** Every key in the catalogue, for the admin copy editor's search. */
export const STRING_KEYS = Object.keys(STRINGS) as StringKey[];

/** What a key says with no override applied — the editor shows this as the
 *  placeholder, so an admin can always see what they are replacing. */
export function defaultCopy(locale: Locale, key: StringKey): string {
  const entry = STRINGS[key];
  return locale === "tn" ? entry.tn : entry.en;
}

/** Guards the publish action against writing keys that do not exist. */
export function isStringKey(value: string): value is StringKey {
  return Object.prototype.hasOwnProperty.call(STRINGS, value);
}
