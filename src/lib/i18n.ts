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
  "plans.from": { en: "from", tn: "ابتداءً من" },
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
  "admin.plans_title": { en: "Subscription plans", tn: "عروض الاشتراك" },
  "admin.months_short": { en: "mo", tn: "شهر" },
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
  "plan.log_meal": { en: "Log this meal as eaten", tn: "سجّل الوجبة هاذي كليتها" },
  "plan.meal_logged": { en: "Logged in your diary", tn: "تسجلت في دفتر الماكلة" },
  "plan.log_item": { en: "Log this food as eaten", tn: "سجّل الماكلة هاذي كليتها" },
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
    en: "Protein target hit — that's how muscle is kept and built. 💪",
    tn: "هدف البروتين تحقق — هكة يتبنى العضل. 💪",
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
    en: "Great day: calories on target and protein locked in. 🎯",
    tn: "نهار ممتاز: سعرات في الهدف وبروتين كامل. 🎯",
  },
  "coach.on_track": {
    en: "On track so far — keep it going.",
    tn: "ماشي مليح لتوّة — كمّل هكة.",
  },

  // ---- live nutrition tile ----
  "tile.left": { en: "left", tn: "باقي" },
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
  "ai.estimate_cta": { en: "Estimate calories", tn: "قدّر السعرات" },
  "ai.estimating": { en: "Estimating…", tn: "قاعد يقدّر…" },
  "ai.results_title": { en: "Detected foods — edit anything", tn: "الماكلة المتعرّف عليها — بدّل اللي تحب" },
  "ai.simulated_note": {
    en: "Estimated from our food database (AI is not configured yet) — double-check the numbers.",
    tn: "تقدير من قاعدة بيانات الماكلة (الذكاء مازال موش مفعّل) — عاود ثبّت في الأرقام.",
  },
  "ai.confidence": { en: "confidence", tn: "ثقة" },
  "ai.grams": { en: "g", tn: "غ" },
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
} as const;

export type StringKey = keyof typeof STRINGS;

/** Translate a known key for the given locale. */
export function t(locale: Locale, key: StringKey): string {
  const entry = STRINGS[key];
  return locale === "tn" ? entry.tn : entry.en;
}
