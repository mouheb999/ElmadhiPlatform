import type { Metadata } from "next";
import Link from "next/link";
import { getLocale } from "@/lib/i18n-server";
import type { Locale } from "@/lib/i18n";
import { LegalShell } from "@/components/legal/legal-shell";
import { PRIVACY_CONTACT_EMAIL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy policy · HYPE FITNESS",
  description: "What HYPE FITNESS collects, why, who it is shared with, and how to delete it.",
};

type Section = { heading: string; paragraphs?: string[]; bullets?: string[] };

/**
 * The privacy policy, in both of the app's languages.
 *
 * Written from what the code actually does, so keep it in step with it: a new
 * third-party service, a new kind of data or a change to retention means a
 * change here and a new LEGAL_LAST_UPDATED in src/lib/legal.ts. Both store
 * listings link to this page, and the App Store's privacy answers must match
 * it.
 *
 * This is a plain-language draft, not legal advice. Have it reviewed before
 * relying on it.
 */
function sections(locale: Locale, contact: string): Section[] {
  if (locale === "tn") {
    return [
      {
        heading: "من نحن",
        paragraphs: [
          "تدير HYPE FITNESS («نحن») تطبيق HYPE FITNESS وموقع hypefitness.club. تشرح هذه الصفحة البيانات التي نجمعها عنك، ولماذا، ومع من نشاركها، وكيف تحذفها.",
          `للتواصل معنا بخصوص خصوصيتك: ${contact}.`,
        ],
      },
      {
        heading: "ما الذي نجمعه",
        bullets: [
          "الحساب: اسمك وبريدك الإلكتروني ورقم هاتفك وكلمة السر (يحفظها مزوّد تسجيل الدخول بشكل مشفّر، ولا نراها)، أو اسمك وبريدك من Google إذا سجّلت الدخول بها.",
          "ملفك وأهدافك: إجاباتك على الأسئلة — العمر والجنس والطول والوزن والنشاط والهدف ومستوى التمرين والإصابات والمعدّات وتفضيلات الأكل.",
          "سجلات الصحة واللياقة: تسجيلاتك اليومية (الوزن والنوم والطاقة)، وحصصك ومجموعاتك، ووجباتك ويوميات الأكل، والمشي السريع.",
          "صور الوجبات: عند استعمال «صوّر»، تُرسل الصورة إلى مزوّد الذكاء الاصطناعي لتقدير السعرات. لا نحفظ الصورة.",
          "الدفع (على الموقع فقط): الخطة التي اخترتها، وطلبات الدفع، وصورة وصل التحويل البنكي التي ترفعها.",
          "الرسائل: أسئلتك في مكتبة الأسئلة ومحادثات الدعم.",
          "بيانات الاستعمال: الصفحات والميزات التي تستعملها ومعلومات الجهاز والمتصفح، لتحسين المنتج.",
        ],
      },
      {
        heading: "لماذا نستعملها",
        bullets: [
          "لتقديم الخدمة: بناء برنامج تمارينك وخطة أكلك ومتابعة تقدّمك.",
          "لتقدير سعرات الوجبات من الصور.",
          "لمعالجة الدفعات والتحقّق منها وتفعيل اشتراكك.",
          "للرد على أسئلتك وطلبات الدعم.",
          "لفهم كيفية استعمال المنتج وتحسينه، ولقياس إعلاناتنا على موقعنا.",
        ],
      },
      {
        heading: "مع من نشاركها",
        paragraphs: ["لا نبيع بياناتك الشخصية. نعتمد على هذه الخدمات لتشغيل HYPE FITNESS، وكل منها يعالج البيانات لحسابنا:"],
        bullets: [
          "Supabase — قاعدة البيانات وتسجيل الدخول وحفظ الملفات.",
          "Vercel — استضافة الموقع والتطبيق.",
          "Anthropic أو Google — تقدير السعرات من صور الوجبات.",
          "PostHog — تحليلات الاستعمال.",
          "Meta — على موقعنا فقط: بكسل Meta، وعند تأكيد عملية شراء نرسل بريدك ورقم هاتفك بشكل مشفّر (hashed) لقياس الإعلانات. لا نرسل أي بيانات صحية.",
          "Telegram — إشعارات داخلية لفريقنا عند وصول دفعة أو رسالة دعم.",
        ],
      },
      {
        heading: "بياناتك الصحية",
        paragraphs: [
          "نستعمل معلومات الوزن والتمرين والأكل فقط لتقديم الخدمة لك. لا نستعملها للإعلانات ولا نشاركها مع المعلنين.",
        ],
      },
      {
        heading: "مدّة الحفظ والحذف",
        paragraphs: [
          "نحفظ بياناتك طالما حسابك موجود. يمكنك حذف حسابك في أي وقت من الإعدادات ← حذف الحساب، داخل التطبيق أو على الموقع. يتم الحذف فوراً: يُحذف حسابك وكل بياناته من قاعدة بياناتنا، وتُحذف وصولات الدفع.",
          "بيانات تحليلات الاستعمال لا تُحذف تلقائياً مع الحساب؛ راسلنا لحذفها. النسخ الاحتياطية الدورية لدى مزوّد الاستضافة تنتهي حسب جدولها.",
        ],
      },
      {
        heading: "حقوقك",
        bullets: [
          "الاطلاع على بياناتك وتصحيحها: أغلبها ظاهر وقابل للتعديل داخل التطبيق.",
          "حذف حسابك وبياناتك: من الإعدادات ← حذف الحساب.",
          `أي طلب آخر: ${contact}.`,
        ],
      },
      {
        heading: "الأعمار",
        paragraphs: ["HYPE FITNESS موجّه للبالغين من 18 سنة فما فوق، ولا نجمع عن قصد بيانات من هم أصغر."],
      },
      {
        heading: "الحماية",
        paragraphs: [
          "تنتقل كل البيانات عبر اتصال مشفّر (HTTPS)، ولا يستطيع أي حساب قراءة بيانات حساب آخر بفضل قواعد الوصول في قاعدة البيانات.",
        ],
      },
      {
        heading: "التغييرات",
        paragraphs: ["إذا غيّرنا هذه السياسة، نحدّث هذه الصفحة وتاريخ «آخر تحديث» في أعلاها."],
      },
    ];
  }

  return [
    {
      heading: "Who we are",
      paragraphs: [
        "HYPE FITNESS (“we”) runs the HYPE FITNESS app and the website hypefitness.club. This page explains what we collect about you, why, who we share it with, and how to delete it.",
        `To contact us about your privacy: ${contact}.`,
      ],
    },
    {
      heading: "What we collect",
      bullets: [
        "Account: your name, email, phone number and password (kept encrypted by our sign-in provider; we never see it), or your name and email from Google if you sign in with it.",
        "Profile and goals: your questionnaire answers — age, sex, height, weight, activity, goal, training experience, injuries, equipment and food preferences.",
        "Health and fitness logs: your daily check-ins (weight, sleep, energy), workouts and sets, meals and food diary, and speed-walking sessions.",
        "Meal photos: when you use Scan, the photo is sent to our AI provider to estimate its calories. We do not store the photo.",
        "Payments (website only): the plan you chose, your payment requests, and the bank-transfer receipt image you upload.",
        "Messages: your questions to the Q&A library and your support conversations.",
        "Usage data: which pages and features you use, and device and browser details, to improve the product.",
      ],
    },
    {
      heading: "Why we use it",
      bullets: [
        "To provide the service: build your workout program and meal plan and track your progress.",
        "To estimate the calories in meal photos.",
        "To process and verify payments and activate your subscription.",
        "To answer your questions and support requests.",
        "To understand how the product is used and improve it, and to measure our advertising on our website.",
      ],
    },
    {
      heading: "Who we share it with",
      paragraphs: [
        "We do not sell your personal data. We rely on these services to run HYPE FITNESS, each processing data on our behalf:",
      ],
      bullets: [
        "Supabase — database, sign-in and file storage.",
        "Vercel — hosting for the website and app.",
        "Anthropic or Google — estimating calories from meal photos.",
        "PostHog — usage analytics.",
        "Meta — on our website only: the Meta pixel, and when a purchase is confirmed, your email and phone number in hashed form to measure ads. No health data is sent.",
        "Telegram — internal notifications to our team when a payment or support message arrives.",
      ],
    },
    {
      heading: "Your health data",
      paragraphs: [
        "We use your weight, training and food information only to provide the service to you. We do not use it for advertising and do not share it with advertisers.",
      ],
    },
    {
      heading: "How long we keep it, and deleting it",
      paragraphs: [
        "We keep your data while your account exists. You can delete your account at any time from Settings → Delete account, in the app or on the website. Deletion is immediate: your account and all of its data are removed from our database, and your payment receipts are deleted.",
        "Usage analytics are not removed automatically with the account; contact us to have them removed. Routine backups at our hosting provider expire on their own schedule.",
      ],
    },
    {
      heading: "Your rights",
      bullets: [
        "See and correct your data: most of it is shown and editable in the app.",
        "Delete your account and data: Settings → Delete account.",
        `Anything else: ${contact}.`,
      ],
    },
    {
      heading: "Age",
      paragraphs: ["HYPE FITNESS is meant for adults aged 18 and over. We do not knowingly collect data from anyone younger."],
    },
    {
      heading: "Security",
      paragraphs: [
        "All data travels over an encrypted connection (HTTPS), and access rules in our database stop any account from reading another account’s data.",
      ],
    },
    {
      heading: "Changes",
      paragraphs: ["If we change this policy, we update this page and the “last updated” date at the top."],
    },
  ];
}

export default async function PrivacyPage() {
  const locale = await getLocale();
  const contact =
    PRIVACY_CONTACT_EMAIL ??
    (locale === "tn" ? "عبر «الدعم» في إعدادات التطبيق" : "through Support in the app’s Settings");

  return (
    <LegalShell locale={locale} title={locale === "tn" ? "سياسة الخصوصية" : "Privacy policy"}>
      {sections(locale, contact).map((section) => (
        <section key={section.heading} className="card-surface flex flex-col gap-3 p-5">
          <h2 className="text-[20px] font-semibold leading-tight tracking-[-0.01em]">{section.heading}</h2>
          {section.paragraphs?.map((p) => (
            <p key={p} className="text-[15px] leading-relaxed text-ink/90">
              {p}
            </p>
          ))}
          {section.bullets && (
            <ul className="flex flex-col gap-2">
              {section.bullets.map((b) => (
                <li key={b} className="flex gap-2.5 text-[15px] leading-relaxed text-ink/90">
                  <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
      <Link href="/delete-account" className="press text-center text-[15px] font-semibold text-accent">
        {locale === "tn" ? "كيف تحذف حسابك" : "How to delete your account"}
      </Link>
    </LegalShell>
  );
}
