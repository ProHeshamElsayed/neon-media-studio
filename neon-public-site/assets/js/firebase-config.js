/* ==========================================================================
   إعدادات Firebase — مشروع نِيون ميديا
   --------------------------------------------------------------------------
   المشروع: neon-media-hesham
   - Firestore: يخزّن محتوى الموقع (مصدر الحقيقة للزوار)
   - Authentication: تسجيل دخول المشرف (Email/Password)
   - Storage: اختياري لرفع الصور

   ⚠️ ملاحظة أمنية:
   apiKey هنا ليس سرًّا — يظهر لأي زائر بطبيعته في تطبيقات الويب.
   الحماية الحقيقية تأتي من Firestore Security Rules + تسجيل دخول المشرف.
   لا تضع هنا أي كلمة مرور أو مفتاح خدمة (service account).
   ========================================================================== */
window.NEON_FIREBASE_CONFIG = {
  enabled: true,

  apiKey: 'AIzaSyCHxM7pYCWOpgsOdXfNFF0p2wLaUw0yWGQ',
  authDomain: 'neon-media-hesham.firebaseapp.com',
  projectId: 'neon-media-hesham',
  storageBucket: 'neon-media-hesham.firebasestorage.app',
  messagingSenderId: '236030049185',
  appId: '1:236030049185:web:e95f3933a64d8b040d29e0',

  // تسجيل دخول المشرف — يمنع أي شخص غيرك من الكتابة في قاعدة البيانات
  auth: {
    enabled: true
  },

  // مسار مستند الموقع داخل Firestore
  collection: 'sites',
  docId: 'neon-media',

  // رفع الصور إلى Firebase Storage (يتطلب تفعيل Storage + قواعد آمنة)
  useStorage: false,
  storageFolder: 'neon-media'
};
