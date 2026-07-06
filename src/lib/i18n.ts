/**
 * Locale model for ELMADHI.
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
  "checkout.title": { en: "Unlock your plan", tn: "فعّل اشتراكك" },
  "checkout.subtitle": {
    en: "One-time access to the Diet Maker, Workout Maker, and Q&A library.",
    tn: "دخول دائم لصانع الريجيم، صانع التمرين، ومكتبة الأسئلة.",
  },
  "checkout.lifetime": { en: "Lifetime access", tn: "دخول دائم" },
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
  "admin.save": { en: "Save", tn: "احفظ" },
  "admin.saved": { en: "Saved", tn: "تسجّل" },

  // ---- admin nav ----
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
  "login.check_inbox": {
    en: "Check your inbox to confirm your email, then sign in.",
    tn: "شوف إيميلك باش تأكّدو، ومبعد أدخل.",
  },

  // ---- common ----
  "common.error": { en: "Something went wrong.", tn: "صار مشكل." },

  // ---- app bottom nav ----
  "nav.home": { en: "Home", tn: "الرئيسية" },
  "nav.workouts": { en: "Workouts", tn: "التمارين" },
  "nav.nutrition": { en: "Nutrition", tn: "الأكل" },
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
  "diet.q_intensity_cut": { en: "How fast do you want to lose fat?", tn: "بقداش تحب تنشّف بسرعة؟" },
  "diet.q_intensity_bulk": { en: "How do you want to build muscle?", tn: "كيفاش تحب تبني العضل؟" },
  "diet.rationale_title": { en: "Why we picked this for you", tn: "علاش اخترنالك هكة" },
  "diet.rationale_bmr": { en: "Base metabolism", tn: "الأيض الأساسي" },
  "diet.rationale_tdee": { en: "Your daily burn", tn: "حرقك اليومي" },
  "diet.rationale_target": { en: "Your daily target", tn: "هدفك اليومي" },
  "diet.see_plan": { en: "See my plan", tn: "شوف البرنامج" },
  "diet.redo_confirm": {
    en: "This will archive your current plan and ask the questions again.",
    tn: "هذا باش يحفظ برنامجك الحالي ويرجع يسألك من جديد.",
  },

  // ---- workout maker: questions ----
  "workout.q_goal": { en: "What do you want from training?", tn: "شنوة تحب من التمرين؟" },
  "workout.goal_lose_fat": { en: "Look leaner", tn: "نبان أنشف" },
  "workout.goal_build_muscle": { en: "Build muscle", tn: "نبني عضل" },
  "workout.goal_get_stronger": { en: "Get stronger", tn: "نزيد قوة" },
  "workout.goal_general_fitness": { en: "Just feel good and healthy", tn: "نبقى في صحة ونحس بالراحة" },
  "workout.q_days": { en: "How many days a week can you train?", tn: "قداش يوم في الجمعة تنجم تتمرّن؟" },
  "workout.q_session_minutes": { en: "How long can a session be?", tn: "قداش يدوم التمرين؟" },
  "workout.q_equipment": { en: "Where will you train?", tn: "وين باش تتمرّن؟" },
  "workout.equipment_full_gym": { en: "Full gym", tn: "نادي كامل" },
  "workout.equipment_home_basic": { en: "Home, some equipment", tn: "الدار، شوية معدات" },
  "workout.equipment_home_advanced": { en: "Home, serious setup", tn: "الدار، تجهيز قوي" },
  "workout.equipment_bodyweight": { en: "Just my body, no equipment", tn: "جسمي فقط، بلا معدات" },
  "workout.q_experience": { en: "Have you trained before?", tn: "سبق تمرّنت؟" },
  "workout.experience_beginner": { en: "Never, or a long time ago", tn: "عمري ما تمرّنت، ولا وقت طويل فات" },
  "workout.experience_intermediate": { en: "On and off for a while", tn: "نتمرّن ونوقف من مدّة" },
  "workout.experience_advanced": { en: "I train consistently for years", tn: "نتمرّن بانتظام من سنين" },
  "workout.q_injuries": { en: "Anything that hurts or needs care?", tn: "فما حاجة توجعك ولازم تحاذر فيها؟" },
  "workout.rationale_title": { en: "Why we picked this for you", tn: "علاش اخترنالك هكة" },
  "workout.see_program": { en: "See my program", tn: "شوف البرنامج" },
  "workout.redo_confirm": {
    en: "This will archive your current program and ask the questions again.",
    tn: "هذا باش يحفظ برنامجك الحالي ويرجع يسألك من جديد.",
  },

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

  // ---- workout: start session ----
  "workout.start_day": { en: "Start this workout", tn: "ابدا الحصّة" },

  // ---- workout session mode ----
  "session.already_done": {
    en: "You already logged this workout today — training again still counts.",
    tn: "ديجا سجّلت هالتمرين اليوم — كان تعاود، يتحسبلك زادة.",
  },
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

  // ---- today screen: check-in ----
  "checkin.title": { en: "Morning check-in", tn: "تسجيل الصباح" },
  "checkin.subtitle": { en: "15 seconds — it powers your coaching.", tn: "١٥ ثانية — بيها نتبّعو تقدّمك." },
  "checkin.weight": { en: "Weight (kg)", tn: "الوزن (كغ)" },
  "checkin.sleep": { en: "Sleep (hours)", tn: "النوم (سوايع)" },
  "checkin.energy": { en: "Energy today", tn: "طاقتك اليوم" },
  "checkin.save": { en: "Save check-in", tn: "سجّل" },
  "checkin.saving": { en: "Saving…", tn: "قاعد يسجّل…" },
  "checkin.done": { en: "Checked in for today", tn: "تسجيل اليوم كمل" },
  "checkin.edit": { en: "Edit", tn: "بدّل" },

  // ---- today screen ----
  "today.workout_title": { en: "Today's workout", tn: "تمرين اليوم" },
  "today.start_workout": { en: "Start workout", tn: "ابدا التمرين" },
  "today.workout_done": { en: "Workout done today 💪", tn: "تمرين اليوم كمل 💪" },
  "today.no_program": { en: "No program yet — build yours in 2 minutes.", tn: "مازال ما عندكش برنامج — اعملو في دقيقتين." },
  "today.build_program": { en: "Build my program", tn: "اعمل برنامجي" },
  "today.week_label": { en: "This week", tn: "هالجمعة" },
  "today.sessions_label": { en: "workouts", tn: "حصص" },
  "today.streak_label": { en: "day check-in streak", tn: "يوم تسجيل متتالي" },
  "today.meals_title": { en: "Today's meals", tn: "ماكلة اليوم" },
  "today.open_plan": { en: "Open plan", tn: "حلّ البرنامج" },
  "today.qa_answered": { en: "Your question was answered!", tn: "سؤالك تجاوب!" },
  "today.rest_day": {
    en: "Rest day — recovery is where you grow.",
    tn: "اليوم راحة — الجسم يكبر وقت الراحة.",
  },
  "today.exercises": { en: "exercises", tn: "تمارين" },

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
} as const;

export type StringKey = keyof typeof STRINGS;

/** Translate a known key for the given locale. */
export function t(locale: Locale, key: StringKey): string {
  const entry = STRINGS[key];
  return locale === "tn" ? entry.tn : entry.en;
}
