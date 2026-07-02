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
} as const;

export type StringKey = keyof typeof STRINGS;

/** Translate a known key for the given locale. */
export function t(locale: Locale, key: StringKey): string {
  const entry = STRINGS[key];
  return locale === "tn" ? entry.tn : entry.en;
}
