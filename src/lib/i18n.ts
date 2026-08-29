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

export const LOCALES: Locale[] = ["en", "tn"];
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
  "checkout.title": { en: "Choose your plan", tn: "اختار العرض متاعك" },
  "checkout.subtitle": {
    en: "Your coach, your plan — pick what fits and start today.",
    tn: "مدربك وبرنامجك — اختار اللي يناسبك وابدا اليوم.",
  },
  "checkout.lifetime": { en: "Lifetime access", tn: "دخول دائم" },
  "checkout.renewal_banner": {
    en: "Your subscription has ended — pick a plan to keep your coaching going.",
    tn: "اشتراكك وفى — اختار عرض باش تكمل مع مدربك.",
  },
  "checkout.active_until": { en: "Active until", tn: "مفعّل حتى" },
  "checkout.no_plans": {
    en: "Plans are not configured yet. Please contact support.",
    tn: "العروض مازالت ما تحطّتش. اتصل بالدعم.",
  },

  // ---- subscription plans ----
  "plans.standard": { en: "Standard", tn: "ستاندرد" },
  "plans.premium": { en: "Premium", tn: "بريميوم" },
  "plans.most_popular": { en: "Most popular", tn: "الأكثر طلباً" },
  "plans.best_value": { en: "Best value", tn: "أفضل سعر" },
  "plans.base_price": { en: "Base price", tn: "السعر الأساسي" },
  "plans.vs_standard": { en: "vs Standard", tn: "عن ستاندرد" },
  "plans.duration": { en: "Duration", tn: "المدة" },
  "plans.your_choice": { en: "Your choice", tn: "اختيارك" },
  "plans.total_today": { en: "Total today", tn: "الجملة اليوم" },
  "plans.per_month": { en: "/month", tn: "/شهر" },
  "plans.month_1": { en: "1 month", tn: "شهر" },
  "plans.months_3": { en: "3 months", tn: "3 أشهر" },
  "plans.months_6": { en: "6 months", tn: "6 أشهر" },
  "plans.save": { en: "Save", tn: "وفّر" },
  "plans.billed_every": { en: "billed every", tn: "تخلّص كل" },
  "plans.f_std_1": { en: "Diet & Workout Makers", tn: "صانع الريجيم والتمرين" },
  "plans.f_std_2": { en: "Workout logging & food diary", tn: "تسجيل الحصص ودفتر الماكلة" },
  "plans.f_std_3": { en: "Weekly review & adaptive coach", tn: "مراجعة الجمعة ومدرب يتأقلم" },
  "plans.f_std_4": { en: "Q&A library", tn: "مكتبة الأسئلة" },
  "plans.f_prem_all": { en: "Everything in Standard", tn: "كل شيء في ستاندرد" },
  "plans.f_prem_1": { en: "AI calorie camera", tn: "كاميرا السعرات بالذكاء" },
  "plans.f_prem_2": { en: "Priority WhatsApp support", tn: "دعم واتساب بالأولوية" },
  "plans.f_prem_3": { en: "Early access to new features", tn: "الجديد يوصلك الأول" },
  "checkout.choose_method": {
    en: "Choose how you want to pay",
    tn: "اختار الطريقة اللي تحب تخلّص بيها",
  },
  "checkout.copy": { en: "Copy", tn: "نسخ" },
  "checkout.copied": { en: "Copied", tn: "تنسخ" },
  "checkout.whatsapp_cta": {
    en: "I've paid — confirm on WhatsApp",
    tn: "خلّصت — أكّد عبر واتساب",
  },
  "checkout.whatsapp_hint": {
    en: "Send us your payment screenshot on WhatsApp. We'll activate your account.",
    tn: "ابعثلنا تصويرة الخلاص على واتساب. باش نفعّلولك الحساب.",
  },
  "checkout.pending_title": { en: "Payment under review", tn: "الخلاص تحت المراجعة" },
  "checkout.pending_body": {
    en: "We received your request. Once we confirm your payment on WhatsApp, your account will be activated.",
    tn: "وصلنا طلبك. كي نأكّدو الخلاص على واتساب، باش يتفعّل حسابك.",
  },
  "checkout.active_title": { en: "You're all set", tn: "كل شيء جاهز" },
  "checkout.active_body": {
    en: "Your account is active. Enjoy your plan!",
    tn: "حسابك مفعّل. استمتع بالبرنامج!",
  },
  "checkout.go_dashboard": { en: "Go to dashboard", tn: "روح للوحة" },
  "checkout.no_whatsapp": {
    en: "WhatsApp number not set yet. Please contact support.",
    tn: "رقم واتساب مازال ما تحطّش. اتصل بالدعم.",
  },

  // ---- locked features (free account reaching a paid control) ----
  // The wall names what the user just reached for. One generic "upgrade" for
  // every control tells them nothing about what they are buying.
  "lock.title": { en: "Part of the full plan", tn: "من الاشتراك الكامل" },
  "lock.session": {
    en: "Recording your sets and reps is part of the full plan.",
    tn: "تسجيل السيريات والتكرارات من الاشتراك الكامل.",
  },
  "lock.meal_log": {
    en: "The food diary is part of the full plan.",
    tn: "دفتر الماكلة من الاشتراك الكامل.",
  },
  "lock.checkin": {
    en: "The morning check-in is part of the full plan.",
    tn: "تسجيل الصباح من الاشتراك الكامل.",
  },
  "lock.progress": {
    en: "Progress charts are part of the full plan.",
    tn: "رسومات التقدّم من الاشتراك الكامل.",
  },
  "lock.ai": {
    en: "The AI calorie camera is part of the full plan.",
    tn: "كاميرا السعرات بالذكاء من الاشتراك الكامل.",
  },
  "lock.qa": {
    en: "Asking the coach is part of the full plan.",
    tn: "تسأل المدرّب من الاشتراك الكامل.",
  },
  "lock.free_note": {
    en: "Your program and your macros stay free — always.",
    tn: "البرنامج والماكرو متاعك يبقاو فابور — ديما.",
  },
  "lock.cta": { en: "See plans", tn: "شوف العروض" },
  "lock.not_now": { en: "Not now", tn: "موش توّا" },

  // ---- AI walkthrough, shown to anyone not on Premium ----
  "ai.how_title": { en: "How it works", tn: "كيفاش تخدم" },
  "ai.how_1": { en: "Photograph your meal", tn: "صوّر ماكلتك" },
  "ai.how_1_body": {
    en: "One photo from your phone camera — no weighing, no searching a database.",
    tn: "تصويرة وحدة بالتليفون — بلا ما توزن، بلا ما تلوّج في قاعدة بيانات.",
  },
  "ai.how_2": { en: "It reads the plate", tn: "يقرا الصحن" },
  "ai.how_2_body": {
    en: "Each food is identified with its portion, calories and macros — and you can correct anything before it counts.",
    tn: "كل ماكلة تتعرّف بالكمية والسعرات والماكرو — وتنجم تصلّح أي حاجة قبل ما تتحسب.",
  },
  "ai.how_3": { en: "It lands in your diary", tn: "يتسجّل في الدفتر" },
  "ai.how_3_body": {
    en: "One tap logs it against today's targets, like anything else you eat.",
    tn: "كبسة وحدة تسجّلو على أهداف اليوم، كيف أي حاجة أخرى تاكلها.",
  },
  "ai.premium_only": {
    en: "Part of Premium — it costs us per photo, so it isn't in Standard.",
    tn: "من بريميوم — يكلّفنا على كل تصويرة، على هكة ماهوش في ستاندرد.",
  },

  // ---- one consolidated upgrade card, for the dashboard ----
  "up.title": { en: "Ready to start tracking?", tn: "مستعد تبدا تسجّل؟" },
  "up.body": {
    en: "Your program and your macros are free to keep. A subscription adds the daily side:",
    tn: "البرنامج والماكرو متاعك يبقاو فابور. الاشتراك يزيدلك الجزء اليومي:",
  },
  "up.i1": { en: "Log your sets, reps and weights", tn: "سجّل السيريات والتكرارات والأوزان" },
  "up.i2": { en: "Food diary against your macros", tn: "دفتر ماكلة على حساب الماكرو متاعك" },
  "up.i3": { en: "Progress charts and the weekly review", tn: "رسومات التقدّم ومراجعة الجمعة" },
  "up.i4": { en: "Ask the coach your own questions", tn: "اسأل المدرّب أسئلتك إنت" },

  // ---- free-account banner ----
  "free.title": { en: "Your plan is ready", tn: "البرنامج متاعك جاهز" },
  "free.body": {
    en: "Building it and reading it is free. Subscribe when you want to start logging your training and meals against it.",
    tn: "تعملو وتقراه فابور. اشترك كي تحب تبدا تسجّل التمرين والماكلة متاعك.",
  },

  // ---- checkout, step by step ----
  "co.step": { en: "Step", tn: "خطوة" },
  "co.of": { en: "of", tn: "من" },
  "co.s1": { en: "Pick your plan", tn: "اختار العرض" },
  // Step 2 is now the transfer *and* the receipt on one screen. They used to be
  // two, and the second one converted at 5%: a customer who had already done
  // the thing they think of as paying had no reason left to come back.
  "co.s2": { en: "Pay and send the receipt", tn: "خلّص وابعث الوصل" },
  "co.s3": { en: "Send the receipt", tn: "ابعث الوصل" },
  "co.attach_receipt": { en: "Attach your receipt", tn: "حمّل الوصل" },
  "co.pay_and_send": {
    en: "Send the receipt and open my account",
    tn: "ابعث الوصل وافتحلي الحساب",
  },
  "co.later": { en: "I'll send the receipt later", tn: "باش نبعث الوصل من بعد" },
  // What a customer sees when they come back to an order they never finished.
  // Deliberately not "we're checking your payment" — nothing is being checked
  // until a receipt exists, and saying otherwise is how 83 people ended up
  // waiting for a review that was never going to happen.
  "co.saved_title": { en: "Your order is saved", tn: "طلبك تسجّل" },
  "co.saved_body": {
    en: "Once you've made the transfer, come back here and attach the receipt — that is what opens your account.",
    tn: "كي تكمّل التحويل، ارجع لهوني وحمّل الوصل — هو اللي يحلّلك الحساب.",
  },
  // The wait, stated where the decision is made rather than on the screen after
  // it. Real average today is about twelve hours.
  "co.promise": {
    en: "We open your account within a few hours, and message you on WhatsApp the moment it's done.",
    tn: "نحلّولك الحساب في ظرف بضع ساعات، ونراسلوك على واتساب كي يتحل.",
  },
  "co.next": { en: "Continue", tn: "كمّل" },
  // The same button for somebody who has not made an account yet. It says what
  // the tap does, because a button labelled "continue" that produces a sign-up
  // form reads as a bait-and-switch.
  "co.next_signup": { en: "Create my account", tn: "أعمل حسابي" },
  "co.next_signup_why": {
    en: "Takes a minute. We need it to open your plan and to reach you when your payment lands.",
    tn: "دقيقة برك. نحتاجوه باش نحلّولك البرنامج ونوصلولك كي يوصل الخلاص.",
  },
  "co.back": { en: "Back", tn: "لور" },
  "co.you_pay": { en: "You pay", tn: "تخلّص" },
  "co.send_to": { en: "Send it to", tn: "ابعثها لـ" },
  "co.transfer_done": { en: "I've sent it", tn: "بعثتها" },
  "co.upload_title": { en: "Send us the receipt", tn: "ابعثلنا الوصل" },
  "co.upload_body": {
    en: "A screenshot of the transfer is enough. We check it and open your account.",
    tn: "تصويرة للتحويل تكفي. نشوفوها ونحلّولك الحساب.",
  },
  "co.choose_file": { en: "Choose screenshot", tn: "اختار التصويرة" },
  "co.change_file": { en: "Choose a different one", tn: "بدّل التصويرة" },
  "co.note_label": { en: "Anything we should know? (optional)", tn: "فما حاجة لازمنا نعرفوها؟ (اختياري)" },
  "co.note_ph": {
    en: "e.g. I paid from my brother's account",
    tn: "مثال: خلّصت من حساب خويا",
  },
  "co.submit": { en: "Send for review", tn: "ابعث للمراجعة" },
  "co.sending": { en: "Sending…", tn: "قاعد يتبعث…" },
  "co.file_too_big": { en: "Image must be under 5 MB.", tn: "التصويرة لازم تكون أقل من 5 ميغا." },
  "co.file_not_image": { en: "That file isn't an image.", tn: "هذا الملف موش تصويرة." },
  "co.need_help": { en: "Something wrong? Message us", tn: "فما مشكلة؟ راسلنا" },

  // ---- the payment method picker ----
  //
  // The long walkthroughs are gone from this screen. Each method gets one line
  // in the database (`hint_*`, migration 048) answering whatever the account
  // number does not already say; these are the strings around it.
  "co.method_no_account": {
    en: "This method isn't ready yet — pick another one.",
    tn: "الطريقة هاذي مازالت ما تحضّرتش — اختار وحدة أخرى.",
  },
  "co.suggest_cta": { en: "My method isn't here", tn: "الطريقة متاعي ماهيش موجودة" },
  "co.suggest_title": { en: "How do you want to pay?", tn: "كيفاش تحب تخلّص؟" },
  "co.suggest_ph": { en: "e.g. Poste, e-Dinar, cash", tn: "مثال: البريد، e-Dinar، كاش" },
  "co.suggest_send": { en: "Send", tn: "ابعث" },
  "co.suggest_note": {
    en: "We'll message you on WhatsApp to sort it out.",
    tn: "باش نراسلوك على واتساب باش نرتّبوها.",
  },
  "co.suggest_sent": {
    en: "Got it — we'll be in touch shortly.",
    tn: "وصلتنا — باش نتصلو بيك قريب.",
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
  "tour.title": { en: "Look inside first", tn: "شوف التطبيق من الداخل" },
  "tour.sub": {
    en: "Tap around — this is the app, with someone else's numbers in it.",
    tn: "دوّر فيه كيما تحب — هذا هو التطبيق، بأرقام متاع شخص آخر.",
  },
  "tour.sample": { en: "Sample", tn: "نموذج" },
  "tour.skip": { en: "Skip to the plans", tn: "تخطّى للعروض" },
  "tour.open": { en: "Open the preview", tn: "حلّ المعاينة" },

  // Today
  "tour.t_greeting": { en: "Today", tn: "اليوم" },
  "tour.t_name": { en: "Yassine", tn: "ياسين" },
  "tour.t_streak": { en: "5 day streak", tn: "5 أيام متتالية" },
  "tour.t_week": { en: "Week: 2/3", tn: "الجمعة: 2/3" },
  "tour.t_workout": { en: "Today's session", tn: "حصة اليوم" },
  "tour.t_day": { en: "Push A", tn: "دفع A" },
  "tour.t_meta": { en: "6 exercises · about 45 min", tn: "6 تمارين · حوالي 45 دقيقة" },
  "tour.t_start": { en: "Start the session", tn: "ابدا الحصة" },
  "tour.t_checkin": { en: "Morning check-in", tn: "تسجيل الصباح" },
  "tour.t_weight": { en: "Weight", tn: "الوزن" },
  "tour.t_on_track": { en: "On track", tn: "ماشي مليح" },
  "tour.t_progress": { en: "Weight, 8 weeks", tn: "الوزن، 8 جماعي" },

  // Program
  "tour.p_title": { en: "Your program", tn: "البرنامج متاعك" },
  "tour.p_meta": { en: "3 days a week · built from your answers", tn: "3 أيام في الجمعة · مبني على إجاباتك" },
  "tour.p_day1": { en: "Push A", tn: "دفع A" },
  "tour.p_day2": { en: "Pull B", tn: "سحب B" },
  "tour.p_day3": { en: "Legs", tn: "الساقين" },
  "tour.p_ex1": { en: "Barbell Bench Press", tn: "ضغط بار للصدر" },
  "tour.p_ex2": { en: "Incline Dumbbell Press", tn: "ضغط دمبل مائل" },
  "tour.p_ex3": { en: "Lateral Raise", tn: "رفع جانبي" },
  "tour.p_ex4": { en: "Triceps Pushdown", tn: "دفع الترايسبس" },
  "tour.p_ex5": { en: "Cable Crossover", tn: "تقاطع الكابل" },
  "tour.p_rest": { en: "90 s rest", tn: "90 ثانية راحة" },
  "tour.p_swap": { en: "Swap an exercise", tn: "بدّل تمرين" },

  // Nutrition
  "tour.f_title": { en: "Your meals", tn: "الماكلة متاعك" },
  "tour.f_left": { en: "left today", tn: "باقي اليوم" },
  "tour.f_b": { en: "Breakfast", tn: "فطور الصباح" },
  "tour.f_b_items": { en: "Eggs, bread, olive oil", tn: "عظم، خبز، زيت زيتون" },
  "tour.f_l": { en: "Lunch", tn: "الغدا" },
  "tour.f_l_items": { en: "Chicken, rice, salad", tn: "دجاج، رز، سلاطة" },
  "tour.f_d": { en: "Dinner", tn: "العشا" },
  "tour.f_d_items": { en: "Tuna, couscous, vegetables", tn: "تن، كسكسي، خضرة" },
  "tour.f_s": { en: "Snack", tn: "سناك" },
  "tour.f_s_items": { en: "Yoghurt, almonds", tn: "ياغورت، لوز" },
  "tour.f_swap": { en: "Swap this meal", tn: "بدّل هذي الوجبة" },

  // AI camera
  "tour.ai_title": { en: "Point it at your plate", tn: "صوّر الصحن متاعك" },
  "tour.ai_sub": { en: "Premium", tn: "بريميوم" },
  "tour.ai_i1": { en: "Grilled chicken · 180 g", tn: "دجاج مشوي · 180 غ" },
  "tour.ai_i2": { en: "White rice · 150 g", tn: "رز أبيض · 150 غ" },
  "tour.ai_i3": { en: "Olive oil · 10 g", tn: "زيت زيتون · 10 غ" },
  "tour.ai_shoot": { en: "Take a photo", tn: "صوّر" },

  // Q&A
  "tour.qa_title": { en: "Answers", tn: "الأسئلة" },
  "tour.qa_q1": {
    en: "Should I train if I'm still sore?",
    tn: "نتمرّن وأنا مازلت موجوع؟",
  },
  "tour.qa_a1": {
    en: "Mild soreness is fine — train. Sharp pain in a joint is not; move that muscle later in the week.",
    tn: "وجيعة خفيفة عادي — تمرّن. أما وجيعة حادة في مفصل لا؛ أجّل ذاك العضل لآخر الجمعة.",
  },
  "tour.qa_q2": {
    en: "Do I have to eat exactly what the plan says?",
    tn: "لازم ناكل بالضبط اللي في البرنامج؟",
  },
  "tour.qa_a2": {
    en: "No. Hit your protein and stay near the calories — swap anything else for what you actually have at home.",
    tn: "لا. كمّل البروتين وابقى قريب من السعرات — بدّل أي حاجة أخرى باللي عندك في الدار.",
  },
  "tour.qa_q3": {
    en: "How fast should I be losing weight?",
    tn: "قداش لازم ننقص بالسرعة؟",
  },
  "tour.qa_a3": {
    en: "About 0.5–1% of your bodyweight a week. Faster than that and you start giving back muscle.",
    tn: "تقريباً 0.5 حتى 1% من وزنك في الجمعة. أسرع من هكّا تبدا تخسر عضل.",
  },
  "tour.qa_ask": { en: "Ask the coach", tn: "اسأل المدرب" },

  // The wall
  "tour.lock_title": { en: "This part becomes yours", tn: "هذا الجزء يولّي متاعك" },
  "tour.lock_body": {
    en: "Everything here fills with your own numbers — your split, your macros, your meals — built from eight questions. Pick a plan and we open it today.",
    tn: "الكل هوني يتعمّر بالأرقام متاعك — التقسيم، الماكرو، الوجبات — مبنيين على 8 أسئلة. اختار عرض ونحلّولك اليوم.",
  },
  "tour.lock_cta": { en: "Pick your plan", tn: "اختار العرض" },
  "tour.lock_back": { en: "Keep looking", tn: "كمّل تفرّج" },
  "co.review_title": { en: "We're checking your payment", tn: "قاعدين نشوفو في الخلاص متاعك" },
  "co.review_body": {
    en: "Usually within a few hours. We'll message you the moment your account opens.",
    tn: "عادةً في ظرف ساعات. باش نراسلوك وقت ما يتحل حسابك.",
  },
  "co.review_have_proof": { en: "Receipt received", tn: "الوصل وصل" },
  "co.review_no_proof": {
    en: "We don't have your receipt yet — sending it gets you opened up faster.",
    tn: "مازال ما وصلناش الوصل — كي تبعثو يتسرّع الأمر.",
  },
  "co.meanwhile": {
    en: "Meanwhile, your program and macros are still yours to read.",
    tn: "في الأثناء، البرنامج والماكرو متاعك تنجم تقراهم عادي.",
  },
  // The free tier has to be visible *on the paid page*, or landing here still
  // reads as "pay or leave" — which is the thing that broke the old funnel.
  "co.stay_free": {
    en: "Not now — keep using the free plan",
    tn: "موش توّا — نكمّل بالخطة الفابور",
  },
  "co.free_line": {
    en: "Your program and your macros stay free either way. You're paying to track against them.",
    tn: "البرنامج والماكرو متاعك يبقاو فابور في كل الحالات. إنت تخلّص باش تسجّل عليهم.",
  },
  "co.rejected_title": {
    en: "We couldn't confirm that payment",
    tn: "ما نجّمناش نأكّدو الخلاص هذاك",
  },
  "co.rejected_body": {
    en: "Nothing was taken from your account by us. Check the transfer went through, then try again — or message us and we'll sort it out.",
    tn: "ما خذينا شيء من حسابك. تثبّت إذا التحويل نجح، وعاود جرّب — ولا راسلنا ونحلّوها.",
  },

  // ---- admin: payment proof ----
  "admin.proof": { en: "Receipt", tn: "الوصل" },
  "admin.hint_en": { en: "One line, shown at checkout (EN)", tn: "سطر واحد، يظهر في الخلاص (EN)" },
  "admin.hint_ar": { en: "One line, shown at checkout (AR)", tn: "سطر واحد، يظهر في الخلاص (AR)" },
  "admin.logo_url": {
    en: "Logo URL — blank draws a monogram tile",
    tn: "رابط اللوقو — كان فارغ يتعمل مربّع بالحروف",
  },
  "admin.proof_none": { en: "No receipt uploaded", tn: "ما فماش وصل" },
  // How long this person has been waiting. The queue is newest-first, which is
  // right for confirming payments and wrong for noticing who has been left —
  // the one customer who has waited two days sits at the bottom. The badge
  // carries that to the top of each row instead of reordering the list.
  "admin.waiting_h": { en: "waiting {n}h", tn: "مستنّي {n} ساعة" },
  "admin.waiting_d": { en: "waiting {n}d", tn: "مستنّي {n} يوم" },
  "admin.waiting_new": { en: "just now", tn: "توّا" },
  "admin.proof_note": { en: "Customer note", tn: "ملاحظة الحريف" },
  "admin.proof_open": { en: "Open full size", tn: "افتح بالحجم الكامل" },

  // ---- admin ----
  "admin.title": { en: "Admin", tn: "الإدارة" },
  "admin.settings": { en: "Payment settings", tn: "إعدادات الخلاص" },
  "admin.price": { en: "Price (DT)", tn: "السعر (دينار)" },
  "admin.compare_at": { en: "Compare-at price (DT)", tn: "السعر القديم (دينار)" },
  "admin.offer_en": { en: "Offer label (EN)", tn: "نص العرض (إنجليزي)" },
  "admin.offer_ar": { en: "Offer label (AR)", tn: "نص العرض (عربي)" },
  "admin.whatsapp_number": { en: "WhatsApp number", tn: "رقم واتساب" },
  "admin.msg_en": { en: "WhatsApp message (EN)", tn: "رسالة واتساب (إنجليزي)" },
  "admin.msg_ar": { en: "WhatsApp message (AR)", tn: "رسالة واتساب (عربي)" },
  "admin.methods": { en: "Payment methods", tn: "طرق الخلاص" },
  "admin.method_enabled": { en: "Enabled", tn: "مفعّل" },
  "admin.account_value": { en: "Account / number / address", tn: "الحساب / الرقم / العنوان" },
  "admin.instructions_en": { en: "Instructions (EN)", tn: "الشرح (إنجليزي)" },
  "admin.instructions_ar": { en: "Instructions (AR)", tn: "الشرح (عربي)" },
  "admin.requests": { en: "Pending requests", tn: "الطلبات المعلّقة" },
  "admin.activate": { en: "Activate", tn: "فعّل" },
  "admin.reject": { en: "Reject", tn: "ارفض" },
  "admin.no_requests": { en: "No pending requests.", tn: "ما فماش طلبات معلّقة." },
  "admin.wa_confirm": { en: "WhatsApp", tn: "واتساب" },
  "admin.contacted": { en: "Contacted", tn: "تكلّمنا معاه" },
  "admin.not_contacted": { en: "Not contacted", tn: "ما تكلّمناش معاه" },
  "admin.contact_all": { en: "Everyone", tn: "الكل" },
  "admin.mark_uncontacted": {
    en: "Mark as not contacted",
    tn: "رجّعو لـ ما تكلّمناش معاه",
  },
  "admin.no_phone": {
    en: "No number yet",
    tn: "ما فماش نمرة",
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
      "أهلا {name}، مرحبا بيك معانا في HYPE FITNESS. وصلنا طلب الدفع متاعك " +
      "({plan} · {amount} دينار). تحب نعاونك خطوة بخطوة كيفاش t’activi الcompte متاعك ؟",
  },
  "admin.save": { en: "Save", tn: "احفظ" },
  "admin.plans_title": { en: "Subscription plans", tn: "عروض الاشتراك" },
  "admin.months_short": { en: "mo", tn: "شهر" },
  "admin.saved": { en: "Saved", tn: "تسجّل" },

  // ---- admin nav ----
  "admin.nav_app": { en: "Back to app", tn: "ارجع للتطبيق" },
  "admin.nav_payments": { en: "Payments", tn: "الخلاص" },
  "admin.nav_foods": { en: "Foods", tn: "المأكولات" },
  "admin.nav_exercises": { en: "Exercises", tn: "التمارين" },

  // ---- foods admin ----
  "foods.title": { en: "Foods", tn: "المأكولات" },
  "foods.add": { en: "Add food", tn: "زيد ماكلة" },
  "foods.search": { en: "Search foods…", tn: "لوّج على ماكلة…" },
  "foods.edit": { en: "Edit", tn: "بدّل" },
  "foods.delete": { en: "Delete", tn: "امسح" },
  "foods.save": { en: "Save", tn: "احفظ" },
  "foods.cancel": { en: "Cancel", tn: "الغي" },
  "foods.saved": { en: "Saved", tn: "تسجّل" },
  "foods.empty": { en: "No foods yet. Add the first one.", tn: "ما فماش مأكولات. زيد الأولى." },
  "foods.confirm_delete": { en: "Delete this food?", tn: "تمسح هالماكلة؟" },
  "foods.name_ar": { en: "Name (Arabic)", tn: "الاسم (عربي)" },
  "foods.name_en": { en: "Name (English)", tn: "الاسم (إنجليزي)" },
  "foods.category": { en: "Category", tn: "الصنف" },
  "foods.calories": { en: "Calories /100g", tn: "السعرات /100غ" },
  "foods.protein": { en: "Protein /100g", tn: "البروتين /100غ" },
  "foods.carbs": { en: "Carbs /100g", tn: "الكربوهيدرات /100غ" },
  "foods.fat": { en: "Fat /100g", tn: "الدهون /100غ" },
  "foods.fiber": { en: "Fiber /100g", tn: "الألياف /100غ" },
  "foods.serving": { en: "Typical serving (g)", tn: "الحصة العادية (غ)" },
  "foods.price": { en: "Price (DT/kg)", tn: "السعر (دينار/كغ)" },
  "foods.price_tier": { en: "Price tier", tn: "مستوى السعر" },
  "foods.allergens": {
    en: "Allergens (separate with commas)",
    tn: "مسببات الحساسية — أكتب وافصل بينهم بفاصلة",
  },
  "foods.tags": {
    en: "Search tags (separate with commas)",
    tn: "كلمات للبحث — أكتب وافصل بينهم بفاصلة",
  },
  "foods.is_common": { en: "Common food", tn: "ماكلة شائعة" },
  "foods.none": { en: "—", tn: "—" },

  // ---- image upload (shared) ----
  "image.label": { en: "Picture", tn: "التصويرة" },
  "image.upload": { en: "Upload picture", tn: "زيد تصويرة" },
  "image.uploading": { en: "Uploading…", tn: "قاعد يطلّع…" },
  "image.remove": { en: "Remove", tn: "نحّي" },
  "image.too_big": { en: "Image must be under 5 MB.", tn: "التصويرة لازم تكون أقل من 5 ميغا." },

  // ---- exercises admin ----
  "ex.title": { en: "Exercises", tn: "التمارين" },
  "ex.add": { en: "Add exercise", tn: "زيد تمرين" },
  "ex.search": { en: "Search exercises…", tn: "لوّج على تمرين…" },
  "ex.edit": { en: "Edit", tn: "بدّل" },
  "ex.delete": { en: "Delete", tn: "امسح" },
  "ex.save": { en: "Save", tn: "احفظ" },
  "ex.cancel": { en: "Cancel", tn: "الغي" },
  "ex.empty": { en: "No exercises yet. Add the first one.", tn: "ما فماش تمارين. زيد الأول." },
  "ex.confirm_delete": { en: "Delete this exercise?", tn: "تمسح هالتمرين؟" },
  "ex.name_ar": { en: "Name (Arabic)", tn: "الاسم (عربي)" },
  "ex.name_en": { en: "Name (English)", tn: "الاسم (إنجليزي)" },
  "ex.primary_muscle": { en: "Primary muscle", tn: "العضلة الرئيسية" },
  "ex.secondary_muscles": {
    en: "Secondary muscles (separate with commas)",
    tn: "العضلات الثانوية — أكتب وافصل بينهم بفاصلة",
  },
  "ex.equipment": { en: "Equipment", tn: "المعدات" },
  "ex.movement_pattern": { en: "Movement pattern", tn: "نمط الحركة" },
  "ex.difficulty": { en: "Difficulty", tn: "الصعوبة" },
  "ex.contraindicated_for": {
    en: "Avoid with these injuries (separate with commas)",
    tn: "الإصابات اللي لازم تتجنّبها — أكتب وافصل بينهم بفاصلة",
  },
  "ex.video_url": { en: "Video URL", tn: "رابط الفيديو" },
  "ex.instructions": { en: "Instructions", tn: "الشرح" },

  // ---- landing ----
  "home.hero": {
    en: "Your personal coach for eating and training, without a coach.",
    tn: "المدرّب متاعك للماكلة والتمرين، بلا ما تخلّص مدرّب.",
  },
  "home.sub": {
    en: "Answer a few simple questions. Get a plan made for you. Edit it however you like.",
    tn: "جاوب على شويّة أسئلة ساهلة. تاخو برنامج معمول على قدّك. وبدّلو كيما يعجبك.",
  },
  "home.cta": { en: "Get started", tn: "يالله نبدأو" },

  // ---- auth / login ----
  "login.signin_title": { en: "Welcome back", tn: "مرحبا بيك مرّة أخرى" },
  "login.signup_title": { en: "Create your account", tn: "أعمل حسابك" },
  "login.signin_sub": {
    en: "Sign in to continue your plan.",
    tn: "أدخل باش تكمّل برنامجك.",
  },
  "login.signup_sub": {
    en: "Start building your diet and workout plans.",
    tn: "أبدا اعمل برنامج الماكلة والتمرين متاعك.",
  },
  "login.full_name": { en: "Full name", tn: "الاسم الكامل" },
  "login.full_name_ph": { en: "Your name", tn: "اسمك" },
  "login.email": { en: "Email", tn: "الإيميل" },
  "login.password": { en: "Password", tn: "كلمة السر" },
  "login.phone": { en: "WhatsApp number", tn: "نمرة الواتساب" },
  "login.phone_ph": { en: "26 341 616", tn: "26 341 616" },
  "login.phone_hint": {
    en: "So we can reach you about your account.",
    tn: "باش نجمو نوصلولك على حسابك.",
  },

  // The /phone gate — shown once, to anyone who has no number on file. Google
  // users always land here, since OAuth never gives us one.
  "phone.title": { en: "One last thing", tn: "حاجة أخيرة" },
  "phone.sub": {
    en: "Leave us your WhatsApp number so we can reach you about your account.",
    tn: "خلّيلنا نمرة الواتساب متاعك باش نجمو نوصلولك على حسابك.",
  },
  "phone.label": { en: "WhatsApp number", tn: "نمرة الواتساب" },
  "phone.save": { en: "Save and continue", tn: "سجّل وكمّل" },
  "phone.saving": { en: "Saving…", tn: "قاعد يسجّل…" },
  "phone.invalid": {
    en: "That doesn't look like a valid mobile number.",
    tn: "النمرة هذي ما تبانش صحيحة.",
  },
  "phone.why": {
    en: "We only use it to contact you about your subscription. Never shared.",
    tn: "نستعملوها برك باش نكلموك على الاشتراك متاعك. ما نعطيوهاش لحتى حد.",
  },
  "login.please_wait": { en: "Please wait…", tn: "استنّى شويّة…" },
  "login.sign_in": { en: "Sign in", tn: "أدخل" },
  "login.create_account": { en: "Create account", tn: "اعمل حساب" },
  "login.or": { en: "or", tn: "ولا" },
  "login.google": { en: "Continue with Google", tn: "كمّل بـ Google" },
  "login.no_account": { en: "No account?", tn: "ما عندكش حساب؟" },
  "login.create_one": { en: "Create one", tn: "اعمل واحد" },
  "login.have_account": {
    en: "Already have an account?",
    tn: "عندك حساب قبل؟",
  },
  "login.sign_in_link": { en: "Sign in", tn: "أدخل" },
  "login.failed": {
    en: "Sign-in failed. Please try again.",
    tn: "الدخول فشل. عاود جرّب.",
  },
  // What a failed sign-in or sign-up actually says. The auth server's own
  // messages are English whatever the user is reading, and some of them are
  // not sentences at all (a JSON parse error, when something between us and
  // Supabase returns a page instead of an answer). `actions/auth.ts` maps
  // every failure onto one of these codes.
  "login.err_bad_credentials": {
    en: "Wrong email or password.",
    tn: "الإيميل ولا كلمة السر ماهمش صحاح.",
  },
  "login.err_email_taken": {
    en: "That email already has an account — sign in instead.",
    tn: "الإيميل هذا عندو حساب من قبل — أدخل بيه.",
  },
  "login.err_weak_password": {
    en: "Pick a longer password — at least 6 characters.",
    tn: "أعمل كلمة سر أطول — 6 حروف على الأقل.",
  },
  "login.err_email_unconfirmed": {
    en: "Confirm your email first — check your inbox.",
    tn: "أكّد إيميلك الأول — شوف صندوق الوارد.",
  },
  "login.err_rate_limited": {
    en: "Too many attempts. Wait a minute and try again.",
    tn: "برشا محاولات. استنّى دقيقة وعاود.",
  },
  "login.err_unavailable": {
    en: "We couldn't reach the server. Check your connection and try again.",
    tn: "ما نجّمناش نوصلو للسيرفر. شوف الكونيكسيون وعاود جرّب.",
  },
  "login.check_inbox": {
    en: "Check your inbox to confirm your email, then sign in.",
    tn: "شوف إيميلك باش تأكّدو، ومبعد أدخل.",
  },
  "login.choose_title": { en: "Where to?", tn: "وين تحب تمشي؟" },
  "login.choose_sub": {
    en: "You're an admin. Pick where to go.",
    tn: "إنت أدمين. اختار وين تدخل.",
  },
  "login.go_admin": { en: "Admin panel", tn: "لوحة الأدمين" },
  "login.go_app": { en: "Continue to the app", tn: "كمّل للتطبيق" },

  // ---- common ----
  "common.error": { en: "Something went wrong.", tn: "صار مشكل." },
  "common.error_title": {
    en: "That didn't go through",
    tn: "الطلب ما نجحش",
  },
  "common.error_body": {
    en: "The connection dropped for a second. Nothing you saved was lost — try again.",
    tn: "الكونيكسيون تقطعت ثانية. اللي سجّلته ما ضاعش — عاود جرّب.",
  },
  "common.retry": { en: "Try again", tn: "عاود جرّب" },
  "common.go_home": { en: "Back to Home", tn: "ارجع للعيسية" },

  // ---- app bottom nav ----
  "nav.home": { en: "Home", tn: "الرئيسية" },
  "nav.workouts": { en: "Workouts", tn: "التمارين" },
  "nav.nutrition": { en: "Nutrition", tn: "الأكل" },
  "nav.ai": { en: "AI", tn: "ذكاء" },
  "nav.qa": { en: "Q&A", tn: "أسئلة" },
  "nav.profile": { en: "Profile", tn: "حسابي" },

  // ---- dashboard ----
  "dashboard.greeting": { en: "Welcome back", tn: "أهلا بيك" },
  "dashboard.diet_title": { en: "Your diet", tn: "الأكل متاعك" },
  "dashboard.diet_not_started": {
    en: "Answer a few questions to get your plan.",
    tn: "جاوب على شويّة أسئلة باش تاخو البرنامج متاعك.",
  },
  "dashboard.workout_title": { en: "Your workout", tn: "التمرين متاعك" },
  "dashboard.workout_not_started": {
    en: "Answer a few questions to get your program.",
    tn: "جاوب على شويّة أسئلة باش تاخو البرنامج متاعك.",
  },
  "dashboard.qa_title": { en: "Learn", tn: "اتعلّم" },
  "dashboard.qa_sub": {
    en: "Answers to the most common fitness questions.",
    tn: "إجابات على أكثر الأسئلة اللي تخطر ببالك.",
  },
  "dashboard.status_active": { en: "Active", tn: "شغّال" },
  "dashboard.status_not_started": { en: "Not started", tn: "ما بداش بعد" },
  "dashboard.cta_start": { en: "Get started", tn: "يالله نبدأو" },
  "dashboard.cta_view": { en: "View plan", tn: "شوف البرنامج" },
  "dashboard.cta_explore": { en: "Explore", tn: "أكتشف" },
  "dashboard.hero_eyebrow_plan": { en: "Your plan", tn: "برنامجك" },
  "dashboard.hero_eyebrow_setup": { en: "Get started", tn: "يالله نبدأو" },
  "dashboard.nutrition_label": { en: "Nutrition", tn: "الأكل" },
  "dashboard.training_label": { en: "Training", tn: "التمرين" },
  "dashboard.not_setup": { en: "Not set up yet", tn: "ما تعمّلش بعد" },
  "dashboard.days_per_week_suffix": { en: "days/week", tn: "أيام/الجمعة" },

  // ---- Q&A spark (dashboard random question card) ----
  "qa.spark_eyebrow": { en: "From the Q&A library", tn: "من مكتبة الأسئلة" },
  "qa.another": { en: "Show another question", tn: "وريني سؤال آخر" },
  "qa.open_answer": { en: "Open full answer", tn: "شوف الإجابة كاملة" },

  // ---- settings ----
  "settings.title": { en: "Settings", tn: "الإعدادات" },
  "settings.language": { en: "Language", tn: "اللغة" },
  "settings.redo_diet": { en: "Redo my diet goals", tn: "بدّل أهداف الأكل" },
  "settings.redo_workout": { en: "Redo my workout goals", tn: "بدّل أهداف التمرين" },
  "settings.sign_out": { en: "Sign out", tn: "اخرج" },
  "settings.admin_panel": { en: "Admin panel", tn: "لوحة الأدمين" },
  "settings.edit_mode": { en: "Edit mode", tn: "وضع التعديل" },

  // ---- monthly plan rebuild allowance ----
  "redo.remaining": {
    en: "{remaining} of {total} left this month",
    tn: "باقيلك {remaining} من {total} هالشهر",
  },
  "redo.none_left": {
    en: "No rebuilds left this month — you can redo it next month.",
    tn: "ما باقيلكش تبديل هالشهر — تنجّم تعاود الشهر الجاي.",
  },
  "redo.limit_title": { en: "Come back next month", tn: "ارجع الشهر الجاي" },
  "redo.quota_blocked": {
    en: "You've used all {total} plan rebuilds for this month. Give this plan a real chance — you can redo it next month.",
    tn: "استعملت {total} تبديلات متاع البرنامج الكل هالشهر. اعطي البرنامج هذا فرصة بالحق — تنجّم تعاود الشهر الجاي.",
  },
  "redo.back_to_settings": { en: "Back to settings", tn: "ارجع للإعدادات" },

  // ---- diet maker: questions ----
  "diet.q_gender": { en: "Are you a man or a woman?", tn: "راجل ولا مرا؟" },
  "diet.gender_male": { en: "Man", tn: "راجل" },
  "diet.gender_female": { en: "Woman", tn: "مرا" },
  "diet.q_birthdate": { en: "How old are you?", tn: "قداش عمرك؟" },
  "diet.q_height": { en: "How tall are you?", tn: "قداش طولك؟" },
  "diet.q_weight": { en: "What's your weight right now?", tn: "قداش وزنك توّة؟" },
  "diet.q_goal": { en: "What do you want?", tn: "شنوة تحب؟" },
  "diet.goal_lose_fat": { en: "Lose fat", tn: "ننشّف" },
  "diet.goal_maintain": { en: "Stay the same, get healthier", tn: "نبقى في وزني ونتحسّن في صحتي" },
  "diet.goal_build_muscle": { en: "Build muscle", tn: "نبني عضل" },
  "diet.goal_recomp": { en: "Lose fat and build muscle together", tn: "ننشّف ونبني عضل في نفس الوقت" },
  "diet.q_activity": { en: "How does your day usually look?", tn: "كيفاش تكون نهاريتك عادة؟" },
  "diet.activity_sedentary": { en: "I sit most of the day", tn: "نقعد أغلب النهار" },
  "diet.activity_light": { en: "I move a little", tn: "نتحرّك شويّة" },
  "diet.activity_moderate": { en: "I'm on my feet often", tn: "نكون واقف برشة" },
  "diet.activity_active": { en: "Physical job or training daily", tn: "خدمة جسدية ولا نتمرّن كل يوم" },
  "diet.activity_very_active": { en: "Very physical job and training", tn: "خدمة جسدية قوية ونتمرّن" },
  "diet.q_meals": { en: "How many times a day do you eat?", tn: "قداش مرة تاكل في النهار؟" },
  "diet.q_budget": { en: "What's your food budget like?", tn: "كيفاش ميزانية الماكلة متاعك؟" },
  "diet.budget_low": { en: "Tight, I need cheap options", tn: "ضيّقة، لازمني حاجات رخيصة" },
  "diet.budget_medium": { en: "Normal, comfortable", tn: "عادية، مرتاح فيها" },
  "diet.budget_high": { en: "Not a concern", tn: "ماشي مشكلة" },
  "diet.q_allergies": { en: "Anything you can't eat?", tn: "فما حاجة ما تنجمش تاكلها؟" },
  "diet.q_disliked": { en: "Anything you really don't like?", tn: "فما حاجة ما تحبّش تاكلها؟" },
  "diet.q_restriction": { en: "Any way of eating you follow?", tn: "تتبع نظام أكل معيّن؟" },
  "diet.restriction_none": { en: "No restriction", tn: "بلا قيود" },
  "diet.restriction_vegetarian": { en: "Vegetarian", tn: "نباتي" },
  "diet.restriction_pescatarian": { en: "Pescatarian", tn: "نباتي + حوت" },
  "diet.restriction_halal": { en: "Halal only", tn: "حلال فقط" },
  "diet.budget_no_pref": { en: "No preference", tn: "ما عنديش تفضيل" },

  // ---- professional questionnaire (20 Q) ----
  "diet.q_target_weight": { en: "What weight are you aiming for?", tn: "شنوة الوزن اللي تحب توصلو؟" },
  "diet.q_bodyfat": { en: "How would you describe your body fat?", tn: "كيفاش تشوف نسبة الدهون متاعك؟" },
  "diet.bodyfat_very_lean": { en: "Very lean", tn: "ضعيف برشة" },
  "diet.bodyfat_normal": { en: "Normal", tn: "عادي" },
  "diet.bodyfat_a_little_fat": { en: "A little fat", tn: "شويّة دهون" },
  "diet.bodyfat_high": { en: "High body fat", tn: "دهون عالية" },
  "diet.bodyfat_unknown": { en: "I don't know", tn: "ما نعرفش" },
  "diet.q_steps": { en: "How many steps do you walk a day?", tn: "قداش تمشي خطوة في النهار؟" },
  "diet.steps_under_4k": { en: "Under 4,000", tn: "أقل من 4000" },
  "diet.steps_4k_7k": { en: "4,000–7,000", tn: "من 4000 لـ 7000" },
  "diet.steps_7k_10k": { en: "7,000–10,000", tn: "من 7000 لـ 10000" },
  "diet.steps_over_10k": { en: "More than 10,000", tn: "أكثر من 10000" },
  "diet.steps_unknown": { en: "I don't know", tn: "ما نعرفش" },
  "diet.q_training_days": { en: "How many days do you train a week?", tn: "قداش نهار تتمرّن في الجمعة؟" },
  "diet.td_0": { en: "0 days", tn: "0 نهار" },
  "diet.td_1_2": { en: "1–2 days", tn: "1–2 نهار" },
  "diet.td_3_4": { en: "3–4 days", tn: "3–4 نهار" },
  "diet.td_5_6": { en: "5–6 days", tn: "5–6 نهار" },
  "diet.td_7": { en: "7 days", tn: "7 نهار" },
  "diet.q_training_time": { en: "When do you usually train?", tn: "وقتاش تتمرّن عادة؟" },
  "diet.tt_morning": { en: "Morning", tn: "الصباح" },
  "diet.tt_afternoon": { en: "Afternoon", tn: "بعد الظهر" },
  "diet.tt_evening": { en: "Evening", tn: "العشيّة" },
  "diet.tt_night": { en: "Night", tn: "الليل" },
  "diet.tt_changes": { en: "It changes", tn: "يتبدّل" },
  "diet.q_restrictions": { en: "Any food restriction?", tn: "فما قيود على الماكلة؟" },
  "diet.restr_none": { en: "No restriction", tn: "بلا قيود" },
  "diet.restr_no_red_meat": { en: "No red meat", tn: "بلا لحم أحمر" },
  "diet.restr_no_fish": { en: "No fish / seafood", tn: "بلا حوت" },
  "diet.restr_no_dairy": { en: "No dairy", tn: "بلا مشتقات حليب" },
  "diet.restr_no_eggs": { en: "No eggs", tn: "بلا بيض" },
  "diet.restr_vegetarian": { en: "Vegetarian", tn: "نباتي" },
  "diet.q_avoid": { en: "Any foods you'd rather avoid?", tn: "فما ماكلة تحب تتجنّبها؟" },
  "diet.avoid_none": { en: "I eat everything", tn: "ناكل كل شيء" },
  "diet.avoid_chicken": { en: "Chicken", tn: "دجاج" },
  "diet.avoid_eggs": { en: "Eggs", tn: "بيض" },
  "diet.avoid_tuna": { en: "Tuna", tn: "تن" },
  "diet.avoid_fish": { en: "Fish / seafood", tn: "حوت" },
  "diet.avoid_dairy": { en: "Milk / dairy", tn: "حليب ومشتقاتو" },
  "diet.avoid_rice": { en: "Rice", tn: "روز" },
  "diet.avoid_pasta": { en: "Pasta", tn: "مقرونة" },
  "diet.avoid_bread": { en: "Bread", tn: "خبز" },
  "diet.avoid_oats": { en: "Oats", tn: "شوفان" },
  "diet.avoid_legumes": { en: "Legumes", tn: "قطاني" },
  "diet.avoid_vegetables": { en: "Vegetables", tn: "خضرة" },
  "diet.q_cooking": { en: "How much time for cooking?", tn: "قداش وقت عندك للطياب؟" },
  "diet.cook_fast": { en: "Fast meals only", tn: "ماكلة سريعة برك" },
  "diet.cook_normal": { en: "Normal cooking", tn: "طياب عادي" },
  "diet.cook_mealprep": { en: "Meal prep for several days", tn: "نحضّر لأيام" },
  "diet.cook_no_pref": { en: "No preference", tn: "ما عنديش تفضيل" },
  "diet.q_digestion": { en: "Any digestion issues?", tn: "عندك مشاكل هضم؟" },
  "diet.dig_none": { en: "No", tn: "لا" },
  "diet.dig_bloating": { en: "Bloating", tn: "نفخة" },
  "diet.dig_lactose": { en: "Lactose problem", tn: "مشكل لاكتوز" },
  "diet.dig_high_fiber": { en: "High fiber bothers me", tn: "الألياف الكثيرة تعبّني" },
  "diet.dig_heavy_pre": { en: "Heavy meals before workout bother me", tn: "الماكلة الثقيلة قبل التمرين تعبّني" },
  "diet.q_water": { en: "How much water do you drink a day?", tn: "قداش تشرب ماء في النهار؟" },
  "diet.water_lt1": { en: "Less than 1L", tn: "أقل من 1 لتر" },
  "diet.water_1_2": { en: "1–2L", tn: "1–2 لتر" },
  "diet.water_2_3": { en: "2–3L", tn: "2–3 لتر" },
  "diet.water_gt3": { en: "More than 3L", tn: "أكثر من 3 لتر" },
  "diet.water_unknown": { en: "I don't know", tn: "ما نعرفش" },
  "diet.q_supplements": { en: "Do you use any supplements?", tn: "تستعمل مكمّلات؟" },
  "diet.supp_none": { en: "No supplements", tn: "بلا مكمّلات" },
  "diet.supp_whey": { en: "Whey protein", tn: "واي بروتين" },
  "diet.supp_creatine": { en: "Creatine", tn: "كرياتين" },
  "diet.supp_multivitamin": { en: "Multivitamin", tn: "ملتي فيتامين" },
  "diet.supp_omega3": { en: "Omega 3", tn: "أوميغا 3" },
  "diet.q_tracking": { en: "Have you tracked calories before?", tn: "حسبت السعرات قبل؟" },
  "diet.track_never": { en: "No, never", tn: "لا، عمري" },
  "diet.track_sometimes": { en: "Yes, sometimes", tn: "أيه، بعض المرّات" },
  "diet.track_expert": { en: "Yes, I know how to track", tn: "أيه، نعرف نحسب" },
  "diet.water_advice": {
    en: "Aim for about 3L of water a day.",
    tn: "حاول تشرب حوالي 3 لتر ماء في النهار.",
  },

  "diet.rationale_title": { en: "Why we picked this for you", tn: "علاش اخترنالك هكة" },
  "diet.rationale_bmr": { en: "Base metabolism", tn: "الأيض الأساسي" },
  "diet.rationale_tdee": { en: "Your daily burn", tn: "حرقك اليومي" },
  "diet.rationale_target": { en: "Your daily target", tn: "هدفك اليومي" },
  "diet.see_plan": { en: "See my plan", tn: "شوف البرنامج" },
  "diet.redo_confirm": {
    en: "This will archive your current plan and ask the questions again.",
    tn: "هذا باش يحفظ برنامجك الحالي ويرجع يسألك من جديد.",
  },

  // ---- workout maker ----
  // The 19 question texts and their options live in `questionnaire_questions`
  // (EN + AR columns), not here — migration 019/022. Only UI chrome remains.
  "workout.rationale_title": { en: "Why we picked this for you", tn: "علاش اخترنالك هكة" },
  "workout.see_program": { en: "See my program", tn: "شوف البرنامج" },

  // ---- q&a ----
  "qa.title": { en: "Q&A Library", tn: "مكتبة الأسئلة" },
  "qa.subtitle": { en: "Learn, ask, and level up.", tn: "اتعلّم، اسأل، وتطوّر." },
  "qa.search": { en: "Search a question…", tn: "لوّج على سؤال…" },
  "qa.category_all": { en: "All", tn: "الكل" },
  "qa.ask_title": { en: "Can't find your answer?", tn: "ما لقيتش إجابتك؟" },
  "qa.ask_sub": {
    en: "Ask your question and we'll add it to the library.",
    tn: "اسأل سؤالك وباش نزيدوه للمكتبة.",
  },
  "qa.ask_cta": { en: "Ask a question", tn: "اسأل سؤال" },
  "qa.ask_placeholder": { en: "Type your question…", tn: "أكتب سؤالك…" },
  "qa.ask_sent": { en: "Thanks — we'll review it soon.", tn: "شكراً — باش نراجعوه قريب." },
  "qa.empty": { en: "No questions in this category yet.", tn: "ما فماش أسئلة في هالقسم توّة." },
  "qa.answered_banner": { en: "We answered your question", tn: "جاوبنا على سؤالك" },
  "qa.answered_read": { en: "Read the answer", tn: "اقرا الإجابة" },

  // ---- q&a: the visual answer card (blocks are labelled, never a wall of text) ----
  "qa.block_question": { en: "The question", tn: "السؤال" },
  "qa.block_short_answer": { en: "Quick answer", tn: "الجواب السريع" },
  "qa.block_science": { en: "Why?", tn: "علاش؟" },
  "qa.block_practical": { en: "What to do", tn: "شنو تعمل؟" },
  "qa.block_mistake": { en: "Common mistake", tn: "غلط شائع" },
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
    tn: "باقي {n} من {total} أسئلة هالشهر",
  },
  "qa.quota_none": {
    en: "You've used your {total} questions for this month. The counter resets on the 1st.",
    tn: "استهلكت {total} أسئلة متاع هالشهر. العداد يتصفّر في 1 من الشهر الجاي.",
  },
  "qa.quota_blocked": {
    en: "No questions left this month.",
    tn: "ما باقيش أسئلة هالشهر.",
  },

  // ---- workout: start session ----
  "workout.start_day": { en: "Start this workout", tn: "ابدا الحصّة" },
  "workout.continue_day": { en: "Continue workout", tn: "كمّل الحصّة" },
  "workout.day_done": { en: "Completed", tn: "كملت" },
  "workout.locked_until_monday": { en: "Locked until Monday", tn: "مسكّرة حتى الاثنين" },

  // ---- workout session mode ----
  "session.kg": { en: "kg", tn: "كغ" },
  "session.reps": { en: "Reps", tn: "عدّات" },
  "session.rir": { en: "RIR", tn: "RIR" },
  "session.rest": { en: "rest", tn: "راحة" },
  "session.resting": { en: "Rest", tn: "راحة" },
  "session.skip_rest": { en: "Skip rest", tn: "فوّت الراحة" },
  "session.skip_exercise": { en: "Skip", tn: "فوّت" },
  "session.unskip_exercise": { en: "Undo", tn: "رجّع" },
  "session.last_time": { en: "Last time", tn: "آخر مرّة" },
  "session.add_set": { en: "Add set", tn: "زيد مجموعة" },
  "session.progress_sets": { en: "sets", tn: "مجموعات" },
  "session.notes_label": { en: "Session notes (optional)", tn: "ملاحظات على الحصّة (اختياري)" },
  "session.finish": { en: "Finish workout", tn: "كمّل الحصّة" },
  "session.saving": { en: "Saving…", tn: "قاعد يسجّل…" },
  "session.save_error": {
    en: "Couldn't save — your session is kept safely on this phone. Check your connection and try again.",
    tn: "ما نجمناش نسجّلو — حصّتك محفوظة في تليفونك. ثبّت في الاتصال وعاود جرّب.",
  },
  "session.done_title": { en: "Workout complete!", tn: "الحصّة كملت!" },
  "session.done_sub": {
    en: "Logged and counted. See you next session.",
    tn: "تسجّلت وتحسبت. نراوك في الحصّة الجاية.",
  },
  "session.stat_sets": { en: "Sets", tn: "مجموعات" },
  "session.stat_volume": { en: "Volume (kg)", tn: "الحجم (كغ)" },
  "session.stat_minutes": { en: "Minutes", tn: "دقايق" },
  "session.pr_badge": { en: "New PR!", tn: "رقم جديد!" },
  "session.pr_title": { en: "New personal records", tn: "أرقام قياسية جديدة" },
  "session.back_home": { en: "Back to home", tn: "ارجع للوحة" },

  // ---- live sessions: resume / weekly lock / sync ----
  "session.continue": { en: "Continue workout", tn: "كمّل الحصّة" },
  "session.other_in_progress": {
    en: "You already have a workout in progress",
    tn: "عندك حصّة أخرى محلولة توّا",
  },
  "session.started_ago": { en: "Started", tn: "بديتها" },
  "session.discard": { en: "Discard empty session", tn: "فسّخ الحصّة الفارغة" },
  "session.week_locked": {
    en: "Done this week — unlocks Monday",
    tn: "تعملت هالجمعة — تتحل نهار الاثنين",
  },
  "session.locked_title": { en: "This workout is completed", tn: "هالحصّة كمّلتها" },
  "session.locked_sub": {
    en: "Great work. It unlocks again on Monday — here's how it went.",
    tn: "برافو عليك. تتحل من جديد نهار الاثنين — هذا ملخّصها.",
  },
  "session.skip_confirm": { en: "Skip for good?", tn: "تفوّتها بالحق؟" },
  "session.skipped_label": { en: "Skipped", tn: "مفوّتة" },
  "session.sync_saved": { en: "All sets saved", tn: "السيتات الكل تسجّلت" },
  "session.sync_saving": { en: "Saving…", tn: "قاعد يسجّل…" },
  "session.sync_offline": {
    en: "Offline — will sync",
    tn: "ما فماش أنترنات — يتسجّل وقت ترجع",
  },
  "session.sync_offline_finish": {
    en: "Can't finish while offline — your sets are safe, retry when you're back online.",
    tn: "ما تنجمش تكمّل بلا أنترنات — السيتات محفوظة، عاود كي ترجع الشبكة.",
  },
  "session.stat_prs": { en: "PRs", tn: "أرقام قياسية" },
  "session.need_reps": { en: "Enter reps first", tn: "دخّل العدّات قبل" },
  "session.already_logged": {
    en: "Already logged this session",
    tn: "مسجّلة ديجا في هالحصّة",
  },
  "session.locked_set": { en: "Logged", tn: "تسجّلت" },
  "session.go_program": { en: "Back to program", tn: "ارجع للبرنامج" },

  // ---- dashboard: progress teaser ----
  "dashboard.progress_title": { en: "Your progress", tn: "تقدّمك" },
  "dashboard.progress_cta": { en: "See details", tn: "شوف التفاصيل" },

  // ---- progress page ----
  "progress.title": { en: "Progress", tn: "التقدّم" },
  "progress.subtitle": {
    en: "What your logging says about you.",
    tn: "شنوّا يقولو أرقامك عليك.",
  },
  "progress.weight_title": { en: "Body weight", tn: "وزن الجسم" },
  "progress.strength_title": { en: "Strength", tn: "القوة" },
  "progress.volume_week": { en: "Weekly volume (kg)", tn: "الحجم في الجمعة (كغ)" },
  "progress.consistency_title": { en: "Consistency", tn: "الانتظام" },
  "progress.muscles_title": { en: "By muscle group", tn: "حسب العضلة" },
  "progress.muscles_sub": {
    en: "Volume, last 4 weeks vs the 4 before",
    tn: "الحجم، آخر 4 جمعات مقابل الـ4 اللي قبلهم",
  },
  "progress.top_exercises": { en: "Top exercises", tn: "أهم التمارين" },
  "progress.range_30": { en: "30 days", tn: "30 يوم" },
  "progress.range_90": { en: "90 days", tn: "90 يوم" },
  "progress.trend_up": { en: "trending up", tn: "طالع" },
  "progress.trend_down": { en: "trending down", tn: "هابط" },
  "progress.trend_flat": { en: "steady", tn: "ثابت" },
  "progress.sessions_label": { en: "sessions", tn: "حصص" },
  "progress.week_streak": { en: "week streak", tn: "جمعة متتالية" },
  "progress.this_week": { en: "this week", tn: "هالجمعة" },
  "progress.prior_label": { en: "before", tn: "قبل" },
  "progress.recent_label": { en: "recent", tn: "مؤخرًا" },
  "progress.empty": {
    en: "Log a few workouts and check-ins to see your progress here.",
    tn: "سجّل شوية حصص وتشيك-إن باش تشوف تقدّمك هوني.",
  },
  "progress.empty_weight": {
    en: "Log your weight in the morning check-in to see the trend.",
    tn: "سجّل وزنك في تسجيل الصباح باش تشوف المنحنى.",
  },
  "progress.empty_strength": {
    en: "Finish a few workouts to see your strength build up.",
    tn: "كمّل شوية حصص باش تشوف قوتك كيفاش تزيد.",
  },

  // ---- muscle groups ----
  "muscle.chest": { en: "Chest", tn: "صدر" },
  "muscle.back": { en: "Back", tn: "ظهر" },
  "muscle.shoulders": { en: "Shoulders", tn: "أكتاف" },
  "muscle.quads": { en: "Quads", tn: "فخذ قدامي" },
  "muscle.hamstrings": { en: "Hamstrings", tn: "فخذ خلفي" },
  "muscle.glutes": { en: "Glutes", tn: "مؤخرة" },
  "muscle.calves": { en: "Calves", tn: "بطة الساق" },
  "muscle.biceps": { en: "Biceps", tn: "بايسبس" },
  "muscle.triceps": { en: "Triceps", tn: "ترايسبس" },
  "muscle.core": { en: "Core", tn: "بطن" },
  "muscle.forearms": { en: "Forearms", tn: "ساعد" },

  // ---- today screen: check-in ----
  "checkin.title": { en: "Morning check-in", tn: "تسجيل الصباح" },
  "checkin.subtitle": { en: "15 seconds — it powers your coaching.", tn: "١٥ ثانية — بيها نتبّعو تقدّمك." },
  "checkin.weight": { en: "Weight (kg)", tn: "الوزن (كغ)" },
  "checkin.energy_1": { en: "Exhausted", tn: "ميت بالنعس" },
  "checkin.energy_2": { en: "Low", tn: "ضعيفة" },
  "checkin.energy_3": { en: "Okay", tn: "مليح" },
  "checkin.energy_4": { en: "Good", tn: "باهي" },
  "checkin.energy_5": { en: "On fire", tn: "في الفورمة" },
  "checkin.sleep": { en: "Sleep (hours)", tn: "النوم (سوايع)" },
  "checkin.energy": { en: "Energy today", tn: "طاقتك اليوم" },
  "checkin.save": { en: "Save check-in", tn: "سجّل" },
  "checkin.saving": { en: "Saving…", tn: "قاعد يسجّل…" },
  "checkin.done": { en: "Checked in for today", tn: "تسجيل اليوم كمل" },
  "checkin.edit": { en: "Edit", tn: "بدّل" },

  // ---- today screen ----
  "today.workout_title": { en: "Today's workout", tn: "تمرين اليوم" },
  "today.start_workout": { en: "Start workout", tn: "ابدا التمرين" },
  "today.continue_workout": { en: "Continue workout", tn: "كمّل الحصّة" },
  "today.workout_done": { en: "Workout done today", tn: "تمرين اليوم كمل" },
  "today.no_program": { en: "No program yet — build yours in 2 minutes.", tn: "مازال ما عندكش برنامج — اعملو في دقيقتين." },
  "today.build_program": { en: "Build my program", tn: "اعمل برنامجي" },
  "today.week_label": { en: "This week", tn: "هالجمعة" },
  "today.sessions_label": { en: "workouts", tn: "حصص" },
  "today.streak_label": { en: "day check-in streak", tn: "يوم تسجيل متتالي" },
  "today.open_plan": { en: "Open plan", tn: "حلّ البرنامج" },
  "today.see_workout": { en: "See the workout", tn: "شوف التمرين" },
  "today.qa_answered": { en: "Your question was answered!", tn: "سؤالك تجاوب!" },
  "today.rest_day": {
    en: "Rest day — recovery is where you grow.",
    tn: "اليوم راحة — الجسم يكبر وقت الراحة.",
  },
  "today.exercises": { en: "exercises", tn: "تمارين" },

  // ---- plan food swap ----
  "plan.swap_food": { en: "Swap this food", tn: "بدّل الماكلة هاذي" },
  "plan.swap_for": { en: "Swap for", tn: "بدّلها بـ" },
  "plan.no_alternatives": {
    en: "No alternatives for this food yet.",
    tn: "مازال ما فماش بدائل للماكلة هاذي.",
  },

  // ---- nutrition section tabs ----
  "nutrition.tab_today": { en: "Today", tn: "اليوم" },
  "nutrition.tab_plan": { en: "Plan", tn: "البرنامج" },

  // ---- food diary ----
  "diary.title": { en: "Food diary", tn: "دفتر الماكلة" },
  "diary.subtitle": { en: "What you actually ate today.", tn: "اللي كليتو بالحق اليوم." },
  "diary.today_target": { en: "Today", tn: "اليوم" },
  "diary.no_target": {
    en: "Set up your diet first to get daily targets.",
    tn: "اعمل نظامك الغذائي الأول باش تاخو أهداف يومية.",
  },
  "diary.copy_yesterday": { en: "Copy last logged day", tn: "انسخ آخر نهار مسجّل" },
  "diary.empty_slot": { en: "Nothing logged yet.", tn: "مازال ما تسجّل شيء." },
  "diary.add_food": { en: "Add food", tn: "زيد ماكلة" },
  "diary.tab_plan": { en: "My plan", tn: "برنامجي" },
  "diary.tab_search": { en: "Search", tn: "لوّج" },
  "diary.tab_recents": { en: "Recent", tn: "الأخيرة" },
  "diary.tab_favorites": { en: "Favorites", tn: "المفضّلة" },
  "diary.tab_quick": { en: "Quick", tn: "سريع" },
  "diary.search_placeholder": { en: "Search foods…", tn: "لوّج على ماكلة…" },
  "diary.no_recents": {
    en: "Foods you log will show up here.",
    tn: "الماكلة اللي تسجّلها باش تلقاها هوني.",
  },
  "diary.no_favorites": {
    en: "Star foods you eat often and they'll live here.",
    tn: "علّم بنجمة الماكلة اللي تاكلها ديما وباش تلقاها هوني.",
  },
  "diary.quantity": { en: "Quantity (grams)", tn: "الكمية (غرام)" },
  "diary.log_cta": { en: "Log it", tn: "سجّلها" },
  "diary.log_meal": { en: "Log the whole meal", tn: "سجّل الوجبة الكل" },
  "diary.details": { en: "Details", tn: "التفاصيل" },
  // Bar labels — the value beside them already carries the unit, so no "(g)".
  "diary.macro_protein": { en: "Protein", tn: "بروتين" },
  "diary.macro_carbs": { en: "Carbs", tn: "كربوهيدرات" },
  "diary.macro_fat": { en: "Fat", tn: "دهون" },
  "diary.kcal_eaten": { en: "kcal eaten", tn: "كيلوكالوري تاكلو" },
  "diary.goal": { en: "Goal", tn: "الهدف" },
  "diary.food_label": { en: "Food", tn: "الماكلة" },
  "diary.remaining": { en: "Remaining", tn: "الباقي" },
  "diary.totals": { en: "Totals", tn: "المجموع" },
  "diary.back": { en: "Back", tn: "ارجع" },
  "diary.close": { en: "Close", tn: "سكّر" },
  "diary.quick_name": { en: "Name (optional)", tn: "الاسم (اختياري)" },
  "diary.quick_calories": { en: "Calories", tn: "سعرات" },
  "diary.quick_protein": { en: "Protein (g)", tn: "بروتين (غ)" },
  "diary.quick_carbs": { en: "Carbs (g)", tn: "كربوهيدرات (غ)" },
  "diary.quick_fat": { en: "Fat (g)", tn: "دهون (غ)" },

  // ---- nutrition coach messages (rule-based) ----
  "coach.log_reminder": {
    en: "Nothing logged yet today — even a quick estimate keeps your coaching accurate.",
    tn: "مازلت ما سجّلت شيء اليوم — حتى تقدير سريع يخلي المتابعة صحيحة.",
  },
  "coach.protein_behind": {
    en: "Protein is behind today — add a protein-rich food to your next meal.",
    tn: "البروتين ناقص اليوم — زيد حاجة فيها بروتين في الوجبة الجاية.",
  },
  "coach.protein_hit": {
    en: "Protein target hit — that's how muscle is kept and built.",
    tn: "هدف البروتين تحقق — هكة يتبنى العضل.",
  },
  "coach.calories_over": {
    en: "You're over today's calories. One day won't hurt — get back on target tomorrow.",
    tn: "فتّ سعرات اليوم. نهار واحد ما يضرش — ارجع للهدف غدوة.",
  },
  "coach.calories_low_evening": {
    en: "Calories are very low today — under-eating slows progress too.",
    tn: "السعرات قليلة برشة اليوم — الماكلة الناقصة زادة تعطّل التقدم.",
  },
  "coach.fat_high": {
    en: "Fat is running high today — go leaner on the next meal.",
    tn: "الدهون مرتفعة اليوم — خفّفها في الوجبة الجاية.",
  },
  "coach.great_day": {
    en: "Great day: calories on target and protein locked in.",
    tn: "نهار ممتاز: سعرات في الهدف وبروتين كامل.",
  },
  "coach.on_track": {
    en: "On track so far — keep it going.",
    tn: "ماشي مليح لتوّة — كمّل هكة.",
  },

  // ---- live nutrition tile ----
  "tile.log_food": { en: "Log food", tn: "سجّل ماكلة" },

  // ---- weekly review ----
  "review.title": { en: "Weekly review", tn: "مراجعة الجمعة" },
  "review.subtitle": { en: "Your last 7 days, through a coach's eyes.", tn: "آخر 7 أيام متاعك، بعين المدرب." },
  "review.workouts": { en: "Workouts", tn: "التمارين" },
  "review.nutrition_days": { en: "Days logged", tn: "أيام مسجّلة" },
  "review.avg_protein": { en: "Avg protein", tn: "معدل البروتين" },
  "review.avg_sleep": { en: "Avg sleep", tn: "معدل النوم" },
  "review.weight_change": { en: "Weight change", tn: "تغير الوزن" },
  "review.prs": { en: "New PRs", tn: "أرقام جديدة" },
  "review.coach_title": { en: "Coach summary", tn: "كلمة المدرب" },
  "review.recommended": { en: "Recommended for you", tn: "مقترح ليك" },
  "review.sum_no_data": {
    en: "Not enough data yet — log workouts, meals and check-ins this week and this review gets sharp.",
    tn: "مازال ما فماش معطيات كافية — سجّل تمارينك وماكلتك هالجمعة والمراجعة تولي أدق.",
  },
  "review.sum_workouts_great": {
    en: "Training consistency was excellent this week.",
    tn: "التزامك بالتمرين كان ممتاز هالجمعة.",
  },
  "review.sum_workouts_ok": {
    en: "You trained, but a session or two slipped. Protect your training days.",
    tn: "تمرنت، أما فلتتلك حصة ولا زوز. حافظ على أيام التمرين.",
  },
  "review.sum_workouts_poor": {
    en: "Training slipped this week — restart with the very next session, not next Monday.",
    tn: "التمرين طاح هالجمعة — ابدا من الحصة الجاية، موش من الاثنين الجاي.",
  },
  "review.sum_prs": {
    en: "You set new personal records this week — strength is moving.",
    tn: "عملت أرقام قياسية جديدة هالجمعة — القوة تتقدم.",
  },
  "review.sum_nutrition_great": {
    en: "Nutrition logging was consistent — your targets mean something now.",
    tn: "تسجيل الماكلة كان منتظم — أهدافك ولات عندها معنى.",
  },
  "review.sum_nutrition_poor": {
    en: "Little food logging this week — without data, coaching is guessing.",
    tn: "تسجيل الماكلة قليل هالجمعة — بلا معطيات، التدريب يولي تخمين.",
  },
  "review.sum_protein_low": {
    en: "Average protein ran low — build every meal around a protein source.",
    tn: "معدل البروتين كان ناقص — ابني كل وجبة على مصدر بروتين.",
  },
  "review.sum_sleep_low": {
    en: "Sleep averaged under 7 hours — recovery is limiting you more than training is.",
    tn: "معدل النوم أقل من 7 سوايع — الراحة هي اللي محدّداك أكثر من التمرين.",
  },
  "review.sum_weight_cut_good": {
    en: "Weight is trending down — the plan is working.",
    tn: "الوزن طايح — البرنامج ناجح.",
  },
  "review.sum_weight_cut_stall": {
    en: "Weight hasn't moved — if next week repeats this, we adjust calories.",
    tn: "الوزن ما تحركش — كان الجمعة الجاية كيف كيف، نبدلو السعرات.",
  },
  "review.sum_weight_bulk_good": {
    en: "Weight is climbing slowly — clean gaining pace.",
    tn: "الوزن يزيد بشوية — نسق زيادة نظيف.",
  },

  // ---- adaptive coaching: diet adjustments (V2) ----
  "adapt.card_title": { en: "Coach proposal", tn: "اقتراح المدرب" },
  "adapt.cut_stall": {
    en: "Your weight hasn't moved in two weeks on a cut — time to lower calories a notch.",
    tn: "وزنك ما تحركش جمعتين وانت في تنشيف — وقت نطيحو السعرات شوية.",
  },
  "adapt.cut_too_fast": {
    en: "You're losing weight too fast — we're adding calories back to protect your muscle.",
    tn: "قاعد تنحف فيسع برشة — باش نرجعو شوية سعرات باش نحميو العضل.",
  },
  "adapt.bulk_stall": {
    en: "Weight is flat while building — a small calorie increase keeps you growing.",
    tn: "الوزن واقف وانت تبني — زيادة صغيرة في السعرات تخليك تكبر.",
  },
  "adapt.bulk_too_fast": {
    en: "Gaining too fast — trimming calories to keep the gain clean.",
    tn: "قاعد تزيد فيسع برشة — ننقصو السعرات باش تبقى الزيادة نظيفة.",
  },
  "adapt.trend_label": { en: "2-week trend", tn: "التغير في جمعتين" },
  "adapt.protein_note": { en: "Protein stays the same", tn: "البروتين ما يتبدلش" },
  "adapt.accept": { en: "Apply new targets", tn: "طبّق الأهداف الجديدة" },
  "adapt.applied": { en: "New targets applied", tn: "الأهداف الجديدة تطبقت" },

  // ---- adaptive coaching: exercise progression (V2) ----
  "progress.suggested": { en: "Coach", tn: "المدرب" },
  "progress.reason_up": {
    en: "You beat the top of the rep range with reps in reserve — go up.",
    tn: "فتّ أعلى نطاق العدّات ومازال عندك في الجعبة — اطلع في الوزن.",
  },
  "progress.reason_deload": {
    en: "Three sessions stuck at this weight near failure — drop ~10% and rebuild.",
    tn: "ثلاثة حصص واقف في نفس الوزن قريب للفشل — انقص ~10% وارجع ابني.",
  },

  // ---- exercise media ----
  "media.watch_demo": { en: "Watch demo video", tn: "شوف فيديو التمرين" },
  "media.close": { en: "Close", tn: "سكّر" },

  // ---- AI calorie calculator ----
  "ai.title": { en: "AI Calorie Calculator", tn: "حاسبة السعرات بالذكاء" },
  "ai.subtitle": {
    en: "Snap your plate — the AI estimates, you confirm.",
    tn: "صوّر صحنك — الذكاء يقدّر، وانت تأكد.",
  },
  "ai.open_camera": { en: "Take a photo of your meal", tn: "صوّر ماكلتك" },
  "ai.no_save_note": {
    en: "The photo stays in the app — nothing is saved.",
    tn: "التصويرة تقعد في التطبيق برك — ما تتسجل حتى وين.",
  },
  "ai.pick_instead": { en: "No camera? Pick a photo instead", tn: "ما فماش كاميرا؟ اختار تصويرة" },
  "ai.capture": { en: "Capture", tn: "صوّر" },
  "ai.retake": { en: "Retake", tn: "عاود صوّر" },
  "ai.notes_ph": {
    en: "Optional notes: portion size, what's inside…",
    tn: "ملاحظات اختيارية: قداش الكمية، شنوة فيها…",
  },
  "ai.camera_error": {
    en: "Camera unavailable — pick a photo instead.",
    tn: "الكاميرا موش متوفرة — اختار تصويرة.",
  },
  "ai.camera_denied": {
    en: "Camera permission was blocked. Allow it in your browser settings, or pick a photo instead.",
    tn: "منع الكاميرا. سمحلها من إعدادات المتصفح، ولا اختار تصويرة.",
  },
  "ai.camera_missing": {
    en: "No camera found on this device — pick a photo instead.",
    tn: "ما لقيناش كاميرا في الجهاز هذا — اختار تصويرة.",
  },
  "ai.camera_insecure": {
    en: "The camera only works over HTTPS. Open the app on localhost or an https:// address, or pick a photo instead.",
    tn: "الكاميرا تخدم برك على HTTPS. حلّ التطبيق على localhost ولا على عنوان https://، ولا اختار تصويرة.",
  },
  "ai.camera_busy": {
    en: "The camera is being used by another app. Close it and try again.",
    tn: "الكاميرا مستعملة في تطبيق آخر. سكّرو وعاود جرّب.",
  },
  "ai.camera_starting": { en: "Starting camera…", tn: "قاعدة تحل الكاميرا…" },
  "ai.camera_retry": { en: "Try again", tn: "عاود جرّب" },
  "ai.estimate_cta": { en: "Estimate calories", tn: "قدّر السعرات" },
  "ai.estimating": { en: "Estimating…", tn: "قاعد يقدّر…" },
  "ai.results_title": { en: "Detected foods — edit anything", tn: "الماكلة المتعرّف عليها — بدّل اللي تحب" },
  "ai.simulated_note": {
    en: "Estimated from our food database (AI is not configured yet) — double-check the numbers.",
    tn: "تقدير من قاعدة بيانات الماكلة (الذكاء مازال موش مفعّل) — عاود ثبّت في الأرقام.",
  },
  "ai.confidence": { en: "confidence", tn: "ثقة" },
  "ai.grams": { en: "g", tn: "غ" },
  "ai.quantity": { en: "Quantity", tn: "الكمية" },
  "ai.qty_sync_hint": {
    en: "Change the quantity and the calories and macros follow it automatically.",
    tn: "بدّل الكمية والسعرات والماكرو يتبدّلو معاها وحدهم.",
  },
  "ai.decrease": { en: "Less", tn: "نقّص" },
  "ai.increase": { en: "More", tn: "زيد" },
  "ai.remove_item": { en: "Remove this food", tn: "نحّي هالماكلة" },
  "ai.total": { en: "Total", tn: "المجموع" },
  "ai.slot_label": { en: "Log to", tn: "سجّل في" },
  "ai.log_cta": { en: "Log to my diary", tn: "سجّلها في الدفتر" },
  "ai.logging": { en: "Logging…", tn: "قاعد يسجّل…" },
  "ai.logged_title": { en: "Logged!", tn: "تسجلت!" },
  "ai.logged_sub": { en: "Added to today's diary.", tn: "تزادت في دفتر اليوم." },
  "ai.open_diary": { en: "Open diary", tn: "حلّ الدفتر" },
  "ai.again": { en: "Estimate another meal", tn: "قدّر ماكلة أخرى" },
  "ai.premium_title": { en: "A Premium feature", tn: "ميزة بريميوم" },
  "ai.premium_body": {
    en: "The AI calorie camera is part of the Premium plan. Upgrade to snap your meals and log them in seconds.",
    tn: "كاميرا السعرات بالذكاء من عرض بريميوم. طوّر اشتراكك باش تصوّر ماكلتك وتسجلها في ثواني.",
  },
  "ai.premium_cta": { en: "Upgrade to Premium", tn: "طوّر لبريميوم" },

  // ---- admin: Q&A triage ----
  "admin.nav_qa": { en: "Q&A", tn: "الأسئلة" },
  "admin.qa_title": { en: "User questions", tn: "أسئلة المستخدمين" },
  "admin.qa_sub": {
    en: "Answer a question to publish it in the Q&A library. The asker gets notified.",
    tn: "جاوب على سؤال باش ينتشر في المكتبة. صاحب السؤال يتنبّه.",
  },
  "admin.qa_empty": { en: "No pending questions.", tn: "ما فماش أسئلة في الانتظار." },
  "admin.qa_from": { en: "From", tn: "من" },
  "admin.qa_category": { en: "Category", tn: "القسم" },
  "admin.qa_question_en": { en: "Question (English)", tn: "السؤال (إنجليزي)" },
  "admin.qa_question_ar": { en: "Question (Tunisian)", tn: "السؤال (تونسي)" },
  "admin.qa_answer_short_en": { en: "Short answer (English)", tn: "إجابة قصيرة (إنجليزي)" },
  "admin.qa_answer_short_ar": { en: "Short answer (Tunisian)", tn: "إجابة قصيرة (تونسي)" },
  "admin.qa_answer_long_en": { en: "Full answer (English, Markdown)", tn: "إجابة كاملة (إنجليزي، Markdown)" },
  "admin.qa_answer_long_ar": { en: "Full answer (Tunisian, Markdown)", tn: "إجابة كاملة (تونسي، Markdown)" },
  "admin.qa_publish": { en: "Publish answer", tn: "انشر الإجابة" },
  "admin.qa_dismiss": { en: "Dismiss", tn: "تجاهل" },

  // ---- admin: monthly ask quota ----
  "admin.qa_quota_title": { en: "Monthly question allowance", tn: "حصة الأسئلة الشهرية" },
  "admin.qa_quota_sub": {
    en: "How many questions each user may ask per calendar month, and who has used theirs.",
    tn: "قداش سؤال ينجم كل مستخدم يسأل في الشهر، وشكون استهلك حصتو.",
  },
  "admin.qa_quota_limit": { en: "Questions per user / month", tn: "أسئلة لكل مستخدم / شهر" },
  "admin.qa_quota_save": { en: "Save", tn: "سجّل" },
  "admin.qa_quota_saved": { en: "Saved.", tn: "تسجّل." },
  "admin.qa_quota_usage": { en: "This month's usage", tn: "استهلاك هالشهر" },
  "admin.qa_quota_none": { en: "Nobody has asked a question this month.", tn: "حتى حد ما سألش هالشهر." },
  "admin.qa_quota_user": { en: "User", tn: "المستخدم" },
  "admin.qa_quota_used": { en: "Asked", tn: "سأل" },
  "admin.qa_quota_pending": { en: "Waiting", tn: "في الانتظار" },
  "admin.qa_quota_published": { en: "Answered", tn: "تجاوب" },
  "admin.qa_quota_last": { en: "Last question", tn: "آخر سؤال" },

  // ---- admin: managing the published library ----
  "admin.qa_library_title": { en: "Q&A library", tn: "مكتبة الأسئلة" },
  "admin.qa_library_sub": {
    en: "Hide a card to take it out of the app, or delete it for good.",
    tn: "خبّي كارت باش يخرج من التطبيق، ولا امسحو نهائيًا.",
  },
  "admin.qa_library_search": { en: "Search a question…", tn: "لوّج على سؤال…" },
  "admin.qa_library_count": { en: "{n} cards", tn: "{n} كارت" },
  "admin.qa_library_empty": { en: "No card matches.", tn: "ما فماش كارت يقابل." },
  "admin.qa_library_hidden": { en: "Hidden", tn: "مخبّي" },
  "admin.qa_library_hide": { en: "Hide", tn: "خبّي" },
  "admin.qa_library_show": { en: "Show", tn: "ورّي" },
  "admin.qa_library_delete": { en: "Delete", tn: "امسح" },
  "admin.qa_library_confirm_delete": { en: "Delete for good", tn: "امسح نهائيًا" },
  "admin.qa_library_cancel": { en: "Cancel", tn: "بطّل" },
  "admin.qa_library_seed_note": {
    en: "Cards with an id like faq_007 come from the content file — running the seed again restores them. Hide those instead of deleting.",
    tn: "الكروت اللي عندها رقم كي faq_007 جاية من ملف المحتوى — كان تعاود تعمل seed ترجع. خبّيهم بدل ما تمسحهم.",
  },

  // ---- admin: subscriptions ----
  "admin.nav_subs": { en: "Subscriptions", tn: "الاشتراكات" },
  "admin.subs_title": { en: "Subscriptions", tn: "الاشتراكات" },
  "admin.subs_sub": {
    en: "Who is paid up, and who is about to run out. Soonest to lapse first.",
    tn: "شكون خالص وشكون قرب يوفى ليه الاشتراك. اللي قرب يوفى الأول.",
  },
  "admin.subs_active": { en: "Active", tn: "مفعّل" },
  "admin.subs_expiring": { en: "Expiring soon", tn: "قرب يوفى" },
  "admin.subs_expired": { en: "Expired", tn: "وفى" },
  "admin.subs_unpaid": { en: "Never paid", tn: "ما خلّصش" },
  "admin.subs_admin": { en: "Admin — always has access", tn: "أدمين — عندو دخول ديما" },
  "admin.subs_search": {
    en: "Search by name, email or number…",
    tn: "لوّج بالاسم ولا الإيميل ولا النمرة…",
  },

  // Chase messages, written in the *customer's* language. {name} is replaced
  // before the wa.me link is built. One per situation — telling someone who
  // never started a payment to "renew" would make no sense to them.
  "admin.wa_msg_unpaid": {
    en:
      "Hi {name}, this is HYPE FITNESS. You have an account with us but it isn't active yet. " +
      "Anything blocking you? Happy to help you finish.",
    tn:
      "أهلا {name}، هذا HYPE FITNESS. عندك حساب عندنا أما مازال ما تفعّلش. " +
      "فما حاجة واقفتلك؟ نجمو نعاونوك تكمّل.",
  },
  "admin.wa_msg_expiring": {
    en:
      "Hi {name}, this is HYPE FITNESS. Your subscription is about to run out — " +
      "renew and you keep your plan and your progress.",
    tn:
      "أهلا {name}، هذا HYPE FITNESS. الاشتراك متاعك قرب يوفى — " +
      "جدّدو وتبقى عندك البرنامج والتقدّم متاعك.",
  },
  "admin.wa_msg_expired": {
    en:
      "Hi {name}, this is HYPE FITNESS. Your subscription has ended. " +
      "Renew whenever you like — your plan and progress are still saved.",
    tn:
      "أهلا {name}، هذا HYPE FITNESS. الاشتراك متاعك وفى. " +
      "جدّدو وقتلي تحب — البرنامج والتقدّم متاعك مازالوا محفوظين.",
  },
  "admin.wa_msg_active": {
    en: "Hi {name}, this is HYPE FITNESS. Just checking in — how are you getting on?",
    tn: "أهلا {name}، هذا HYPE FITNESS. نشوفو فيك برك — كيفاش ماشي معاك؟",
  },
  "admin.subs_none": { en: "Nobody here.", tn: "ما فما حتى حد هوني." },
  "admin.subs_note": {
    en: "Access stops on its own the moment a term ends — nothing to switch off by hand. Confirm a payment on the Payments tab to extend one.",
    tn: "الدخول يتقطع وحدو كي يوفى الاشتراك — ما تحتاج تطفّي شيء بيدك. باش تمدّد، أكّد الخلاص في تبويب الخلاص.",
  },
  "admin.subs_actions": { en: "Actions", tn: "إجراءات" },
  "admin.subs_cancel": { en: "Cancel", tn: "إلغاء" },
  "admin.subs_end": { en: "End access", tn: "اقطع الدخول" },
  "admin.subs_end_note": {
    en: "Cuts them off now and sends them to checkout. Their account, plan and history stay — confirming a payment brings them back.",
    tn: "يتقطعلو الدخول توّا ويتوجّه للخلاص. حسابو وبرنامجو وسجلّو يبقاو — كي تأكّد خلاص يرجع كيما كان.",
  },
  "admin.subs_end_confirm": { en: "Yes, end it", tn: "إي، اقطعو" },
  "admin.subs_delete": { en: "Delete account", tn: "امسح الحساب" },
  "admin.subs_delete_note": {
    en: "Erases the account and everything logged under it — workouts, meals, check-ins. This cannot be undone. Type the email to confirm.",
    tn: "يمسح الحساب وكل شيء تسجّل فيه — تمارين، ماكلة، تسجيلات. ما تنجّمش ترجّعو. اكتب الإيميل باش تأكّد.",
  },
  "admin.subs_delete_confirm_label": {
    en: "Type the account email to confirm",
    tn: "اكتب إيميل الحساب باش تأكّد",
  },

  // ---- admin: user records ----
  "admin.nav_users": { en: "Users", tn: "المستخدمين" },
  "admin.users_title": { en: "User records", tn: "سجلات المستخدمين" },
  "admin.users_sub": {
    en: "Look up an account by email to reset its logged workout history. The training plan stays as it is.",
    tn: "لوّج على حساب بالإيميل باش تصفّر سجل التمارين. برنامج التدريب يبقى كيما هو.",
  },
  "admin.users_email_placeholder": { en: "user@example.com", tn: "user@example.com" },
  "admin.users_lookup": { en: "Look up", tn: "لوّج" },
  "admin.users_sessions": { en: "Sessions", tn: "حصص" },
  "admin.users_sets": { en: "Sets", tn: "سيريات" },
  "admin.users_events": { en: "Events", tn: "أحداث" },
  "admin.users_open": { en: "In progress", tn: "مازالت تخدم" },
  "admin.users_day": { en: "Day", tn: "النهار" },
  "admin.users_started": { en: "Started", tn: "بدات" },
  "admin.users_finished": { en: "Finished", tn: "كملت" },
  "admin.users_in_progress": { en: "In progress", tn: "مازالت تخدم" },
  "admin.users_plan_safe": {
    en: "The training plan is not touched. Active program:",
    tn: "برنامج التدريب ما يتبدّلش. البرنامج الفعّال:",
  },
  "admin.users_no_program": { en: "none", tn: "ما فماش" },
  "admin.users_nothing": {
    en: "This account has no workout history — nothing to reset.",
    tn: "الحساب هذا ما عندوش سجل تمارين — ما فماش شنوة تصفّر.",
  },
  "admin.users_warning": {
    en: "This permanently deletes every session, every logged set and the completion events. It cannot be undone. Check-ins, meal logs and the program are kept.",
    tn: "هذا يمسح نهائيًا كل الحصص وكل السيريات المسجلة وأحداث الإكمال. ما تنجمش ترجّعهم. المتابعة اليومية وسجل الماكلة والبرنامج يتحفظوا.",
  },
  "admin.users_confirm_label": {
    en: "Type the email to confirm",
    tn: "اكتب الإيميل باش تأكّد",
  },
  "admin.users_reset": { en: "Reset workout history", tn: "صفّر سجل التمارين" },
  "admin.users_reset_done": { en: "Workout history reset.", tn: "تصفّر سجل التمارين." },

  // ---- report a problem (user side) ----
  "support.title": { en: "Report a problem", tn: "بلّغ على مشكل" },
  "support.subtitle": {
    en: "Something broken or confusing? Tell us and we'll answer you here.",
    tn: "فمّا حاجة خايبة ولا ما فهمتهاش؟ قلّنا وباش نجاوبوك هنا.",
  },
  "support.category": { en: "What is it about?", tn: "علاش يخص؟" },
  "support.cat_bug": { en: "Something is broken", tn: "حاجة ما تخدمش" },
  "support.cat_payment": { en: "Payment", tn: "الخلاص" },
  "support.cat_plan": { en: "My plan", tn: "البرنامج متاعي" },
  "support.cat_account": { en: "My account", tn: "الحساب متاعي" },
  "support.cat_other": { en: "Something else", tn: "حاجة أخرى" },
  "support.message": { en: "What happened?", tn: "شنوّة صار؟" },
  "support.message_placeholder": {
    en: "Tell us what you were doing and what went wrong.",
    tn: "قلّنا شنوّة كنت تعمل وشنوّة صار.",
  },
  "support.send": { en: "Send report", tn: "ابعث" },
  "support.sending": { en: "Sending…", tn: "قاعد يتبعث…" },
  "support.sent": {
    en: "Sent. We'll answer you right here.",
    tn: "تبعثت. باش نجاوبوك هوني.",
  },
  "support.my_reports": { en: "My reports", tn: "التبليغات متاعي" },
  "support.empty": { en: "You haven't reported anything yet.", tn: "مازلت ما بلّغت على حتى حاجة." },
  "support.status_open": { en: "Waiting for an answer", tn: "في انتظار الجواب" },
  "support.status_answered": { en: "Answered", tn: "تجاوب" },
  "support.status_closed": { en: "Closed", tn: "تسكّر" },
  "support.new_reply": { en: "New reply", tn: "جواب جديد" },
  "support.from_you": { en: "You", tn: "إنت" },
  "support.from_coach": { en: "HYPE FITNESS", tn: "HYPE FITNESS" },
  "support.reply_placeholder": { en: "Write a message…", tn: "اكتب رسالة…" },
  "support.reply_send": { en: "Send", tn: "ابعث" },

  // ---- report a problem (admin side) ----
  "admin.nav_support": { en: "Reports", tn: "التبليغات" },
  "admin.support_title": { en: "Problem reports", tn: "تبليغات المشاكل" },
  "admin.support_sub": {
    en: "What users report from the app. Your answer lands in their thread.",
    tn: "شنوّة يبلّغو عليه المستخدمين من التطبيق. جوابك يوصلهم في نفس المحادثة.",
  },
  "admin.support_empty": { en: "No reports.", tn: "ما فماش تبليغات." },
  "admin.support_answer_placeholder": { en: "Write your answer…", tn: "اكتب جوابك…" },
  "admin.support_send": { en: "Send answer", tn: "ابعث الجواب" },
  "admin.support_close": { en: "Close", tn: "سكّر" },
  "admin.support_reopen": { en: "Reopen", tn: "رجّع افتح" },
  "admin.support_show_open": { en: "Needs an answer", tn: "تحتاج جواب" },
  "admin.support_show_all": { en: "All", tn: "الكل" },

  // ---- guided vs. build-it-yourself (shared by both makers) ----
  "build.choose_title": { en: "How do you want to start?", tn: "كيفاش تحب تبدا؟" },
  "build.guided_title": { en: "Answer a few questions", tn: "جاوب على شوية أسئلة" },
  "build.guided_workout": {
    en: "We pick the split and the exercises for you. Takes about two minutes.",
    tn: "احنا نختارولك التقسيم والتمارين. ياخذ حوالي دقيقتين.",
  },
  "build.guided_diet": {
    en: "We work out your calories and build the meals for you. Takes about three minutes.",
    tn: "احنا نحسبولك السعرات ونبنيولك الوجبات. ياخذ حوالي ثلاث دقايق.",
  },
  "build.custom_title": { en: "Build it myself", tn: "نبنيه بيدي" },
  "build.custom_workout": {
    en: "Pick your own days and choose every exercise from our library.",
    tn: "اختار أيامك إنت واختار كل تمرين من المكتبة متاعنا.",
  },
  "build.custom_diet": {
    en: "We still work out your calories — you choose every food yourself.",
    tn: "احنا نحسبولك السعرات — وإنت تختار كل ماكلة بيدك.",
  },
  "build.recommended": { en: "Recommended", tn: "ننصحو بيه" },
  "build.switch_to_custom": { en: "I'd rather build it myself", tn: "نحب نبنيه بيدي" },
  "build.switch_to_guided": { en: "Just ask me questions instead", tn: "أسألوني أسئلة برك" },
  "build.saving": { en: "Saving…", tn: "قاعد يتسجّل…" },

  // ---- custom split builder ----
  "cw.title": { en: "Build your split", tn: "ابني التقسيم متاعك" },
  "cw.step_basics": { en: "About you", tn: "عليك" },
  "cw.step_shape": { en: "Your week", tn: "الأسبوع متاعك" },
  "cw.step_fill": { en: "Fill the days", tn: "عمّر الأيام" },
  "cw.program_name": { en: "Program name", tn: "اسم البرنامج" },
  "cw.program_name_ph": { en: "My split", tn: "التقسيم متاعي" },
  "cw.days_count": { en: "How many days a week?", tn: "قداش من نهار في الجمعة؟" },
  "cw.days_unit": { en: "days", tn: "أيام" },
  "cw.start_from": { en: "Start from a ready-made shape", tn: "ابدا من هيكل جاهز" },
  "cw.start_blank": { en: "Start blank", tn: "ابدا من الفارغ" },
  "cw.start_from_hint": {
    en: "This only names the days — you still choose every exercise.",
    tn: "هذا يسمّي الأيام برك — إنت اللي تختار كل تمرين.",
  },
  "cw.day_name": { en: "Day name", tn: "اسم النهار" },
  "cw.add_exercise": { en: "Add exercise", tn: "زيد تمرين" },
  "cw.search_exercises": { en: "Search exercises…", tn: "لوّج على تمارين…" },
  "cw.no_exercises_found": { en: "Nothing matches that.", tn: "ما فما حتّى حاجة." },
  "cw.empty_day": { en: "No exercises yet", tn: "مازال ما فماش تمارين" },
  "cw.sets": { en: "Sets", tn: "مجموعات" },
  "cw.reps": { en: "Reps", tn: "تكرارات" },
  "cw.rest": { en: "Rest", tn: "راحة" },
  "cw.remove": { en: "Remove", tn: "نحّي" },
  "cw.filter_all": { en: "All", tn: "الكل" },
  "cw.save": { en: "Save my program", tn: "سجّل البرنامج متاعي" },
  "cw.day_needs_exercise": {
    en: "Every day needs at least one exercise.",
    tn: "كل نهار يلزمو على الأقل تمرين واحد.",
  },
  "cw.already_added": { en: "Already in this day", tn: "موجود في هذا النهار" },
  "cw.exercise_count": { en: "exercises", tn: "تمارين" },

  // ---- custom meal plan builder ----
  "cd.title": { en: "Build your plan", tn: "ابني البرنامج متاعك" },
  "cd.step_numbers": { en: "Your numbers", tn: "الأرقام متاعك" },
  "cd.step_meals": { en: "Your meals", tn: "الوجبات متاعك" },
  "cd.targets_ready": { en: "Here are your daily targets", tn: "هاذم الأهداف اليومية متاعك" },
  "cd.targets_hint": {
    en: "Same maths as the guided plan. Now put the food in yourself.",
    tn: "نفس الحساب متاع البرنامج الموجّه. توّا حطّ الماكلة إنت.",
  },
  "cd.meals_count": { en: "How many meals a day?", tn: "قداش من وجبة في النهار؟" },
  "cd.meals_unit": { en: "meals", tn: "وجبات" },
  "cd.add_food": { en: "Add food", tn: "زيد ماكلة" },
  "cd.search_foods": { en: "Search foods…", tn: "لوّج على ماكلة…" },
  "cd.empty_meal": { en: "Nothing in this meal yet", tn: "مازال ما فماش شيء في هذي الوجبة" },
  "cd.meal_needs_food": {
    en: "Every meal needs at least one food.",
    tn: "كل وجبة يلزمها على الأقل ماكلة وحدة.",
  },
  "cd.save": { en: "Save my plan", tn: "سجّل البرنامج متاعي" },
  "cd.remaining": { en: "left", tn: "باقي" },
  "cd.over": { en: "over", tn: "زايد" },
  "cd.on_target": { en: "on target", tn: "على الهدف" },

  // ---- the nine answers the macro formula reads ----
  "ce.gender": { en: "You are", tn: "إنت" },
  "ce.male": { en: "Male", tn: "راجل" },
  "ce.female": { en: "Female", tn: "مرا" },
  "ce.age": { en: "Age", tn: "العمر" },
  "ce.height": { en: "Height (cm)", tn: "الطول (صم)" },
  "ce.weight": { en: "Weight (kg)", tn: "الوزن (كغ)" },
  "ce.target_weight": { en: "Target (kg)", tn: "الهدف (كغ)" },
  "ce.goal": { en: "What are you after?", tn: "شنوّة تحب توصل؟" },
  "ce.goal_lose_fat": { en: "Lose fat", tn: "تنشيف" },
  "ce.goal_build_muscle": { en: "Build muscle", tn: "تضخيم" },
  "ce.goal_recomp": { en: "Both at once", tn: "الزوز في نفس الوقت" },
  "ce.goal_maintain": { en: "Stay where I am", tn: "نبقى كيما أنا" },
  "ce.body_fat": { en: "Roughly how lean are you?", tn: "تقريبا قداش إنت منشّف؟" },
  "ce.bf_very_lean": { en: "Very lean — abs show", tn: "منشّف برشة — الأبس باينة" },
  "ce.bf_normal": { en: "Normal", tn: "عادي" },
  "ce.bf_a_little_fat": { en: "Carrying a little", tn: "فما شوية دهون" },
  "ce.bf_high": { en: "Carrying a lot", tn: "فما برشة دهون" },
  "ce.bf_unknown": { en: "No idea", tn: "ما نعرفش" },
  "ce.steps": { en: "Steps on a normal day", tn: "الخطوات في نهار عادي" },
  "ce.steps_under_4k": { en: "Under 4,000", tn: "أقل من 4,000" },
  "ce.steps_4k_7k": { en: "4,000 – 7,000", tn: "4,000 – 7,000" },
  "ce.steps_7k_10k": { en: "7,000 – 10,000", tn: "7,000 – 10,000" },
  "ce.steps_over_10k": { en: "Over 10,000", tn: "أكثر من 10,000" },
  "ce.steps_unknown": { en: "I don't count them", tn: "ما نحسبهمش" },
  "ce.activity": { en: "How active are you overall?", tn: "قداش إنت نشيط بصفة عامة؟" },
  "ce.act_sedentary": { en: "Desk job, little movement", tn: "خدمة قاعدة، حركة قليلة" },
  "ce.act_light": { en: "Light — train 1–3x a week", tn: "خفيف — نتمرّن 1–3 مرات في الجمعة" },
  "ce.act_moderate": { en: "Moderate — train 3–5x a week", tn: "متوسط — نتمرّن 3–5 مرات في الجمعة" },
  "ce.act_active": { en: "Active — train 6–7x a week", tn: "نشيط — نتمرّن 6–7 مرات في الجمعة" },
  "ce.act_very_active": { en: "Very active — physical job too", tn: "نشيط برشة — وخدمة فيها جهد" },

  // ---- "my food isn't in the list" ----
  "uf.missing_cta": { en: "Can't find it? Add your own", tn: "ما لقيتهاش؟ زيدها إنت" },
  "uf.title": { en: "Add a food", tn: "زيد ماكلة" },
  "uf.hint": {
    en: "Copy the numbers off the packet, per 100 g. Only you will see this food.",
    tn: "انقل الأرقام من الپاكي، لكل 100 غ. إنت برك اللي تشوف هالماكلة.",
  },
  "uf.name": { en: "Name", tn: "الاسم" },
  "uf.name_ph": { en: "e.g. my mother's couscous", tn: "مثلا كسكسي أمي" },
  "uf.kind": { en: "What is it mostly?", tn: "أغلبها شنوّة؟" },
  "uf.calories": { en: "Calories / 100 g", tn: "سعرات / 100 غ" },
  "uf.protein": { en: "Protein / 100 g", tn: "بروتين / 100 غ" },
  "uf.carbs": { en: "Carbs / 100 g", tn: "كربوهيدرات / 100 غ" },
  "uf.fat": { en: "Fat / 100 g", tn: "دهون / 100 غ" },
  "uf.save": { en: "Add it", tn: "زيدها" },
  "uf.cancel": { en: "Cancel", tn: "إلغاء" },
  "uf.mine": { en: "Mine", tn: "متاعي" },
  "uf.macros_exceed": {
    en: "Protein, carbs and fat can't add up to more than 100 g.",
    tn: "البروتين والكربوهيدرات والدهون ما ينجموش يفوتو 100 غ.",
  },
  "uf.slot_protein": { en: "Protein", tn: "بروتين" },
  "uf.slot_carb": { en: "Carbs", tn: "كربوهيدرات" },
  "uf.slot_vegetable": { en: "Vegetable", tn: "خضرة" },
  "uf.slot_fat": { en: "Fat", tn: "دهون" },
  "uf.slot_fruit": { en: "Fruit", tn: "غلّة" },
  "uf.slot_legume": { en: "Legume", tn: "قطاني" },
  "uf.slot_beverage": { en: "Drink", tn: "مشروب" },

  // ---- payment thread (customer side) ----
  "pt.title": { en: "Your payment", tn: "الخلاص متاعك" },
  "pt.opened": {
    en: "We've got your receipt. Anything you need to tell us, write it here.",
    tn: "وصلنا الوصل متاعك. أي حاجة تحب تقولها، اكتبها هوني.",
  },
  "pt.placeholder": { en: "Write a message…", tn: "اكتب رسالة…" },
  "pt.send": { en: "Send", tn: "ابعث" },
  "pt.from_you": { en: "You", tn: "إنت" },
  "pt.from_us": { en: "HYPE FITNESS", tn: "HYPE FITNESS" },
  "pt.empty": { en: "No messages yet.", tn: "مازال ما فماش رسائل." },
  "pt.reply_soon": {
    en: "We usually answer within a few hours.",
    tn: "عادة نجاوبو في ظرف شوية ساعات.",
  },

  // ---- payments queue (admin side) ----
  "admin.pay_unread": { en: "new", tn: "جديد" },
  "admin.pay_thread": { en: "Conversation", tn: "المحادثة" },
  "admin.pay_reply_ph": { en: "Reply to the customer…", tn: "جاوب الحريف…" },
  "admin.pay_send": { en: "Send", tn: "ابعث" },
  "admin.pay_no_thread": { en: "No messages yet.", tn: "مازال ما فماش رسائل." },
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
