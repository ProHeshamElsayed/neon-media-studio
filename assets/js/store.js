/* ==========================================================================
   NÉON MEDIA — Data Store
   يعمل الموقع بالكامل بدون باك اند: كل البيانات محفوظة في localStorage
   ويمكن مزامنتها اختياريًا مع Firebase Firestore من خلال assets/js/firebase-config.js
   ========================================================================== */
(function () {
  'use strict';

  var STORAGE_KEY = 'neonMediaStudio_v1';
  var DEFAULT_ADMIN_PASSWORD = 'Admin@2026';
  var SCHEMA_VERSION = 1;

  /* ------------------------------------------------------------------------
     البيانات الافتراضية — يمكن تعديل كل شيء من لوحة التحكم
     ------------------------------------------------------------------------ */
  var DEFAULTS = {
    version: SCHEMA_VERSION,
    updatedAt: null,
    campaignsMigrated: false,
    settings: {
      siteName: 'نِيون ميديا',
      brandLatin: 'NEON MEDIA',
      tagline: 'استوديو التسويق الرقمي والإبداع البصري',
      logo: 'assets/img/logo.svg',
      favicon: 'assets/img/logo.svg',
      ownerName: 'م. أحمد نوار',
      ownerTitle: 'مؤسس نِيون ميديا · مدير الإبداع',
      ownerPhoto: 'assets/img/profile.svg',
      heroKicker: 'استوديو إبداعي · تسويق رقمي · محتوى',
      heroTitle1: 'نصنع علامات',
      heroTitleAccent: 'تلمع في النور',
      heroText: 'من أول فكرة لحد آخر انطباع… نبنِي لك حضورًا رقميًا متكاملًا: هوية، محتوى، تصوير، إعلانات، وموقع يجذب عملاءك. كله تحت سقف واحد.',
      heroRoles: ['مدير إبداع', 'خبير تسويق رقمي', 'مصمم جرافيك', 'صانع محتوى', 'مصور منتجات'],
      cvShort: 'أكثر من 8 سنوات في تحويل الأفكار إلى علامات تجارية يتحدث عنها الناس. متخصص في استراتيجيات السوشيال ميديا، الهوية البصرية، والحملات الإعلانية التي تحقق أرقامًا حقيقية.',
      skills: ['الهوية البصرية', 'استراتيجية المحتوى', 'إدارة السوشيال', 'الإعلانات المدفوعة', 'التصوير', 'UI/UX'],
      audiences: ['كافيهات', 'مطاعم', 'محلات أسماك', 'وكالات', 'ورش', 'مكتبات', 'شركات', 'مصانع', 'قاعات أفراح', 'عقارات', 'متاجر إلكترونية', 'مراكز تجميل', 'صيدليات', 'مخابز', 'مراكز تعليمية', 'فنادق', 'متاجر ملابس', 'معارض أثاث'],
      aboutTitle: 'أكثر من مجرد استوديو… شريكك في النمو',
      aboutKicker: 'نبذة عنا',
      aboutText: 'بدأت الحكاية من شغف بالتفاصيل، وإيمان إن أي مشروع صغير يستحق حضورًا كبيرًا. في نِيون ميديا بنحوّ الأفكار إلى هوية بصرية ومحتوى يلامس الناس، مش مجرد تصاميم تُنشر وتُنسى.\n\nنعمل مع الكافيهات والمطاعم والمحلات والشركات والمصانع والقاعات… كل من يريد أن يُرى ويُتذكّر. نجمع بين الاستراتيجية والإبداع والتصوير والإعلانات، ونقيس كل خطوة بأرقام واضحة.\n\nهدفنا بسيط: أن يتحول مشروعك إلى علامة يتحدث عنها عملاؤك، وأن تنمو مبيعاتك بخطة مدروسة لا بالحظ.',
      aboutHighlights: ['فريق متعدد التخصصات', 'تسليم في المواعيد', 'تعديلات حتى الرضا', 'تقارير وأرقام واضحة'],
      mission: 'أن نمنح كل مشروع — مهما كان حجمه — حضورًا بصريًا ورقميًا ينافس الكبار.',
      vision: 'أن نكون الاستوديو العربي الأول الذي يربط الإبداع بالنتائج القابلة للقياس.',
      aboutImage: 'assets/img/about.svg',
      phone: '+201000000000',
      phoneDisplay: '0100 000 0000',
      whatsapp: '201000000000',
      email: 'hello@neonmedia.example',
      address: 'القاهرة، مصر',
      mapUrl: 'https://maps.google.com/?q=Cairo',
      workingHours: 'السبت – الخميس · 10 ص – 8 م',
      socials: {
        instagram: 'https://instagram.com/',
        tiktok: 'https://tiktok.com/',
        facebook: 'https://facebook.com/',
        snapchat: 'https://snapchat.com/',
        youtube: '',
        linkedin: '',
        behance: ''
      },
      stats: [
        { value: 120, suffix: '+', label: 'مشروع منجز' },
        { value: 85, suffix: '+', label: 'عميل سعيد' },
        { value: 8, suffix: '+', label: 'سنوات خبرة' },
        { value: 98, suffix: '%', label: 'نسبة رضا' }
      ],
      quranEnabled: true,
      quranAutoplay: true,
      quranTitle: 'آية الكرسي — الشيخ مشاري العفاسي',
      quranUrl: 'https://everyayah.com/data/Alafasy_128kbps/002255.mp3',
      quranLocalUrl: 'assets/audio/quran.mp3',
      announcement: 'عرض الافتتاح · خصم 15% على باقة إدارة السوشيال ميديا — لفترة محدودة',
      announcementLink: '#packages',
      announcementEnabled: true,
      currency: 'ج.م',
      accent: 'cyan',
      defaultTheme: 'dark',
      seoTitle: 'نِيون ميديا | تسويق رقمي · سوشيال ميديا · تصوير · تصميم',
      seoDescription: 'استوديو نِيون ميديا: تصميم جرافيك، إدارة سوشيال ميديا، تصوير منتجات وعقارات، تصميم مواقع ومنيوهات تفاعلية، تسويق إلكتروني وعقاري، دعوات إلكترونية ومطبوعات. اطلب خدمتك الآن.',
      paymentNote: 'الدفع الإلكتروني متاح عبر إنستاباي، فودافون كاش، التحويل البنكي، PayPal أو رابط دفع آمن. الطلب يُأكد عبر واتساب قبل البدء.',
      onlinePaymentEnabled: true,
      ordersEnabled: true,
      showAdminLink: true,
      heroBadge: 'متاح لمشاريع جديدة',
      footerNote: 'نصنع أفكارًا تُرى، ونتائج تُقاس.',
      aboutBadge: 'شغف + استراتيجية',
      aboutYears: '8+',
      audienceTitle: 'لمن نُصمّم الحضور؟',
      audienceText: 'نخدم كل مشروع يستحق أن يُرى ويُتذكّر — من الكافيه الصغير للشركة الكبيرة.',
      servicesKicker: 'خدماتنا',
      servicesTitle: 'كل ما تحتاجه علامتك',
      servicesTitleAccent: 'تحت سقف واحد',
      servicesText: 'من الهوية والتصميم للتصوير والإعلانات والمواقع… اختر الخدمة اللي تناسب مرحلتك، وإحنا نكمل الباقي.',
      packagesKicker: 'باقات شهرية',
      packagesTitle: 'باقات مصممة',
      packagesTitleAccent: 'لتنمو معك',
      packagesText: 'إدارة سوشيال ميديا متكاملة بأسعار واضحة. تقدر تبدأ بباقة وتطورها في أي وقت حسب احتياج مشروعك.',
      worksKicker: 'أعمالنا',
      worksTitle: 'مشاريع',
      worksTitleAccent: 'تتكلم عن نفسها',
      worksText: 'مختارات من الهويات والتصاميم والتصوير والحملات اللي صنعناها لعلامات في مجالات مختلفة.',
      processKicker: 'طريقة العمل',
      processTitle: 'من الفكرة',
      processTitleAccent: 'للتسليم',
      processText: 'خطوات واضحة وشفافة، وانت على اطلاع بكل مرحلة.',
      clientsKicker: 'عملاؤنا',
      clientsTitle: 'ثقة تُبنى',
      clientsTitleAccent: 'بالنتائج',
      clientsText: 'أكثر من 85 عميلًا في مصر والخليج اختاروا نِيون ميديا ليكونوا جزءًا من حكايتهم.',
      paymentKicker: 'الدفع الإلكتروني',
      paymentTitle: 'ادفع',
      paymentTitleAccent: 'بالطريقة اللي تريحك',
      paymentText: 'طرق دفع متعددة وآمنة. اختر الطريقة المناسبة، وأكد طلبك على واتساب قبل بدء التنفيذ.',
      faqKicker: 'أسئلة شائعة',
      faqTitle: 'إجابات',
      faqTitleAccent: 'لأهم أسئلتك',
      faqText: 'وإذا كان سؤالك مش هنا، ابعتلنا على واتساب وهنجاوبك فورًا.',
      contactKicker: 'الاتصال والمساعدة',
      contactTitle: 'خلّينا نبدأ',
      contactTitleAccent: 'مشروعك',
      contactText: 'ابعتلنا تفاصيل مشروعك، أو كلمنا مباشرة على واتساب. عادة نرد خلال ساعات العمل.',
      contactPageKicker: 'نحن هنا من أجلك',
      contactPageTitle: 'خلّينا نبدأ',
      contactPageTitleAccent: 'مشروعك',
      contactPageText: 'سؤال، فكرة، أو طلب عرض سعر؟ تواصل معنا بالطريقة اللي تناسبك. فريق نِيون ميديا جاهز لمساعدتك.',
      contactChannelsTitle: 'قنوات التواصل المباشر',
      contactHoursTitle: 'ساعات العمل',
      contactFormTitle: 'أرسل لنا تفاصيل مشروعك',
      quickFaqTitle: 'أسئلة',
      quickFaqTitleAccent: 'سريعة',
      promoEnabled: false,
      promoKicker: 'عرض خاص',
      promoTitle: 'خصم 20% على باقة إدارة السوشيال ميديا',
      promoText: 'لفترة محدودة — احجز باقتك الآن واستفد من العرض.',
      promoCode: 'NEON20',
      promoCta: 'احجز العرض',
      promoLink: '#packages',
      promoImage: '',
      promoStart: '',
      promoEnd: '',
      promoDismissible: true,
      welcomePopupEnabled: false,
      welcomePopupTitle: 'أهلًا بك في نِيون ميديا',
      welcomePopupText: 'استوديو متكامل للتسويق الرقمي والتصميم والتصوير. خلّينا نصنع لعلامتك حضورًا يليق بها.',
      welcomePopupImage: '',
      welcomePopupCta: 'ابدأ مشروعك',
      welcomePopupLink: '#contact',
      welcomePopupDelay: 2,
      welcomePopupFrequency: 'once',
      notificationsEnabled: true,
      loyaltyEnabled: true,
      loyaltyPointsPerCurrency: 0.1,
      loyaltyPointValue: 1,
      loyaltyMinRedeem: 100,
      loyaltyWelcomePoints: 0,
      loyaltyLabel: 'نقاط نيون',
      adminPasswordHash: ''
    },
    services: [
      {
        id: 'srv-graphic',
        title: 'تصميم الجرافيك',
        category: 'تصميم',
        icon: 'palette',
        short: 'شعارات وهويات بصرية وتصاميم إعلانية بروح عصرية تليق بعلامتك.',
        description: 'نبني لك هوية بصرية متكاملة تبدأ من الشعار وتصل لكل نقطة يراها عميلك. دراسة للسوق والمنافسين، اختيار ألوان وخطوط مدروسة، وتطبيقات كاملة على السوشيال والمطبوعات.',
        price: 1200,
        priceNote: 'يبدأ من',
        unit: '',
        duration: '3 – 7 أيام',
        features: ['شعار احترافي (3 مقترحات)', 'نظام ألوان وخطوط', 'تطبيقات الهوية', 'ملفات جاهزة للطباعة'],
        badge: 'الأكثر طلبًا',
        active: true,
        featured: true,
        order: 1,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:00:00.000Z'
      },
      {
        id: 'srv-social-design',
        title: 'تصميمات السوشيال ميديا',
        category: 'سوشيال ميديا',
        icon: 'instagram',
        short: 'تصاميم شهرية متنوعة، موحدة الهوية، تجذب التوقف والتفاعل.',
        description: 'باقة تصاميم شهرية لمنصاتك: بوستات، ستوريز، أغلفة هايلايت، وقوالب متحركة. كل تصميم يخدم رسالة واضحة ويبني صورة احترافية لعلامتك.',
        price: 900,
        priceNote: 'يبدأ من',
        unit: '/ شهر',
        duration: 'تسليم أسبوعي',
        features: ['12 تصميم شهريًا', 'تصميم ستوري وهايلايت', 'كتابة نصوص بسيطة', 'تعديلات مرنة'],
        badge: '',
        active: true,
        featured: true,
        order: 2,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:01:00.000Z'
      },
      {
        id: 'srv-product-photo',
        title: 'تصوير المنتجات',
        category: 'تصوير',
        icon: 'camera',
        short: 'صور منتجات بإضاءة احترافية وتفاصيل تبيع، جاهزة للمتاجر والإعلانات.',
        description: 'جلسة تصوير احترافية لمنتجاتك بخلفيات وأضاءة مدروسة، مع معالجة لونية دقيقة. مناسبة للمتاجر الإلكترونية، المطاعم، مستحضرات التجميل والمشروبات.',
        price: 750,
        priceNote: 'يبدأ من',
        unit: '',
        duration: '2 – 4 أيام',
        features: ['10 صور نهائية', 'معالجة لونية احترافية', 'خلفيات متعددة', 'مقاسات جاهزة للسوشيال'],
        badge: '',
        active: true,
        featured: false,
        order: 3,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:02:00.000Z'
      },
      {
        id: 'srv-web-menu',
        title: 'إنشاء منيو تفاعلي على الويب',
        category: 'ويب',
        icon: 'menu',
        short: 'قائمة طعام إلكترونية أنيقة تعمل بكود QR وتُحدَّث في لحظات.',
        description: 'منيو رقمي سريع ومتجاوب مع الموبايل، بعرض شهي للأطباق والأسعار. يمكن تحديث الأصناف بنفسك، وربطه بواتساب للطلبات، وإضافة QR كود جاهز للطباعة.',
        price: 1800,
        priceNote: 'يبدأ من',
        unit: '',
        duration: '4 – 6 أيام',
        features: ['منيو متجاوب وسريع', 'QR كود جاهز للطباعة', 'تحديث الأصناف بسهولة', 'ربط الطلبات بواتساب'],
        badge: 'جديد',
        active: true,
        featured: true,
        order: 4,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:03:00.000Z'
      },
      {
        id: 'srv-barcode',
        title: 'صناعة الباركود لكل احتياجاتك',
        category: 'أخرى',
        icon: 'barcode',
        short: 'باركود وQR احترافي للمنتجات، الفواتير، المنيو والبطاقات.',
        description: 'نصمم وننشئ باركود وQR كود بأعلى دقة للطباعة، مع إمكانية إضافة شعارك وألوانك. مناسب للمنتجات، المخزون، الفواتير، المنيو، والدعوات.',
        price: 250,
        priceNote: 'يبدأ من',
        unit: '',
        duration: '24 – 48 ساعة',
        features: ['باركود أو QR مخصص', 'دقة طباعة عالية', 'تصميم بهوية علامتك', 'ملفات PNG / SVG / PDF'],
        badge: '',
        active: true,
        featured: false,
        order: 5,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:04:00.000Z'
      },
      {
        id: 'srv-google-maps',
        title: 'متابعة وردود جوجل ماب',
        category: 'تسويق',
        icon: 'map',
        short: 'إدارة تقييماتك على خرائط جوجل وردود احترافية تحمي سمعتك.',
        description: 'نراقب تقييمات عملائك على Google Maps ونرد عليها بأسلوب احترافي، نطلب التقييمات الإيجابية، ونتعامل مع الملاحظات بطريقة تبني الثقة وتُحسّن ظهورك محليًا.',
        price: 600,
        priceNote: 'يبدأ من',
        unit: '/ شهر',
        duration: 'خدمة شهرية',
        features: ['ردود احترافية على التقييمات', 'تحسين ظهور النشاط', 'تقارير شهرية', 'إدارة الأزمات والملاحظات'],
        badge: '',
        active: true,
        featured: false,
        order: 6,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:05:00.000Z'
      },
      {
        id: 'srv-content',
        title: 'صناعة المحتوى والأفكار',
        category: 'سوشيال ميديا',
        icon: 'content',
        short: 'أفكار وسكريبتات ومحتوى يبني علاقة حقيقية مع جمهورك.',
        description: 'نضع خطة محتوى شهرية مبنية على أهدافك وجمهورك: أفكار بوستات، ريلز، نصوص إعلانية، وسكريبتات فيديو بلغة علامتك. المحتوى الذي يجعل الناس تتوقف وتتفاعل وتشتري.',
        price: 1000,
        priceNote: 'يبدأ من',
        unit: '/ شهر',
        duration: 'تسليم شهري',
        features: ['خطة محتوى شهرية', '15 فكرة وسكريبت', 'نصوص إعلانية', 'هاشتاجات ووصف'],
        badge: '',
        active: true,
        featured: false,
        order: 7,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:06:00.000Z'
      },
      {
        id: 'srv-social-management',
        title: 'إدارة مواقع السوشيال ميديا',
        category: 'سوشيال ميديا',
        icon: 'social',
        short: 'إدارة كاملة لإنستجرام، تيك توك وسناب شات من التخطيط للنشر والتفاعل.',
        description: 'فريق متكامل يدير حضورك الرقمي: خطة محتوى، تصميم، مونتاج، جدولة نشر، ردود على الرسائل، ومتابعة الأداء. أنت تركز في مشروعك، ونحن نصنع الضجة.',
        price: 2500,
        priceNote: 'يبدأ من',
        unit: '/ شهر',
        duration: 'باقة شهرية',
        features: ['إدارة منصتين أو أكثر', 'محتوى وتصاميم شهرية', 'جدولة ونشر وردود', 'تقرير أداء شهري'],
        badge: 'الأكثر قيمة',
        active: true,
        featured: true,
        order: 8,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:07:00.000Z'
      },
      {
        id: 'srv-digital-marketing',
        title: 'التسويق الإلكتروني',
        category: 'تسويق',
        icon: 'ads',
        short: 'حملات مدفوعة مدروسة تجلب لك عملاء حقيقيين بأقل تكلفة.',
        description: 'استراتيجية تسويق متكاملة: تحديد الجمهور، بناء الحملات على فيسبوك وإنستجرام وجوجل وتيك توك، اختبار الإعلانات، تحسين التكلفة، وتقارير شفافة بالنتائج.',
        price: 2000,
        priceNote: 'يبدأ من',
        unit: '/ شهر',
        duration: 'خدمة شهرية',
        features: ['إعداد الحملات والإعلانات', 'استهداف دقيق', 'A/B Testing', 'تقارير أسبوعية'],
        badge: '',
        active: true,
        featured: true,
        order: 9,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:08:00.000Z'
      },
      {
        id: 'srv-realestate-marketing',
        title: 'التسويق العقاري',
        category: 'تسويق',
        icon: 'building',
        short: 'خطط تسويقية للمشروعات العقارية تجذب مستثمرين ومشترين جادين.',
        description: 'نسوّق وحداتك ومشروعاتك العقارية بمنظومة متكاملة: هوية إعلانية، محتوى بصري، جولات مرئية، وحملات مستهدفة لمشتري العقار. مع متابعة العملاء المحتملين حتى المعاينة.',
        price: 3000,
        priceNote: 'يبدأ من',
        unit: '/ شهر',
        duration: 'باقة شهرية',
        features: ['استراتيجية تسويق عقاري', 'محتوى وجولات بصرية', 'حملات لجمهور مستهدف', 'إدارة العملاء المحتملين'],
        badge: '',
        active: true,
        featured: false,
        order: 10,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:09:00.000Z'
      },
      {
        id: 'srv-realestate-photo',
        title: 'التصوير العقاري',
        category: 'تصوير',
        icon: 'camera-home',
        short: 'تصوير احترافي للوحدات والمشروعات العقارية يبرز المساحات والتفاصيل.',
        description: 'جولة تصوير داخلية وخارجية للوحدات والعقارات، بإضاءة وتكوين احترافي. صور وفيديوهات تصلح للإعلانات، المنصات العقارية، والجولات الافتراضية.',
        price: 1500,
        priceNote: 'يبدأ من',
        unit: '',
        duration: '2 – 5 أيام',
        features: ['تصوير داخلي وخارجي', 'معالجة احترافية للصور', 'فيديو جولة قصير', 'مقاسات لكل المنصات'],
        badge: '',
        active: true,
        featured: false,
        order: 11,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:10:00.000Z'
      },
      {
        id: 'srv-food-photo',
        title: 'تصوير الكافيهات والمطاعم',
        category: 'تصوير',
        icon: 'food',
        short: 'صور أطباق ومشروبات تفتح الشهية وتملأ تعليقات عملائك.',
        description: 'جلسة تصوير داخل المكان أو للأطباق والمشروبات بإضاءة سينمائية. نصنع صورًا ومقاطع قصيرة تصلح للمنيو والإعلانات والسوشيال، وتجعل الناس تحجز طاولة.',
        price: 1200,
        priceNote: 'يبدأ من',
        unit: '',
        duration: '2 – 4 أيام',
        features: ['تصوير أطباق ومشروبات', 'تصوير المكان', 'ريلز قصيرة', 'معالجة لونية سينمائية'],
        badge: 'مميز',
        active: true,
        featured: true,
        order: 12,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:11:00.000Z'
      },
      {
        id: 'srv-einvoice',
        title: 'إنشاء وتصميم فاتورة إلكترونية',
        category: 'ويب',
        icon: 'invoice',
        short: 'فواتير احترافية بهوية علامتك، جاهزة للإرسال والطباعة.',
        description: 'نصمم قالب فاتورة إلكترونية أنيق يعكس هوية نشاطك، مع حقول واضحة للضرائب والخصومات. يُسلَّم كملف PDF قابل للتعديل أو صفحة ويب لإصدار الفواتير.',
        price: 700,
        priceNote: 'يبدأ من',
        unit: '',
        duration: '2 – 4 أيام',
        features: ['تصميم بهوية العلامة', 'حقول ضريبة وخصم', 'نسخة PDF قابلة للتعديل', 'نسخة ويب اختيارية'],
        badge: '',
        active: true,
        featured: false,
        order: 13,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:12:00.000Z'
      },
      {
        id: 'srv-wedding',
        title: 'دعوات الزفاف الإلكترونية',
        category: 'ويب',
        icon: 'invitation',
        short: 'دعوة زفاف تفاعلية أنيقة برابط خاص، خريطة، وعدّ تنازلي.',
        description: 'دعوة إلكترونية تُرسل برابط واحد: أسماء العروسين، الموعد بعدّاد تنازلي، الموقع على الخريطة، تأكيد الحضور، وموسيقى خفيفة. ذكرى تليق بيومكم.',
        price: 500,
        priceNote: 'يبدأ من',
        unit: '',
        duration: '2 – 3 أيام',
        features: ['تصميم مخصص', 'رابط مشاركة أنيق', 'خريطة وعدّ تنازلي', 'تأكيد الحضور'],
        badge: '',
        active: true,
        featured: false,
        order: 14,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:13:00.000Z'
      },
      {
        id: 'srv-advertising',
        title: 'خدمات الدعاية والإعلان',
        category: 'تسويق',
        icon: 'megaphone',
        short: 'حملات دعائية متكاملة من الفكرة للتنفيذ، أونلاين وأوفلاين.',
        description: 'نخطط وننفذ حملات دعاية وإعلان متكاملة: رسالة إعلانية، سيناريو، تصميم، إنتاج، واختيار القنوات المناسبة. حملة تترك أثرًا لا مجرد إعلان يمر.',
        price: 1000,
        priceNote: 'يبدأ من',
        unit: '',
        duration: 'حسب الحملة',
        features: ['فكرة وسيناريو إعلاني', 'تصميم وتنفيذ', 'إدارة الحملة', 'قياس النتائج'],
        badge: '',
        active: true,
        featured: false,
        order: 15,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:14:00.000Z'
      },
      {
        id: 'srv-print',
        title: 'تصميم المطبوعات',
        category: 'مطبوعات',
        icon: 'print',
        short: 'بنرات، استيكرات، فلكس، أكواب، كروت شخصية وكل مطبوعاتك.',
        description: 'تصميم جميع المطبوعات الدعائية بهوية علامتك: بنرات، استيكر، فلكس، أوراق رسمية، أختام، مجات، كروت شخصية، أكياس وعلب. ملفات جاهزة للمطبعة بدقة عالية.',
        price: 600,
        priceNote: 'يبدأ من',
        unit: '',
        duration: '2 – 5 أيام',
        features: ['تصميم بأي مقاس', 'ملفات طباعة CMYK', 'معاينة قبل التنفيذ', 'تنسيق مع المطبعة'],
        badge: '',
        active: true,
        featured: false,
        order: 16,
        image: '',
        paymentLink: '',
        createdAt: '2026-01-01T10:15:00.000Z'
      }
    ],
    works: [
      {
        id: 'work-brand',
        title: 'هوية بصرية — كافيه نون',
        category: 'هوية بصرية',
        image: 'assets/img/works/work-brand.svg',
        description: 'هوية متكاملة لكافيه نون: شعار، ألوان، تغليف، وقائمة طعام بروح دافئة وعصرية.',
        client: 'كافيه نون',
        year: '2026',
        tags: ['شعار', 'هوية', 'تغليف'],
        featured: true,
        active: true
      },
      {
        id: 'work-social',
        title: 'حملة محتوى — سوشيال ميديا',
        category: 'سوشيال ميديا',
        image: 'assets/img/works/work-social.svg',
        description: 'باقة تصميم ومحتوى شهرية رفعت التفاعل 320% خلال 60 يومًا.',
        client: 'مطعم بحر',
        year: '2026',
        tags: ['تصميم', 'محتوى', 'ريلز'],
        featured: true,
        active: true
      },
      {
        id: 'work-product',
        title: 'تصوير منتجات — NOOR',
        category: 'تصوير',
        image: 'assets/img/works/work-product.svg',
        description: 'جلسة تصوير عطر فاخر بإضاءة ملونة ومعالجة دقيقة للتفاصيل.',
        client: 'NOOR Parfum',
        year: '2025',
        tags: ['تصوير', 'منتج', 'إعلان'],
        featured: true,
        active: true
      },
      {
        id: 'work-menu',
        title: 'منيو تفاعلي — قائمة طعام رقمية',
        category: 'ويب',
        image: 'assets/img/works/work-menu.svg',
        description: 'منيو ويب سريع بكود QR، قابل للتحديث وربط الطلبات بواتساب.',
        client: 'مطعم الأصيل',
        year: '2026',
        tags: ['QR', 'منيو', 'ويب'],
        featured: true,
        active: true
      },
      {
        id: 'work-ads',
        title: 'حملة إعلانية — نمو 64%',
        category: 'تسويق',
        image: 'assets/img/works/work-ads.svg',
        description: 'حملة إعلانات مدفوعة متعددة القنوات حققت نموًا في التحويلات بنسبة 64%.',
        client: 'مكتبة المعرفة',
        year: '2025',
        tags: ['إعلانات', 'تحليل', 'نمو'],
        featured: true,
        active: true
      },
      {
        id: 'work-realestate',
        title: 'تسويق عقاري — Residence',
        category: 'تسويق',
        image: 'assets/img/works/work-realestate.svg',
        description: 'منظومة تسويق بصري لمشروع سكني فاخر: هوية، تصوير، وحملات مستهدفة.',
        client: 'الإعمار للتطوير',
        year: '2026',
        tags: ['عقار', 'تصوير', 'حملة'],
        featured: true,
        active: true
      },
      {
        id: 'work-wedding',
        title: 'دعوة زفاف إلكترونية',
        category: 'ويب',
        image: 'assets/img/works/work-wedding.svg',
        description: 'دعوة رقمية أنيقة بتصميم مخصص، عدّ تنازلي وخريطة تفاعلية.',
        client: 'أحمد & سارة',
        year: '2025',
        tags: ['دعوة', 'تصميم', 'تفاعلي'],
        featured: true,
        active: true
      },
      {
        id: 'work-print',
        title: 'مطبوعات — كروت وتغليف',
        category: 'مطبوعات',
        image: 'assets/img/works/work-print.svg',
        description: 'حزمة مطبوعات متكاملة: كروت شخصية، استيكرات، مجات وملفات طباعة.',
        client: 'نِيون ميديا',
        year: '2026',
        tags: ['كروت', 'استيكر', 'طباعة'],
        featured: true,
        active: true
      }
    ],
    testimonials: [
      {
        id: 'test-1',
        name: 'كريم الشريف',
        role: 'صاحب كافيه نون',
        company: 'كافيه نون',
        text: 'أول مرة أشوف كافيه بتاعنا بالشكل ده. التصوير والمحتوى غيّروا نظرة الناس للمكان، والحجوزات زادت بشكل ملحوظ خلال أول شهر.',
        rating: 5,
        avatar: '',
        featured: true,
        active: true
      },
      {
        id: 'test-2',
        name: 'منى عبد الرحمن',
        role: 'مديرة تسويق',
        company: 'مطعم بحر',
        text: 'فريق يفهم بسرعة، ويسلّم قبل الميعاد. الريلز اللي اتعملت وصلت لأرقام ماكناش متوقعينها، وردود العملاء على الأكل بقت أحلى.',
        rating: 5,
        avatar: '',
        featured: true,
        active: true
      },
      {
        id: 'test-3',
        name: 'أحمد جمال',
        role: 'مدير مبيعات',
        company: 'الإعمار للتطوير',
        text: 'التسويق العقاري محتاج لغة مختلفة، وده اللي لقيته عند نِيون. العملاء اللي وصلونا كانوا جادين فعلًا، مش مجرد أرقام على الورق.',
        rating: 5,
        avatar: '',
        featured: true,
        active: true
      },
      {
        id: 'test-4',
        name: 'سارة فؤاد',
        role: 'صاحبة مكتبة',
        company: 'مكتبة المعرفة',
        text: 'كنت فاكرة إن المكتبات مش محتاجة سوشيال ميديا. بعد شهرين من الإدارة والمحتوى، بقى عندنا عملاء بيجوا من الإنترنت كل يوم.',
        rating: 5,
        avatar: '',
        featured: true,
        active: true
      },
      {
        id: 'test-5',
        name: 'محمود عادل',
        role: 'مدير مصنع',
        company: 'مصنع الأصيل',
        text: 'صمموا لنا كتالوج، فواتير، وهوية كاملة للمصنع. الشغل منظم جدًا والملفات كانت جاهزة للمطبعة من أول مرة.',
        rating: 5,
        avatar: '',
        featured: true,
        active: true
      },
      {
        id: 'test-6',
        name: 'نور حسن',
        role: 'صاحبة قاعة',
        company: 'قاعة النور',
        text: 'الدعوات الإلكترونية كانت لمسة جميلة جدًا، والعملاء بيقولولنا إنها أسهل وأجمل من الدعوات الورقية. شكرًا لكل التفاصيل.',
        rating: 5,
        avatar: '',
        featured: true,
        active: true
      }
    ],
    clients: [
      { id: 'client-1', name: 'كافيه نون', logo: '', url: '', order: 1, active: true },
      { id: 'client-2', name: 'مطعم بحر', logo: '', url: '', order: 2, active: true },
      { id: 'client-3', name: 'الإعمار للتطوير', logo: '', url: '', order: 3, active: true },
      { id: 'client-4', name: 'مكتبة المعرفة', logo: '', url: '', order: 4, active: true },
      { id: 'client-5', name: 'قاعة النور', logo: '', url: '', order: 5, active: true },
      { id: 'client-6', name: 'NOOR Parfum', logo: '', url: '', order: 6, active: true }
    ],
    packages: [
      {
        id: 'pkg-start',
        name: 'باقة البداية',
        subtitle: 'للمشاريع الصغيرة اللي عايزة تبدأ صح',
        price: 1999,
        period: '/ شهر',
        badge: '',
        highlighted: false,
        features: [
          '12 تصميم سوشيال ميديا',
          'إدارة منصة واحدة',
          'كتابة محتوى البوستات',
          'ردود على التعليقات والرسائل',
          'تقرير شهري مبسط'
        ],
        active: true,
        order: 1
      },
      {
        id: 'pkg-growth',
        name: 'باقة النمو',
        subtitle: 'الأكثر اختيارًا للكافيهات والمطاعم',
        price: 3499,
        period: '/ شهر',
        badge: 'الأكثر طلبًا',
        highlighted: true,
        features: [
          '20 تصميم سوشيال ميديا',
          'إدارة منصتين',
          '4 ريلز قصيرة شهريًا',
          'محتوى وكتابة إعلانية',
          'إدارة Google Maps',
          'تقرير أداء شهري'
        ],
        active: true,
        order: 2
      },
      {
        id: 'pkg-dominate',
        name: 'باقة السيطرة',
        subtitle: 'لعلامة عايزة تتصدر مشهدها',
        price: 5999,
        period: '/ شهر',
        badge: '',
        highlighted: false,
        features: [
          '30 تصميم سوشيال ميديا',
          'إدارة 3 منصات',
          '8 ريلز قصيرة شهريًا',
          'جلسة تصوير شهرية',
          'إدارة حملات مدفوعة',
          'استراتيجية ومتابعة أسبوعية'
        ],
        active: true,
        order: 3
      }
    ],
    payments: [
      {
        id: 'pay-instapay',
        name: 'إنستاباي',
        type: 'instapay',
        value: 'neonmedia@instapay',
        link: '',
        instructions: 'افتح تطبيق إنستاباي وحوّل المبلغ على العنوان الموضح، ثم أرسل صورة التحويل على واتساب.',
        active: true
      },
      {
        id: 'pay-vodafone',
        name: 'فودافون كاش',
        type: 'wallet',
        value: '0100 000 0000',
        link: '',
        instructions: 'حوّل على رقم المحفظة، ثم أرسل رقم عملية التحويل على واتساب لتأكيد الطلب.',
        active: true
      },
      {
        id: 'pay-bank',
        name: 'تحويل بنكي',
        type: 'bank',
        value: 'البنك الأهلي المصري — نِيون ميديا',
        link: '',
        instructions: 'اسم الحساب: نِيون ميديا · رقم الحساب: 000000000000000 · IBAN: EG000000000000000000000000',
        active: true
      },
      {
        id: 'pay-paypal',
        name: 'PayPal',
        type: 'paypal',
        value: 'paypal.me/neonmedia',
        link: 'https://paypal.me/neonmedia',
        instructions: 'ادفع بالدولار عبر رابط PayPal الآمن، ثم أرسل رقم العملية على واتساب.',
        active: true
      },
      {
        id: 'pay-link',
        name: 'رابط دفع آمن',
        type: 'card',
        value: 'ادفع بالفيزا أو ماستركارد عبر رابط Stripe',
        link: '',
        instructions: 'أضف رابط الدفع الخاص بك من لوحة التحكم (Stripe Payment Link أو أي بوابة تدعم الروابط الثابتة).',
        active: false
      }
    ],
    faqs: [
      {
        id: 'faq-1',
        question: 'كيف أبدأ العمل معكم؟',
        answer: 'اضغط على «اطلب الآن» في أي خدمة أو باقة، اختار الخدمة وطريقة الدفع، وسيتم فتح واتساب برسالة جاهزة بتفاصيل طلبك. نرد عليك خلال ساعات العمل ونحدد موعد بدء التنفيذ.',
        active: true
      },
      {
        id: 'faq-2',
        question: 'كم تستغرق مدة تنفيذ المشروع؟',
        answer: 'كل خدمة لها مدة تقريبية موضحة في تفاصيلها. التصاميم البسيطة تبدأ من 24–48 ساعة، والهوية الكاملة من 3–7 أيام، أما إدارة السوشيال فهي خدمة شهرية مستمرة.',
        active: true
      },
      {
        id: 'faq-3',
        question: 'هل الأسعار قابلة للتخصيص؟',
        answer: 'بالتأكيد. الأسعار المعروضة هي نقطة بداية، ونضع لك عرضًا مخصصًا حسب حجم المشروع وعدد التصاميم ومدة التعاون. تواصل معنا للحصول على عرض دقيق.',
        active: true
      },
      {
        id: 'faq-4',
        question: 'هل تعملون مع عملاء خارج القاهرة أو خارج مصر؟',
        answer: 'نعم، نعمل أونلاين مع كل المحافظات والدول العربية. التصوير والجلسات الميدانية تحتاج تنسيقًا مسبقًا حسب الموقع.',
        active: true
      },
      {
        id: 'faq-5',
        question: 'كيف يتم الدفع؟',
        answer: 'ندعم إنستاباي، فودافون كاش، التحويل البنكي، PayPal، وروابط الدفع الآمنة. عادة يتم دفع 50% مقدمًا و50% عند التسليم، أو حسب اتفاق المشروع.',
        active: true
      },
      {
        id: 'faq-6',
        question: 'هل أملك ملفات التصميم بعد التسليم؟',
        answer: 'نعم، تحصل على الملفات النهائية وجميع الملفات المصدرية المتفق عليها بعد اكتمال الدفع، مع حق استخدام كامل لعلامتك التجارية.',
        active: true
      }
    ],
    orders: [],
    messages: [],
    customers: [],
    banners: [],
    popups: [],
    campaignStats: {},
    notifications: [
      {
        id: 'notif-welcome',
        title: 'أهلًا بك في نِيون ميديا 👋',
        message: 'استكشف خدماتنا وباقاتنا، واطلب خدمتك مباشرة عبر واتساب. فريقنا جاهز لمساعدتك.',
        type: 'info',
        link: '#services',
        active: true,
        pinned: true,
        startAt: '',
        endAt: '',
        createdAt: '2026-01-01T00:00:00.000Z'
      }
    ],
    templates: [
      {
        id: 'tpl-welcome',
        title: 'ترحيب بعميل جديد',
        text: 'أهلًا {name} 👋\nمعك {brand}. سعدنا بتواصلك معنا. كيف يمكننا مساعدتك في مشروعك؟',
        active: true
      },
      {
        id: 'tpl-followup',
        title: 'متابعة بعد الطلب',
        text: 'أهلًا {name} 👋\nحبيت أطمن على تجربتك مع {brand}. لو فيه أي ملاحظة أو طلب جديد، أنا موجود.',
        active: true
      },
      {
        id: 'tpl-offer',
        title: 'عرض أو مناسبة',
        text: 'أهلًا {name} 👋\nعندنا عرض خاص في {brand} لفترة محدودة. تحب أبعثلك التفاصيل؟',
        active: true
      }
    ]
  };

  /* ------------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------------ */
  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function isPlainObject(value) {
    return value && typeof value === 'object' && !Array.isArray(value);
  }

  function deepMerge(base, patch) {
    if (!isPlainObject(patch)) return base;
    Object.keys(patch).forEach(function (key) {
      var value = patch[key];
      if (Array.isArray(value)) {
        base[key] = clone(value);
      } else if (isPlainObject(value)) {
        base[key] = deepMerge(isPlainObject(base[key]) ? base[key] : {}, value);
      } else if (value !== undefined) {
        base[key] = value;
      }
    });
    return base;
  }

  function ensureCampaigns(target) {
    if (!target || typeof target !== 'object') return target;
    if (!Array.isArray(target.banners)) target.banners = [];
    if (!Array.isArray(target.popups)) target.popups = [];
    if (!target.campaignStats || typeof target.campaignStats !== 'object' || Array.isArray(target.campaignStats)) {
      target.campaignStats = {};
    }
    if (target.campaignsMigrated) return target;

    var s = target.settings || {};
    var hasBanner = target.banners.some(function (item) { return item && item.id === 'bnr-legacy'; });
    if (!hasBanner) {
      target.banners.push({
        id: 'bnr-legacy',
        title: s.promoTitle || 'عرض خاص',
        kicker: s.promoKicker || '',
        text: s.promoText || '',
        code: s.promoCode || '',
        cta: s.promoCta || '',
        link: s.promoLink || '',
        image: s.promoImage || '',
        startAt: s.promoStart || '',
        endAt: s.promoEnd || '',
        priority: 0,
        pages: 'all',
        devices: 'all',
        dismissible: s.promoDismissible !== false,
        active: s.promoEnabled === true,
        createdAt: '2026-01-01T00:00:00.000Z'
      });
    }

    var hasPopup = target.popups.some(function (item) { return item && item.id === 'pop-legacy'; });
    if (!hasPopup) {
      target.popups.push({
        id: 'pop-legacy',
        title: s.welcomePopupTitle || 'أهلًا بك',
        text: s.welcomePopupText || '',
        cta: s.welcomePopupCta || '',
        link: s.welcomePopupLink || '',
        image: s.welcomePopupImage || '',
        trigger: 'delay',
        delay: Number(s.welcomePopupDelay) || 0,
        scrollDepth: 50,
        frequency: s.welcomePopupFrequency || 'once',
        pages: 'all',
        devices: 'all',
        active: s.welcomePopupEnabled === true,
        createdAt: '2026-01-01T00:00:00.000Z'
      });
    }

    target.campaignsMigrated = true;
    return target;
  }

  function mergeCampaignStats(target, source) {
    if (!target || !source || typeof source !== 'object') return target;
    if (!target.campaignStats || typeof target.campaignStats !== 'object' || Array.isArray(target.campaignStats)) {
      target.campaignStats = {};
    }
    Object.keys(source).forEach(function (id) {
      var local = source[id];
      if (!local || typeof local !== 'object') return;
      var remote = target.campaignStats[id] || {};
      var merged = {
        impressions: Math.max(Number(remote.impressions) || 0, Number(local.impressions) || 0),
        clicks: Math.max(Number(remote.clicks) || 0, Number(local.clicks) || 0),
        dismissals: Math.max(Number(remote.dismissals) || 0, Number(local.dismissals) || 0)
      };
      var remoteAt = remote.lastAt ? new Date(remote.lastAt).getTime() : 0;
      var localAt = local.lastAt ? new Date(local.lastAt).getTime() : 0;
      if (remoteAt || localAt) merged.lastAt = new Date(Math.max(remoteAt, localAt)).toISOString();
      target.campaignStats[id] = merged;
    });
    return target;
  }

  function mergeWithDefaults(incoming) {
    var merged = deepMerge(clone(DEFAULTS), incoming && typeof incoming === 'object' ? incoming : {});
    return ensureCampaigns(merged);
  }

  function loadLocal() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw && window.NEON_SEED_DATA && typeof window.NEON_SEED_DATA === 'object') {
        // بيانات أولية مدمجة مع الموقع (نسخة معتمدة) — تُستخدم فقط عند عدم وجود بيانات محفوظة
        raw = JSON.stringify(window.NEON_SEED_DATA);
      }
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return null;
      return parsed;
    } catch (error) {
      console.warn('[NeonStore] تعذر قراءة البيانات المحلية', error);
      return null;
    }
  }

  function persistLocal(showErrors) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      console.error('[NeonStore] مساحة التخزين ممتلئة', error);
      if (showErrors !== false && window.NeonUI && window.NeonUI.toast) {
        window.NeonUI.toast('مساحة التخزين ممتلئة. استخدم روابط صور بدل رفع صور كثيرة، أو فعّل Firebase Storage.', 'error', 7000);
      }
      return false;
    }
  }

  function uid(prefix) {
    var random = Math.random().toString(36).slice(2, 8);
    return (prefix || 'id') + '-' + Date.now().toString(36) + '-' + random;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function hashPassword(password) {
    var str = 'neon::media::' + String(password || '');
    var h1 = 0xdeadbeef;
    var h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) {
      var ch = str.charCodeAt(i);
      h1 = Math.imul(h1 ^ ch, 2654435761);
      h2 = Math.imul(h2 ^ ch, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (h2 >>> 0).toString(16) + (h1 >>> 0).toString(16);
  }

  function dataSize() {
    try {
      return new Blob([JSON.stringify(data)]).size;
    } catch (error) {
      return JSON.stringify(data).length;
    }
  }

  function sizeLabel(bytes) {
    if (bytes < 1024) return bytes + ' بايت';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' كيلوبايت';
    return (bytes / (1024 * 1024)).toFixed(2) + ' ميجابايت';
  }

  function stripHtml(html) {
    var temp = document.createElement('div');
    temp.innerHTML = html;
    return (temp.textContent || temp.innerText || '').trim();
  }

  function activeItems(collection) {
    return (data[collection] || []).filter(function (item) {
      return item.active !== false;
    });
  }

  /* ------------------------------------------------------------------------
     State + boot
     ------------------------------------------------------------------------ */
  var storedLocal = loadLocal();
  var data = mergeWithDefaults(storedLocal);
  if (!storedLocal || !storedLocal.campaignsMigrated) {
    persistLocal(false);
  }
  backfillCustomers();
  var listeners = new Set();
  var readyResolve;
  var ready = new Promise(function (resolve) { readyResolve = resolve; });
  var booted = false;
  var lastLocalSave = 0;
  var cloudEnabled = false;
  var cloudStatus = 'local';

  function notify(source) {
    listeners.forEach(function (listener) {
      try {
        listener(data, source || 'local');
      } catch (error) {
        console.error('[NeonStore] listener error', error);
      }
    });
    window.dispatchEvent(new CustomEvent('neon:datachange', {
      detail: { data: data, source: source || 'local' }
    }));
  }

  function persist(options) {
    options = options || {};
    var ok = persistLocal(options.showErrors);
    data.updatedAt = nowISO();
    if (!ok) {
      data.updatedAt = null;
      return false;
    }
    if (options.showErrors !== false) lastLocalSave = Date.now();
    if (cloudEnabled && options.cloud !== false && window.NeonCloud && window.NeonCloud.save) {
      window.NeonCloud.save(data).catch(function (error) {
        setCloudStatus(error && error.code === 'AUTH_REQUIRED' ? 'auth-required' : 'error');
      });
    }
    notify(options.source || 'local');
    return true;
  }

  function setCloudStatus(status) {
    cloudStatus = status;
    window.dispatchEvent(new CustomEvent('neon:cloudstatus', { detail: { status: status } }));
  }

  function boot() {
    if (booted) return;
    booted = true;
    setCloudStatus('local');

    if (!window.NeonCloud || !window.NeonCloud.isConfigured || !window.NeonCloud.isConfigured()) {
      readyResolve(data);
      return;
    }

    cloudEnabled = true;
    setCloudStatus('syncing');
    var timeout = new Promise(function (resolve) { setTimeout(resolve, 4500); });

    Promise.race([
      window.NeonCloud.init()
        .then(function () {
          return window.NeonCloud.load();
        })
        .then(function (remote) {
          if (remote && typeof remote === 'object') {
            var localStats = data.campaignStats;
            var incoming = mergeWithDefaults(remote);
            mergeCampaignStats(incoming, localStats);
            if (JSON.stringify(incoming) !== JSON.stringify(data)) {
              data = incoming;
              persistLocal(false);
              notify('cloud-load');
            }
          }
          if (window.NeonCloud.subscribe) {
            window.NeonCloud.subscribe(function (remoteData) {
              if (!remoteData || typeof remoteData !== 'object') return;
              if (Date.now() - lastLocalSave < 2500) return;
              var localStats = data.campaignStats;
              var incoming = mergeWithDefaults(remoteData);
              mergeCampaignStats(incoming, localStats);
              if (JSON.stringify(incoming) === JSON.stringify(data)) return;
              data = incoming;
              persistLocal(false);
              notify('cloud');
            });
          }
          setCloudStatus('connected');
          return data;
        })
        .catch(function (error) {
          console.warn('[NeonStore] تعذر الاتصال بالسحابة، سنعمل محليًا.', error);
          setCloudStatus('error');
          return data;
        }),
      timeout
    ]).then(function () {
      readyResolve(data);
    });
  }

  setTimeout(boot, 0);

  /* ------------------------------------------------------------------------
     Public API
     ------------------------------------------------------------------------ */
  function get() {
    return data;
  }

  function save(nextData, options) {
    if (nextData && typeof nextData === 'object') {
      data = mergeWithDefaults(nextData);
    }
    return persist(options || {});
  }

  function update(mutator, options) {
    if (typeof mutator === 'function') mutator(data);
    return persist(options || {});
  }

  function getItem(collection, id) {
    return (data[collection] || []).find(function (item) { return item.id === id; }) || null;
  }

  function addItem(collection, item) {
    if (!Array.isArray(data[collection])) data[collection] = [];
    var entry = deepMerge({
      id: uid(collection.slice(0, 3)),
      active: true,
      createdAt: nowISO()
    }, item || {});
    entry.id = entry.id || uid(collection.slice(0, 3));
    data[collection].push(entry);
    persist();
    return entry.id;
  }

  function updateItem(collection, id, patch) {
    var list = data[collection] || [];
    var index = list.findIndex(function (item) { return item.id === id; });
    if (index === -1) return false;
    list[index] = deepMerge(list[index], patch || {});
    persist();
    return true;
  }

  function removeItem(collection, id) {
    var list = data[collection] || [];
    var next = list.filter(function (item) { return item.id !== id; });
    if (next.length === list.length) return false;
    data[collection] = next;
    persist();
    return true;
  }

  function moveItem(collection, id, direction) {
    var list = data[collection] || [];
    var index = list.findIndex(function (item) { return item.id === id; });
    if (index === -1) return false;
    var target = index + (direction === 'up' || direction < 0 ? -1 : 1);
    if (target < 0 || target >= list.length) return false;
    var temp = list[index];
    list[index] = list[target];
    list[target] = temp;
    persist();
    return true;
  }

  function campaignStats(id) {
    if (!id || !data.campaignStats) return null;
    var stats = data.campaignStats[id];
    return stats ? clone(stats) : null;
  }

  function trackCampaign(id, action) {
    var key = ({ impression: 'impressions', click: 'clicks', dismiss: 'dismissals' })[action];
    if (!id || !key) return null;
    if (!data.campaignStats || typeof data.campaignStats !== 'object') data.campaignStats = {};
    var stats = data.campaignStats[id] || { impressions: 0, clicks: 0, dismissals: 0, lastAt: null };
    stats[key] = (Number(stats[key]) || 0) + 1;
    stats.lastAt = nowISO();
    data.campaignStats[id] = stats;
    persistLocal(false);
    return stats;
  }

  function resetCampaignStats(id) {
    if (!data.campaignStats || typeof data.campaignStats !== 'object') data.campaignStats = {};
    if (id) {
      if (!data.campaignStats[id]) return false;
      delete data.campaignStats[id];
    } else {
      if (!Object.keys(data.campaignStats).length) return false;
      data.campaignStats = {};
    }
    persist({ source: 'campaign-stats' });
    return true;
  }

  function normalizePhone(phone) {
    var digits = String(phone == null ? '' : phone).replace(/\D/g, '');
    if (!digits) return '';
    if (digits.indexOf('00') === 0) digits = digits.slice(2);
    if (digits.indexOf('20') === 0 && digits.length > 10) digits = digits.slice(2);
    if (digits.charAt(0) === '0' && digits.length > 9) digits = digits.slice(1);
    return digits;
  }

  function findCustomerByPhone(phone) {
    var key = normalizePhone(phone);
    if (!key) return null;
    return (data.customers || []).find(function (customer) {
      return normalizePhone(customer.phone) === key;
    }) || null;
  }

  function upsertCustomer(info, options) {
    options = options || {};
    info = info || {};
    var key = normalizePhone(info.phone);
    if (!key) return null;
    if (!Array.isArray(data.customers)) data.customers = [];
    var customer = findCustomerByPhone(info.phone);
    if (!customer) {
      customer = {
        id: uid('cus'),
        name: String(info.name || '').trim(),
        phone: String(info.phone || '').trim(),
        email: String(info.email || '').trim(),
        tags: [],
        points: 0,
        totalPointsEarned: 0,
        totalPointsRedeemed: 0,
        notes: '',
        consent: true,
        nextFollowUp: '',
        active: true,
        createdAt: nowISO()
      };
      data.customers.push(customer);
      if (!options.silent) {
        var welcome = Number(data.settings.loyaltyWelcomePoints || 0);
        if (data.settings.loyaltyEnabled !== false && welcome > 0) {
          customer.points += welcome;
          customer.totalPointsEarned += welcome;
        }
      }
    } else {
      if (info.name && String(info.name).trim()) customer.name = String(info.name).trim();
      if (info.email && String(info.email).trim()) customer.email = String(info.email).trim();
      if (!customer.phone && info.phone) customer.phone = String(info.phone).trim();
    }
    if (options.points && Number(options.points) > 0) {
      customer.points = Number(customer.points || 0) + Number(options.points);
      customer.totalPointsEarned = Number(customer.totalPointsEarned || 0) + Number(options.points);
    }
    customer.updatedAt = nowISO();
    return customer;
  }

  function customerStats(customer) {
    var key = normalizePhone(customer && customer.phone);
    var list = (data.orders || []).filter(function (order) {
      return key && normalizePhone(order.phone) === key;
    });
    var spent = list.reduce(function (sum, order) {
      return sum + (order.status === 'ملغي' ? 0 : Number(order.amount || 0));
    }, 0);
    return {
      orders: list.length,
      spent: spent,
      lastOrderAt: list.reduce(function (last, order) {
        return !last || String(order.createdAt || '') > String(last) ? order.createdAt : last;
      }, '')
    };
  }

  function backfillCustomers() {
    var changed = false;
    (data.orders || []).forEach(function (order) {
      if (!normalizePhone(order.phone)) return;
      var before = (data.customers || []).length;
      upsertCustomer({ name: order.name, phone: order.phone, email: order.email }, { silent: true });
      if ((data.customers || []).length !== before) changed = true;
    });
    (data.messages || []).forEach(function (message) {
      if (!normalizePhone(message.phone)) return;
      var before = (data.customers || []).length;
      upsertCustomer({ name: message.name, phone: message.phone, email: message.email }, { silent: true });
      if ((data.customers || []).length !== before) changed = true;
    });
    return changed;
  }

  function addOrder(order) {
    var entry = deepMerge({
      id: 'NM-' + Date.now().toString(36).toUpperCase(),
      status: 'جديد',
      createdAt: nowISO()
    }, order || {});
    if (!Array.isArray(data.orders)) data.orders = [];
    data.orders.unshift(entry);

    var customer = upsertCustomer({ name: entry.name, phone: entry.phone, email: entry.email });
    if (customer && data.settings.loyaltyEnabled !== false && Number(entry.amount) > 0) {
      var earned = Math.floor(Number(entry.amount) * Number(data.settings.loyaltyPointsPerCurrency || 0));
      if (earned > 0) {
        customer.points = Number(customer.points || 0) + earned;
        customer.totalPointsEarned = Number(customer.totalPointsEarned || 0) + earned;
        entry.pointsEarned = earned;
      }
    }
    persist();
    return entry;
  }

  function addMessage(message) {
    var entry = deepMerge({
      id: 'MSG-' + Date.now().toString(36).toUpperCase(),
      status: 'جديد',
      createdAt: nowISO()
    }, message || {});
    if (!Array.isArray(data.messages)) data.messages = [];
    data.messages.unshift(entry);
    upsertCustomer({ name: entry.name, phone: entry.phone, email: entry.email });
    persist();
    return entry;
  }

  function usePoints(customerId, points) {
    var customer = getItem('customers', customerId);
    if (!customer) return false;
    var amount = Math.max(0, Math.min(Number(points || 0), Number(customer.points || 0)));
    if (!amount) return false;
    customer.points = Number(customer.points || 0) - amount;
    customer.totalPointsRedeemed = Number(customer.totalPointsRedeemed || 0) + amount;
    persist();
    return true;
  }

  function checkPassword(password) {
    var stored = data.settings.adminPasswordHash;
    if (!stored) return String(password) === DEFAULT_ADMIN_PASSWORD;
    return hashPassword(password) === stored;
  }

  function setPassword(newPassword) {
    data.settings.adminPasswordHash = hashPassword(newPassword);
    persist();
  }

  function reset() {
    data = mergeWithDefaults({});
    try { localStorage.removeItem(STORAGE_KEY); } catch (error) { /* ignore */ }
    persist({ cloud: true, source: 'reset' });
  }

  function exportJSON() {
    return JSON.stringify(data, null, 2);
  }

  function importJSON(text) {
    var parsed;
    if (typeof text === 'string') {
      parsed = JSON.parse(text);
    } else {
      parsed = text;
    }
    if (!parsed || typeof parsed !== 'object') {
      throw new Error('ملف غير صالح');
    }
    data = mergeWithDefaults(parsed);
    persist({ source: 'import' });
    return true;
  }

  function getStats() {
    var orders = data.orders || [];
    var revenue = orders.reduce(function (sum, order) {
      var value = Number(order.amount) || 0;
      if (order.status !== 'ملغي' && order.status !== 'مرفوض') sum += value;
      return sum;
    }, 0);
    return {
      services: activeItems('services').length,
      works: activeItems('works').length,
      testimonials: activeItems('testimonials').length,
      packages: activeItems('packages').length,
      orders: orders.length,
      newOrders: orders.filter(function (order) { return order.status === 'جديد'; }).length,
      messages: (data.messages || []).length,
      newMessages: (data.messages || []).filter(function (msg) { return msg.status === 'جديد'; }).length,
      customers: (data.customers || []).length,
      revenue: revenue,
      currency: data.settings.currency,
      dataSize: dataSize()
    };
  }

  function subscribe(listener) {
    if (typeof listener !== 'function') return function () {};
    listeners.add(listener);
    return function () { listeners.delete(listener); };
  }

  function whatsappLink(text) {
    var digits = String(data.settings.whatsapp || '').replace(/\D/g, '');
    var suffix = text ? '?text=' + encodeURIComponent(text) : '';
    return 'https://wa.me/' + digits + suffix;
  }

  window.addEventListener('storage', function (event) {
    if (event.key !== STORAGE_KEY || !event.newValue) return;
    try {
      var incoming = mergeWithDefaults(JSON.parse(event.newValue));
      if (JSON.stringify(incoming) === JSON.stringify(data)) return;
      data = incoming;
      notify('storage');
    } catch (error) {
      /* ignore */
    }
  });

  window.NeonStore = {
    DEFAULTS: DEFAULTS,
    STORAGE_KEY: STORAGE_KEY,
    DEFAULT_ADMIN_PASSWORD: DEFAULT_ADMIN_PASSWORD,
    ready: ready,
    get: get,
    save: save,
    update: update,
    reset: reset,
    subscribe: subscribe,
    getItem: getItem,
    addItem: addItem,
    updateItem: updateItem,
    removeItem: removeItem,
    moveItem: moveItem,
    campaignStats: campaignStats,
    trackCampaign: trackCampaign,
    resetCampaignStats: resetCampaignStats,
    activeItems: activeItems,
    addOrder: addOrder,
    addMessage: addMessage,
    normalizePhone: normalizePhone,
    findCustomerByPhone: findCustomerByPhone,
    upsertCustomer: upsertCustomer,
    customerStats: customerStats,
    usePoints: usePoints,
    checkPassword: checkPassword,
    setPassword: setPassword,
    hashPassword: hashPassword,
    exportJSON: exportJSON,
    importJSON: importJSON,
    getStats: getStats,
    dataSize: dataSize,
    sizeLabel: sizeLabel,
    uid: uid,
    clone: clone,
    stripHtml: stripHtml,
    whatsappLink: whatsappLink,
    getCloudStatus: function () { return cloudStatus; },
    isCloudEnabled: function () { return cloudEnabled; },
    formatPrice: function (value, currency) {
      var number = Number(value) || 0;
      var cur = currency || data.settings.currency || 'ج.م';
      return number.toLocaleString('en-US') + ' ' + cur;
    },
    formatDate: function (value, withTime) {
      if (!value) return '—';
      try {
        var date = new Date(value);
        var opts = { year: 'numeric', month: 'short', day: 'numeric' };
        if (withTime) {
          opts.hour = '2-digit';
          opts.minute = '2-digit';
        }
        return date.toLocaleDateString('ar-EG', opts);
      } catch (error) {
        return String(value);
      }
    }
  };
})();
