/* ==========================================================================
   إعدادات Firebase (اختياري)
   --------------------------------------------------------------------------
   1) أنشئ مشروعًا على https://console.firebase.google.com
   2) فعّل Firestore Database (وStorage لو أردت رفع الصور للسحابة)
   3) انسخ إعدادات التطبيق (firebaseConfig) والصقها هنا
   4) اجعل enabled = true
   5) راجع ملف README.md وfirebase/firestore.rules قبل النشر

   بدون تفعيل Firebase سيعمل الموقع ولوحة التحكم محليًا على localStorage
   ========================================================================== */
window.NEON_FIREBASE_CONFIG = {
  enabled: false,

  apiKey: 'PASTE_API_KEY',
  authDomain: 'YOUR_PROJECT.firebaseapp.com',
  projectId: 'YOUR_PROJECT',
  storageBucket: 'YOUR_PROJECT.appspot.com',
  messagingSenderId: 'PASTE_SENDER_ID',
  appId: 'PASTE_APP_ID',

  // مسار مستند الموقع داخل Firestore
  collection: 'sites',
  docId: 'neon-media',

  // رفع الصور إلى Firebase Storage (يتطلب تفعيل Storage في المشروع)
  useStorage: true,
  storageFolder: 'neon-media'
};
