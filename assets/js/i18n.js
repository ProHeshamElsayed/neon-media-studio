/* ==========================================================================
   NÉON MEDIA — English UI layer (public pages only)
   - يحفظ الاختيار في localStorage: neonLang
   - يبدّل dir بين rtl وltr بدون مسح أي بيانات أخرى
   - يترجم النصوص الثابتة فقط؛ محتوى الأدمن يبقى كما أدخل
   ========================================================================== */
(function () {
  'use strict';

  var KEY = 'neonLang';
  var DICT = {
    "— جميع الحقوق محفوظة.": "— All rights reserved.",
    "> فكرة": "> Idea",
    "(اختياري)": "(optional)",
    "؟": "?",
    "✔ تعديلات مجانية": "✔ Free revisions",
    "✔ تنفيذ في المواعيد": "✔ On-time delivery",
    "✔ ملفات أصلية لك": "✔ Source files included",
    "10:00 ص – 8:00 م": "10:00 AM – 8:00 PM",
    "3 ألوان كحد أقصى، تباين للقراءة، واختبار على mobile.": "Max 3 colors, readable contrast, and mobile testing.",
    "5 نصائح لتصاميم سوشيال ميديا تجذب التوقف": "5 social media design tips that stop the scroll",
    "8 أحرف على الأقل، مع حرف كبير وصغير ورقم ورمز.": "At least 8 characters, with uppercase, lowercase, a number and a symbol.",
    "ابدأ طلبك الآن": "Start your order now",
    "ابعتلنا الفكرة، ونرجعلك بخطة واضحة للسعر والوقت قبل ما نبدأ.": "Send us your idea, and we'll come back with a clear plan for price and timeline before we start.",
    "ابعتلنا تفاصيل مشروعك، أو كلمنا مباشرة على واتساب. عادة نرد خلال ساعات العمل.": "Send us your project details, or call us directly on WhatsApp. We usually reply during business hours.",
    "ابعتلنا رسالة": "Send us a message",
    "اتصال هاتفي": "Phone call",
    "إجابات": "Answers",
    "اجمع كل الخدمات التي تحتاجها في طلب واحد، ثم أكّد البيانات وسيفتح واتساب برسالة جاهزة بالتفاصيل.": "Combine all the services you need in one order, then confirm your details and WhatsApp opens with a ready message.",
    "احتفظ برقم الطلب، وكمّل التأكيد على واتساب عشان نبدأ التنفيذ في أسرع وقت.": "Keep your order number and complete confirmation on WhatsApp so we can start as quickly as possible.",
    "اختار التصنيف اللي يناسبك، وشوف مختاراتنا من نفس الخط.": "Pick the category that suits you and browse our picks from the same line.",
    "اختر الخدمة (اختياري)": "Choose a service (optional)",
    "اختر المحافظة": "Choose a governorate",
    "إدارة السوشيال ميديا": "Social media management",
    "إدارة سوشيال ميديا متكاملة بأسعار واضحة. تقدر تبدأ بباقة وتطورها في أي وقت حسب احتياج مشروعك.": "Complete social media management with clear pricing. Start with a package and upgrade anytime as your project grows.",
    "أدخل رقم الطلب (مثال: HE-1001) لتشوف حالته وحالة الدفع.": "Enter your order number (e.g. HE-1001) to check its status and payment status.",
    "ادفع": "Pay",
    "إذا كنت مسجّل الدخول، سنعرض طلباتك تلقائيًا. وإلا، سجّل الدخول في «حسابي» أو تواصل معنا على واتساب.": "If you're signed in, we'll show your orders automatically. Otherwise, sign in from \"My Account\" or contact us on WhatsApp.",
    "إرسال الرسالة": "Send message",
    "إرسال ومتابعة على واتساب": "Send and continue on WhatsApp",
    "أرسل لنا تفاصيل مشروعك": "Send us your project details",
    "أريد مشروعًا مشابهًا": "I want a similar project",
    "استخدم كلمة مرور قوية لا تستخدمها في مواقع أخرى. سيتم تسجيل خروجك من الأجهزة الأخرى بعد التغيير.": "Use a strong password you don't use on other sites. You'll be signed out of other devices after changing it.",
    "استوديو إبداعي · تسويق رقمي · محتوى": "Creative studio · Digital marketing · Content",
    "استوديو التسويق الرقمي والإبداع البصري.": "Digital marketing and visual creative studio.",
    "استوديو التسويق الرقمي والإبداع البصري. نصنع أفكارًا تُرى، ونتائج تُقاس.": "Digital marketing and visual creative studio. We make ideas visible and results measurable.",
    "اسحب المقبض أفقيًا لترى نفس التصميم قبل وبعد اللمسة الاحترافية.": "Drag the handle sideways to see the same design before and after the professional touch.",
    "اسم المشروع": "Project name",
    "اسم النشاط / الشركة": "Business / company name",
    "أسوان": "Aswan",
    "أسئلة": "Questions",
    "أسئلة شائعة": "FAQs",
    "أسيوط": "Assiut",
    "إضاءة": "Lighting",
    "إضاءة، زاوية، ومعالجة لونية موحدة.": "Lighting, angle, and consistent color grading.",
    "إضافة": "Add",
    "أضف خدمة أو باقة إلى السلة": "Add a service or package to the cart",
    "أضف رابط فيديو من لوحة التحكم": "Add a video link from the admin panel",
    "اطلب الآن": "Order now",
    "اطلب الآن وابدأ المحادثة": "Order now and start the chat",
    "اطلب خدمتك الآن": "Order your service now",
    "اطلب هذه الخدمة": "Order this service",
    "إعادة إرسال الرابط": "Resend link",
    "إعلانات": "Ads",
    "إعلانات · تحليل · كتابة": "Ads · Analytics · Copywriting",
    "أعمالنا": "Our work",
    "أعمالنا في 60 ثانية": "Our work in 60 seconds",
    "إغلاق": "Close",
    "افتح الموقع على الخريطة": "Open map",
    "أفضّل عدم الذكر": "Prefer not to say",
    "اقرأ المزيد": "Read more",
    "اكتب 10 أحرف على الأقل.": "Write at least 10 characters.",
    "اكتب اسمك من فضلك.": "Please enter your name.",
    "اكتب بريدًا صحيحًا.": "Enter a valid email.",
    "اكتب رقم هاتف صحيح.": "Enter a valid phone number.",
    "اكتب لنا عن مشروعك وسنعاود التواصل معك في أقرب وقت.": "Tell us about your project and we'll get back to you as soon as possible.",
    "اكتشف العرض": "Explore the offer",
    "اكتشف العروض": "Explore offers",
    "اكتشف المزيد": "Discover more",
    "اكتشف خدماتنا": "Explore our services",
    "أكثر من 8 سنوات في تحويل الأفكار إلى علامات تجارية يتحدث عنها الناس.": "Over 8 years turning ideas into brands people talk about.",
    "أكثر من 85 عميلًا في مصر والخليج اختاروا نِيون ميديا ليكونوا جزءًا من حكايتهم.": "Over 85 clients in Egypt and the Gulf chose NEON MEDIA to be part of their story.",
    "أكثر من مجرد استوديو… شريكك في النمو": "More than a studio… your growth partner",
    "أكّد بريدك الإلكتروني": "Confirm your email",
    "الاتصال": "Contact",
    "الاتصال والمساعدة": "Contact & support",
    "الاتصال والمساعدة | نِيون ميديا": "Contact & support | NEON MEDIA",
    "الإجمالي": "Total",
    "الإسكندرية": "Alexandria",
    "الاسم": "Name",
    "الاسم الكامل": "Full name",
    "الاسم بالكامل": "Full name",
    "الإسماعيلية": "Ismailia",
    "الأسئلة الشائعة": "FAQs",
    "الأقصر": "Luxor",
    "الأمان وتغيير كلمة المرور": "Security & password change",
    "البحر الأحمر": "Red Sea",
    "البحيرة": "Beheira",
    "البريد الإلكتروني": "Email",
    "التباين، التسلسل، CTA واضح، صور حقيقية، واختبار A/B.": "Contrast, hierarchy, a clear CTA, real photos, and A/B testing.",
    "التسويق الإلكتروني": "Digital marketing",
    "التصوير الاحترافي": "Professional photography",
    "التصوير: 3 إعدادات ترفع جودة صورك": "Photography: 3 settings that raise your image quality",
    "التواصل المفضل": "Preferred contact method",
    "الجمعة": "Friday",
    "الجيزة": "Giza",
    "الخدمة المطلوبة": "Service requested",
    "الدخول بدون صوت": "Enter without sound",
    "الدعم على واتساب": "WhatsApp support",
    "الدفع الإلكتروني": "Online payment",
    "الدقهلية": "Dakahlia",
    "الرئيسية": "Home",
    "السبت – الخميس": "Sat – Thu",
    "السبت – الخميس · 10 ص – 8 م": "Sat – Thu · 10 AM – 8 PM",
    "السنة:": "Year:",
    "السويس": "Suez",
    "السيرة الكاملة": "Full bio",
    "الشرقية": "Sharqia",
    "العميل:": "Client:",
    "العنوان بالتفصيل": "Detailed address",
    "الغربية": "Gharbia",
    "الفرق": "Team",
    "الفريق · CREW": "The team · CREW",
    "الفيوم": "Fayoum",
    "القاهرة": "Cairo",
    "القليوبية": "Qalyubia",
    "المحافظة": "Governorate",
    "المدينة / المركز": "City / center",
    "المسوّق": "Marketer",
    "المصمم": "Designer",
    "المصور": "Photographer",
    "المطبوعات والدعاية": "Print & advertising",
    "المعرض · WORKS": "Portfolio · WORKS",
    "المقالات": "Articles",
    "المقالات | نِيون ميديا": "Articles | NEON MEDIA",
    "المنوفية": "Menoufia",
    "المنيا": "Minya",
    "المواقع والمنيوهات": "Websites & motion graphics",
    "الموبايل": "Mobile",
    "النشاط / الشركة": "Business / company",
    "النوع": "Type",
    "الوادي الجديد": "New Valley",
    "أن نكون الاستوديو العربي الأول الذي يربط الإبداع بالنتائج.": "To be the first Arabic studio connecting creativity with measurable results.",
    "أن نمنح كل مشروع حضورًا ينافس الكبار.": "To give every project a presence that competes with the big players.",
    "أنثى": "Female",
    "إنشاء الحساب": "Create account",
    "أهلًا بك في نِيون ميديا": "Welcome to NEON MEDIA",
    "أو على واتساب": "Or on WhatsApp",
    "أوافق على استلام العروض والمستجدات على وسيلة التواصل المختارة (اختياري).": "I agree to receive offers and updates via my chosen contact method (optional).",
    "أوافق على سياسة الخصوصية وشروط الاستخدام، وأؤكد أن بياناتي صحيحة.": "I agree to the privacy policy and terms of use, and confirm my details are correct.",
    "آية الكرسي — الشيخ مشاري العفاسي": "Ayat al-Kursi — Sheikh Mishary Al-Afasy",
    "أين": "Where",
    "باقات شهرية": "Monthly packages",
    "باقات مصممة": "Tailored packages",
    "بالطريقة اللي تريحك": "The way that suits you",
    "بالمواعيد المسبقة فقط": "By appointment only",
    "بالنتائج": "With results",
    "بحث": "Search",
    "بدأت الحكاية من شغف بالتفاصيل…": "It started with a passion for details…",
    "بريد إلكتروني": "Email",
    "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ": "In the name of Allah, the Most Gracious, the Most Merciful",
    "بعد": "After",
    "بنرد على واتساب في أقل من ساعة": "We reply on WhatsApp in under an hour",
    "بنشتغل على المشروع كأنه مشروعنا": "We work on your project as if it were our own",
    "بني سويف": "Beni Suef",
    "بورسعيد": "Port Said",
    "بياناتك محفوظة بأمان، ولا تُستخدم إلا لمتابعة خدمتك.": "Your data is stored securely and used only to follow up on your service.",
    "بياناتك محفوظة على جهازك فقط ولا تُرسل لأي جهة خارجية.": "Your data stays on your device and is not sent to any third party.",
    "بياناتي": "My details",
    "تابع": "Follow",
    "تاريخ الميلاد": "Date of birth",
    "تأكيد الطلب وفتح واتساب": "Confirm order and open WhatsApp",
    "تأكيد كلمة المرور": "Confirm password",
    "تأكيد كلمة المرور الجديدة": "Confirm new password",
    "تبقى مشروع كامل": "A full project",
    "تتبّع الطلب": "Track order",
    "تتبّع الطلب | نِيون ميديا": "Track order | NEON MEDIA",
    "تتبّع حالة التنفيذ: جديد ← قيد التنفيذ ← مكتمل.": "Track progress: New → In progress → Completed.",
    "تتبّع طلبك": "Track your order",
    "تتكلم عن نفسها": "Speaks for itself",
    "تحت سقف واحد": "Under one roof",
    "تحدث معنا": "Talk to us",
    "تحدث معنا الآن": "Chat with us now",
    "تحديث": "Update",
    "تحققت؟ حدّث الحالة": "Verified? Update the status",
    "تحليل": "Analytics",
    "تحميص يومي وحبوب مختصة": "Daily roasting and specialty beans",
    "تخطي": "Skip",
    "تخطي إلى المحتوى الرئيسي": "Skip to main content",
    "تسجيل الخروج": "Sign out",
    "تسجيل الدخول": "Sign in",
    "تسليم سريع": "Fast delivery",
    "تشغيل التلاوة والدخول": "Play recitation and enter",
    "تصفية حسب المجال": "Filter by field",
    "تصميم الجرافيك": "Graphic design",
    "تصوير": "Photography",
    "تصوير · مونتاج · إضاءة": "Photography · Editing · Lighting",
    "تعال قابلنا في الاستوديو": "Come meet us at the studio",
    "تغيير كلمة المرور": "Change password",
    "تفاصيل إضافية": "Additional details",
    "تفاصيل الخدمة": "Service details",
    "تفاصيل المشروع": "Project details",
    "تلات أدوار": "Three roles",
    "تلمع في النور": "Shines in the light",
    "تم تسجيل طلبك بنجاح": "Your order was recorded successfully",
    "تواصل معنا": "Contact us",
    "ثقة تُبنى": "Trust is built",
    "جلسة تعارف سريعة نفهم فيها مشروعك، جمهورك، وأهدافك من أول يوم.": "A quick intro session where we understand your project, audience, and goals from day one.",
    "جلسة تعارف قصيرة… وبعدها خطة واضحة وتنفيذ بمعيار واحد.": "A short intro… then a clear plan and delivery to one standard.",
    "جنوب سيناء": "South Sinai",
    "جودة 4K": "4K quality",
    "حالة الدفع وطريقة الدفع وتفاصيل الضريبة عند تفعيلها.": "Payment status, payment method, and tax details when enabled.",
    "حساب جديد": "New account",
    "حساب نِيون": "NEON account",
    "حسابك الشخصي": "Your account",
    "حسابك في نِيون ميديا · تابع طلباتك خطوة بخطوة": "Your NEON MEDIA account · follow your orders step by step",
    "حسابك يخلّي المتابعة أسهل: تعرف طلبك وصل لفين، إيه اللي اتنفّذ، وإيه المتبقي — بدون ما تسأل كل مرة.": "Your account makes follow-up easier: see how far your order has come, what's done, and what's left — without asking every time.",
    "حسابي": "My account",
    "حسابي وطلباتي": "My account & orders",
    "حسابي وطلباتي | نِيون ميديا": "My account & orders | NEON MEDIA",
    "حفظ البيانات": "Save changes",
    "خدماتنا": "Our services",
    "خطة واضحة للخدمة، جدول زمني، وعرض سعر شفاف بدون مفاجآت.": "A clear service plan, timeline, and transparent quote with no surprises.",
    "خطوات واضحة وشفافة، وانت على اطلاع بكل مرحلة.": "Clear, transparent steps, and you're kept in the loop at every stage.",
    "خلّينا نبدأ": "Let's begin",
    "خلّينا نتكلم": "Let's talk",
    "دخول لحسابي": "Sign in to my account",
    "دمياط": "Damietta",
    "ذكر": "Male",
    "رسالتنا": "Our message",
    "رقم الطلب": "Order number",
    "رقم الطلب:": "Order number:",
    "رقم الموبايل": "Mobile number",
    "رقم الهاتف": "Phone number",
    "رقم الهاتف / واتساب": "Phone / WhatsApp",
    "روابط سريعة": "Quick links",
    "رُوست": "ROAST",
    "رؤيتنا": "Our vision",
    "ساعات العمل": "Opening hours",
    "سجّل دخولك أو أنشئ حسابًا جديدًا لتشوف كل طلباتك، حالة التنفيذ، وحالة الدفع — في مكان واحد وآمن.": "Sign in or create a new account to see all your orders, progress, and payment status — in one secure place.",
    "سريعة": "Quick",
    "سلة الطلب": "Order cart",
    "سنوات من الإبداع": "Years of creativity",
    "سؤال، فكرة، أو طلب عرض سعر؟ تواصل معنا بالطريقة اللي تناسبك. فريق نِيون ميديا جاهز لمساعدتك.": "A question, an idea, or a quote request? Reach out the way that suits you. The NEON MEDIA team is ready to help.",
    "سوشيال": "Social",
    "سوشيال ميديا": "Social media",
    "سوهاج": "Sohag",
    "سيتم تأكيد طريقة الدفع عبر واتساب.": "The payment method will be confirmed on WhatsApp.",
    "شاهد": "Watch",
    "شاهد أعمالنا": "See our work",
    "شاهد الأسئلة الشائعة": "See FAQs",
    "شغف + استراتيجية": "Passion + strategy",
    "شغل إبداعي بمعايير عالية، مع مراجعات وتعديلات لحد ما توصل للرضا.": "Creative work to high standards, with reviews and revisions until you're satisfied.",
    "شمال سيناء": "North Sinai",
    "شوف الباقات": "See packages",
    "صُنع بـ": "Made with",
    "طرق الدفع": "Payment methods",
    "طرق دفع متعددة وآمنة. اختر الطريقة المناسبة، وأكد طلبك على واتساب قبل بدء التنفيذ.": "Multiple secure payment methods. Choose what suits you and confirm on WhatsApp before we start.",
    "طريقة التواصل المفضلة": "Preferred contact method",
    "طريقة الدفع المفضلة": "Preferred payment method",
    "طريقة العمل": "How we work",
    "طلباتك، حالتك، وتفاصيل فاتورتك": "Your orders, your status, and invoice details",
    "طلباتي": "My orders",
    "طلبك": "Your order",
    "ع": "G",
    "عرض الافتتاح · خصم 15% على باقة إدارة السوشيال ميديا — لفترة محدودة": "Launch offer · 15% off social media management — limited time",
    "عرض الافتتاح · خصم 15% على باقة إدارة السوشيال ميديا": "Launch offer · 15% off social media management",
    "عرض مرئي": "Video showcase",
    "عملاؤنا": "Our clients",
    "عملائنا": "Our clients",
    "عميل نِيون": "NEON client",
    "عندك مشروع مشابه؟": "Have a similar project?",
    "فريق الدعم": "Support team",
    "فكرتك الجاية تستاهل": "Your next idea deserves",
    "في القاهرة": "In Cairo",
    "في مكان واحد": "In one place",
    "قبل": "Before",
    "قبل / بعد": "Before / after",
    "قرّب الماوس… عين الشخصيات بتتابع حركتك. ودوس على أي شخصية.": "Hover… the characters follow your cursor. Click any character.",
    "قنا": "Qena",
    "قنوات التواصل المباشر": "Direct contact channels",
    "قهوة مختصة": "Specialty coffee",
    "كتابة": "Copywriting",
    "كفر الشيخ": "Kafr El Sheikh",
    "كل طلباتك محفوظة — تقدر ترجع لها في أي وقت.": "All your orders are saved — you can come back to them anytime.",
    "كل ما تحتاج معرفته قبل الطلب": "Everything you need to know before ordering",
    "كل ما تحتاجه علامتك": "Everything your brand needs",
    "كل ما تكتبه هنا يصلنا فورًا على واتساب، ونحتفظ به للرد عليك.": "Everything you write here reaches us instantly on WhatsApp, and we keep it to reply to you.",
    "كلمة المرور": "Password",
    "كلمة المرور الجديدة": "New password",
    "كلمة المرور الحالية": "Current password",
    "كيف تختار ألوان علامتك (بدون مبالغة)": "How to choose your brand colors (without overdoing it)",
    "لأهم أسئلتك": "For your top questions",
    "لتفاصيل إضافية (إيصال ضريبي، تعديل)، تواصل معنا على واتساب.": "For extra details (tax receipt, edits), contact us on WhatsApp.",
    "لتنمو معك": "To grow with you",
    "لحظة بلحظة": "Step by step",
    "للتسليم": "To delivery",
    "للنمو": "For growth",
    "لم تضف خدمات بعد": "No services added yet",
    "لمحة سريعة عن ما نقدمه — من الهوية إلى الإعلانات، من التصوير إلى التسويق.": "A quick look at what we offer — from identity to ads, from photography to marketing.",
    "لمن نُصمّم الحضور؟": "Who do we build a presence for?",
    "م. هشام السيد": "Hesham El-Sayed",
    "متابعة على واتساب": "Continue on WhatsApp",
    "متاح الآن": "Available now",
    "متاح للعمل الآن": "Available for work now",
    "متصل الآن": "Online now",
    "مجالات مختلفة": "Different fields",
    "مختارات من الهويات والتصاميم والتصوير والحملات اللي صنعناها لعلامات في مجالات مختلفة.": "A selection of identities, designs, photos, and campaigns we made for brands across different fields.",
    "مختصرات عملية من تجربتنا في التسويق والتصميم.": "Practical takeaways from our marketing and design experience.",
    "مدير إبداع": "Creative director",
    "مش لاقي الخدمة اللي محتاجها؟ اطلب عرضًا مخصصًا يناسب مشروعك وميزانيتك.": "Can't find what you need? Request a custom quote that fits your project and budget.",
    "مشاريع": "Projects",
    "مشروعًا في المعرض": "a project in the portfolio",
    "مشروعك": "Your project",
    "مشروعك مش في القائمة؟ كلمنا": "Your project isn't listed? Talk to us",
    "مصر - الدقهلية": "Egypt - Dakahlia",
    "مطروح": "Matrouh",
    "مقالات": "Articles",
    "ملفات أصلية": "Source files",
    "ملفات أصلية جاهزة للاستخدام، ومتابعة نتائج لتحسين الأداء باستمرار.": "Ready-to-use source files, and result tracking to keep improving.",
    "من «الإعدادات ← الفيديو الترويجي» في لوحة التحكم": "From \"Settings ← Promo video\" in the admin panel",
    "من الاستوديو · VECTOR BANNER": "From the studio · VECTOR BANNER",
    "من الفكرة": "From the idea",
    "من الهوية والتصميم للتصوير والإعلانات والمواقع… اختر الخدمة اللي تناسب مرحلتك، وإحنا نكمل الباقي.": "From identity and design to photography, ads, and websites — choose the service that fits your stage, and we'll handle the rest.",
    "من أول فكرة لحد آخر انطباع… نبنِي لك حضورًا رقميًا متكاملًا: هوية، محتوى، تصوير، إعلانات، وموقع يجذب عملاءك.": "From first idea to last impression… we build a complete digital presence: identity, content, photography, ads, and a site that attracts clients.",
    "من أول هوية لحد إعلان يشتغل… فريق واحد، خطة واحدة، ونتيجة واحدة — من أول موشن لحد آخر إعلان.": "From first identity to an ad that works… one team, one plan, one result — from motion to the final ad.",
    "منشور سوشيال ميديا + هوية بصرية": "Social post + visual identity",
    "مؤسس نِيون ميديا · مدير الإبداع": "Founder of NEON MEDIA · Creative director",
    "موشن": "Motion",
    "موقعنا": "Our site",
    "مونتاج": "Editing",
    "نبدأ يومنا بآية من القرآن الكريم، ثم نصنع لك حضورًا يخطف الأنظار.": "We start our day with a verse from the Quran, then create a presence that turns heads.",
    "نبذة سريعة عن المؤسس": "Quick intro about the founder",
    "نبذة عنا": "About us",
    "نجهّز لك تجربة تلمع… لحظات": "We're preparing a shiny experience… moments",
    "نجهّز…": "Preparing…",
    "نحن هنا من أجلك": "We're here for you",
    "نخدم كل مشروع يستحق أن يُرى ويُتذكّر — من الكافيه الصغير للشركة الكبيرة.": "We serve every project that deserves to be seen and remembered — from the small café to the large company.",
    "نخطط ونقترح": "We plan and propose",
    "نرد عادة خلال ساعتين": "We usually reply within two hours",
    "نستقبل طلبات جديدة": "We're accepting new orders",
    "نستقبل مشاريع جديدة": "We're accepting new projects",
    "نسخ رقم الطلب": "Copy order number",
    "نسلّم ونقيس": "We deliver and measure",
    "نسمع ونفهم": "We listen and understand",
    "نسيت كلمة المرور؟": "Forgot password?",
    "نصائح": "Tips",
    "نصمم وننفذ": "We design and execute",
    "نصنع أفكارًا تُرى، ونتائج تُقاس.": "We make ideas visible and results measurable.",
    "نصنع علامات": "We build brands",
    "نمو حقيقي": "Real growth",
    "نِيون ميديا": "NEON MEDIA",
    "نِيون ميديا | تسويق رقمي · سوشيال ميديا · تصوير · تصميم": "NEON MEDIA | Digital marketing · Social media · Photography · Design",
    "هشام السيد": "Hesham El-Sayed",
    "هوية": "Identity",
    "هوية بصرية": "Visual identity",
    "هوية بصرية · سوشيال · موشن": "Visual identity · Social · Motion",
    "هوية كافيه «رُوست»": "ROAST café identity",
    "واتساب": "WhatsApp",
    "واتساب — الأسرع": "WhatsApp — fastest",
    "وإذا كان سؤالك مش هنا، ابعتلنا على واتساب وهنجاوبك فورًا.": "If your question isn't here, send us a WhatsApp and we'll answer right away.",
    "وصناعة المحتوى": "And content creation",
    "ونتيجة واحدة": "And one result",
    "يتحدّث عن نفسه": "Speaks for itself",
    "يرجى تفعيل JavaScript لتجربة الموقع كاملة.": "Please enable JavaScript for the full experience.",
    "يرجى تفعيل JavaScript.": "Please enable JavaScript.",
    "يمكنك التحكم في الصوت من زر السماعة أعلى الموقع.": "You can control the sound from the speaker button at the top of the site.",
    "أرسلنا رابط تأكيد إلى بريدك. تأكيد البريد يحمي حسابك ويضمن وصول تحديثات طلباتك. راجع صندوق الوارد أو الرسائل غير المرغوب فيها.": "We sent a confirmation link to your email. Confirming protects your account and ensures order updates reach you. Check your inbox or spam folder.",
    "التصميم والتصوير والتسويق مش خطوط منفصلة — دول تلات شخصيات بتشتغل على نفس الفكرة، وكل واحد بيحط اللمسة الأخيرة على شغل التاني.": "Design, photography, and marketing aren't separate lines — they're three people working on the same idea, each adding the final touch to the other's work.",
    "الدفع الإلكتروني متاح (إنستاباي، فودافون كاش، تحويل بنكي أو رابط دفع آمن)، لا نطلب بيانات بطاقة داخل الموقع": "Online payment is available (Instapay, Vodafone Cash, bank transfer, or a secure payment link). We never ask for card details on the site.",
    "الطلبات تظهر هنا تلقائيًا لو اتعملت وأنت مسجّل الدخول. للطلبات القديمة اللي قبل إنشاء الحساب، تواصل معنا على واتساب ونربطها بحسابك.": "Orders placed while you're signed in appear here automatically. For older orders placed before creating an account, contact us on WhatsApp and we'll link them to your account.",
    "بإنشاء الحساب تقدر تتابع طلباتك وتوصل لتفاصيلها في أي وقت. بياناتك محفوظة في Firebase ولا تُستخدم إلا لخدمتك، ولا نطلب بيانات بطاقة أبدًا.": "With an account you can track your orders and open their details anytime. Your data is stored in Firebase and used only for your service — we never ask for card details.",
    "أدخل البريد الإلكتروني وكلمة المرور.": "Enter your email and password.",
    "أدخل بريدًا إلكترونيًا صحيحًا.": "Enter a valid email address.",
    "أدخل رقم الطلب.": "Enter the order number.",
    "أدخل رقم موبايل مصري صحيح يبدأ بـ 010 أو 011 أو 012 أو 015.": "Enter a valid Egyptian mobile number starting with 010, 011, 012 or 015.",
    "أدخل رقم موبايل مصري صحيح.": "Enter a valid Egyptian mobile number.",
    "أدخل كلمة المرور الحالية.": "Enter your current password.",
    "أرسل رقم الطلب واتساب 💬": "Send order number on WhatsApp 💬",
    "أرسل رقم الطلب 💬": "Send order number 💬",
    "أرسل على واتساب 💬": "Send on WhatsApp 💬",
    "أرسلنا رابط التأكيد مرة أخرى. راجع بريدك.": "Confirmation link resent. Check your email.",
    "أضف خدمة أو باقة واحدة على الأقل إلى السلة أولًا.": "Add at least one service or package to the cart first.",
    "اختر خدمة أو باقة أولًا.": "Choose a service or package first.",
    "اختر المحافظة.": "Choose a governorate.",
    "الأسئلة الشائعة ❓": "FAQs ❓",
    "الباقات الشهرية": "Monthly packages",
    "البريد الإلكتروني أو كلمة المرور غير صحيحة.": "Incorrect email or password.",
    "البريد لم يُؤكَّد بعد. افتح رابط التأكيد ثم حاول مجددًا.": "Email not verified yet. Open the confirmation link and try again.",
    "التفاصيل": "Details",
    "الخدمات": "Services",
    "الخدمات والأسعار": "Services & prices",
    "السعر يبدأ من": "Starting from",
    "سعر الباقة": "Package price",
    "الدفع عند الاستلام": "Cash on delivery",
    "جديد": "New",
    "قيد التنفيذ": "In progress",
    "مكتمل": "Completed",
    "غير مدفوع": "Unpaid",
    "مدفوع": "Paid",
    "تم النسخ بنجاح": "Copied successfully",
    "تعذر النسخ، انسخ النص يدويًا": "Copy failed. Please copy the text manually.",
    "تعذر الاتصال بالإنترنت. تحقق من الشبكة وحاول مجددًا.": "No internet connection. Check your network and try again.",
    "تم تسجيل طلبك، وفتح واتساب لتأكيده.": "Your order was recorded and WhatsApp opened for confirmation.",
    "تم حفظ رسالتك وفتح واتساب لإكمال الإرسال.": "Your message was saved and WhatsApp opened to complete sending.",
    "حالة طلبي": "My order status",
    "الطلبات": "Orders",
    "حسابي 👤": "My account 👤",
    "إرسال": "Send",
    "إلغاء": "Cancel",
    "إغلاق المحادثة": "Close chat",
    "الوضع الداكن": "Dark mode",
    "الوضع الفاتح": "Light mode",
    "تفعيل الوضع الداكن": "Enable dark mode",
    "تفعيل الوضع الفاتح": "Enable light mode",
    "زيادة العدد": "Increase quantity",
    "تقليل العدد": "Decrease quantity",
    "حذف من السلة": "Remove from cart",
    "تعديل الطلب": "Edit order",
    "سيتم الاتفاق": "To be agreed",
    "تعذر تحميل طلباتك الآن. حدّث الصفحة وحاول مجددًا.": "Couldn't load your orders now. Refresh and try again.",
    "خدمة واحدة مختارة": "One service selected",
    "خدمتان مختارتان": "Two services selected",
    "أسعار": "Prices",
    "أعمال": "Work",
    "أمان": "Security",
    "إعلان": "Announcement",
    "إغلاق الإعلان": "Dismiss announcement",
    "إنشاء حساب": "Create account",
    "إنشاء حساب / دخول 👤": "Sign up / Sign in 👤",
    "إيصال": "Receipt",
    "إيصال استلام مقدم": "Advance payment receipt",
    "إيصال ضريبي معتمد": "Official tax receipt",
    "إيقاف التلاوة": "Stop recitation",
    "إيميل": "Email",
    "ابدأ الآن": "Get started",
    "احجز العرض 🎟️": "Claim the offer 🎟️",
    "التنقل بين الأقسام": "Section navigation",
    "الدفع": "Payment",
    "الإيصال النهائي (PDF)": "Final receipt (PDF)",
    "تحميل الإيصال PDF": "Download receipt PDF",
    "الأعمال": "Work",
    "الخدمات المفردة 🛠️": "Individual services 🛠️",
    "الباقات الشهرية 📦": "Monthly packages 📦",
    "الباقات 📦": "Packages 📦",
    "الفاتورة الضريبية 🧾": "Tax invoice 🧾",
    "الضمان والاسترداد": "Guarantee & refund",
    "العروض": "Offers",
    "المؤسس": "Founder",
    "الاسم: ": "Name: ",
    "البريد: ": "Email: ",
    "الهاتف: ": "Phone: ",
    "الرسالة: ": "Message: ",
    "السعر: ": "Price: ",
    "السعر": "Price",
    "الحالة": "Status",
    "المدة": "Duration",
    "مدة التنفيذ": "Delivery time",
    "مين إحنا؟ 👋": "Who we are? 👋",
    "العروض الحالية 🎁": "Current offers 🎁",
    "تواصل معنا 📬": "Contact us 📬",
    "الخدمات المتاحة 🛠️": "Available services 🛠️",
    "مختارات من أعمالنا 🎨": "Selected work 🎨",
    "طرق الدفع المتاحة 💳": "Available payment methods 💳",
    "اطلب": "Order",
    "اطلب الآن 🛒": "Order now 🛒",
    "اطلب الخدمة 🛒": "Order this service 🛒",
    "اطلب باقة 🛒": "Order a package 🛒",
    "اطلب مشروعك 🚀": "Order your project 🚀",
    "افتح حسابي 👤": "Open my account 👤",
    "تحدث معنا 💬": "Chat with us 💬",
    "تحدث معنا 📄": "Contact page 📄",
    "كل الخدمات 🛠️": "All services 🛠️",
    "كلمني واتساب 💬": "Message me on WhatsApp 💬",
    "الفاتورة الضريبية": "Tax invoice",
    "شوف الأعمال 🎨": "See our work 🎨",
    "شامل الضريبة عند تفعيلها": "VAT included where applicable",
    "تفاصيل الطلب": "Order details",
    "حالة الدفع": "Payment status",
    "طريقة الدفع": "Payment method",
    "تاريخ الطلب": "Order date",
    "تاريخ التنفيذ": "Delivery date",
    "تاريخ السداد": "Payment date",
    "الخدمة": "Service",
    "الإجمالي": "Total",
    "خدمة": "Service",
    "عنصر": "item"
  };

  var ATTRS = ['placeholder', 'title', 'aria-label', 'alt', 'value'];
  // محتوى يدخله الأدمن أو يأتي من الطلبات/الرسائل لا يُترجم أبدًا، حتى لو طابق كلمة في القاموس.
  var USER_CONTENT = '[data-no-i18n], [data-user-content]';
  var UI_OVERRIDE = '[data-i18n-ui]';
  var USER_CONTAINERS = '.service-card, .package-card, .work-card, .testimonial-card, .account-order, .track-empty, .filter-empty, .order-cart, .service-detail__body';
  var textOriginals = new WeakMap();
  var lang = 'ar';

  function getLang() {
    try { return localStorage.getItem(KEY) === 'en' ? 'en' : 'ar'; } catch (e) { return 'ar'; }
  }

  function saveLang(value) {
    try { localStorage.setItem(KEY, value); } catch (e) { /* تجاهل */ }
  }

  function isUserContent(el) {
    return !!(el && el.closest && el.closest(USER_CONTENT) && !el.closest(UI_OVERRIDE));
  }

  function translateText(node) {
    if (!node.nodeValue || !node.nodeValue.trim()) return;
    var parent = node.parentElement;
    if (!parent || /^(SCRIPT|STYLE|NOSCRIPT)$/i.test(parent.tagName)) return;
    if (isUserContent(parent)) return;
    if (!textOriginals.has(node)) textOriginals.set(node, node.nodeValue);
    if (lang !== 'en') {
      node.nodeValue = textOriginals.get(node);
      return;
    }
    var original = textOriginals.get(node);
    var key = original.trim();
    if (DICT[key]) node.nodeValue = original.replace(key, DICT[key]);
  }

  function translateAttributes(root) {
    var nodes = [root];
    if (root.querySelectorAll) nodes = nodes.concat(Array.prototype.slice.call(root.querySelectorAll('*')));
    nodes.forEach(function (el) {
      if (!el || !el.getAttribute) return;
      if (isUserContent(el)) return;
      ATTRS.forEach(function (attr) {
        var attrKey = 'data-i18n-orig-' + attr;
        var current = el.getAttribute(attr);
        if (current === null || current === undefined) return;
        if (!el.hasAttribute(attrKey)) el.setAttribute(attrKey, current);
        var original = el.getAttribute(attrKey);
        if (lang !== 'en') {
          if (current !== original) el.setAttribute(attr, original);
          return;
        }
        var translated = DICT[original.trim()];
        if (translated && current !== translated) el.setAttribute(attr, original.replace(original.trim(), translated));
      });
    });
  }

  function markUserContent(root) {
    if (!root || !root.querySelectorAll || !root.matches) return;
    if (root.matches(USER_CONTAINERS)) root.setAttribute('data-user-content', '');
    Array.prototype.forEach.call(root.querySelectorAll(USER_CONTAINERS), function (el) {
      el.setAttribute('data-user-content', '');
    });
  }

  function walk(root) {
    if (!root || root.nodeType === 9) root = document.body;
    if (!root) return;
    if (root.nodeType === 3) {
      translateText(root);
      return;
    }
    markUserContent(root);
    var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    var node;
    while ((node = walker.nextNode())) translateText(node);
    translateAttributes(root);
  }

  function addSwitcher() {
    if (document.getElementById('neonLangSwitch')) return;
    var header = document.querySelector('.site-header, #siteHeader, header');
    if (!header) return;
    var target = header.querySelector('.header-actions') || header;
    var wrap = document.createElement('div');
    wrap.id = 'neonLangSwitch';
    wrap.className = 'neon-lang-switch';
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.setAttribute('aria-label', 'Switch language');
    btn.setAttribute('data-no-i18n', '');
    btn.textContent = lang === 'en' ? 'ع' : 'EN';
    btn.title = lang === 'en' ? 'العربية' : 'English';
    btn.addEventListener('click', function () {
      var next = lang === 'en' ? 'ar' : 'en';
      saveLang(next);
      apply(next);
      window.dispatchEvent(new CustomEvent('neon:langchange', { detail: { lang: next } }));
    });
    wrap.appendChild(btn);
    target.insertBefore(wrap, target.firstChild);
    addStyles();
  }

  function addStyles() {
    if (document.getElementById('neonI18nStyles')) return;
    var css = document.createElement('style');
    css.id = 'neonI18nStyles';
    css.textContent =
      '.neon-lang-switch{position:relative;z-index:60;display:inline-flex;align-items:center}' +
      '.neon-lang-switch button{min-width:38px;height:32px;border-radius:999px;border:1px solid rgba(34,211,238,.45);' +
      'background:rgba(8,14,26,.72);color:#67e8f9;font-weight:800;font-size:12px;line-height:1;cursor:pointer;' +
      'box-shadow:0 0 12px rgba(34,211,238,.18);transition:transform .2s ease,box-shadow .2s ease}' +
      '.neon-lang-switch button:hover{transform:translateY(-1px);box-shadow:0 0 18px rgba(34,211,238,.35)}' +
      '[dir="ltr"] .neon-lang-switch{margin-inline-start:auto}';
    document.head.appendChild(css);
  }

  function apply(next) {
    lang = next === 'en' ? 'en' : 'ar';
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
    document.documentElement.setAttribute('data-lang', lang);
    walk(document.body);
    var btn = document.querySelector('#neonLangSwitch button');
    if (btn) {
      btn.textContent = lang === 'en' ? 'ع' : 'EN';
      btn.title = lang === 'en' ? 'العربية' : 'English';
    }
  }

  function observe() {
    if (!window.MutationObserver) return;
    var observer = new MutationObserver(function (mutations) {
      mutations.forEach(function (mutation) {
        if (mutation.addedNodes) {
          Array.prototype.forEach.call(mutation.addedNodes, function (node) {
            if (node.nodeType === 1 || node.nodeType === 3) walk(node);
          });
        }
      });
    });
    observer.observe(document.body, { childList: true, subtree: true, characterData: false });
  }

  window.NeonI18n = {
    getLang: getLang,
    setLang: function (next) { saveLang(next); apply(next); },
    t: function (text) { return lang === 'en' ? (DICT[String(text || '').trim()] || text) : text; }
  };

  function init() {
    lang = getLang();
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'en' ? 'ltr' : 'rtl');
    document.documentElement.setAttribute('data-lang', lang);
    addSwitcher();
    walk(document.body);
    observe();
    window.addEventListener('neon:datachange', function () { walk(document.body); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
