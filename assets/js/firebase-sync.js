/* ==========================================================================
   NÉON MEDIA — Optional Firebase Bridge
   مزامنة المحتوى مع Firestore + رفع الصور إلى Storage.
   يُحمَّل قبل store.js، ولا يفعل شيئًا إذا لم يكن Firebase مفعّلًا.
   ========================================================================== */
(function () {
  'use strict';

  var config = window.NEON_FIREBASE_CONFIG || {};
  var state = {
    app: null,
    db: null,
    storage: null,
    mods: null,
    initialized: false,
    subscribed: false,
    saveTimer: null,
    pendingData: null,
    unsubscribe: null,
    auth: null,
    authMod: null,
    user: null
  };
  var counterUnavailable = false;

  function authEnabled() {
    return Boolean(config.auth && config.auth.enabled);
  }

  var SDK_VERSION = '10.12.5';
  var BASE = 'https://www.gstatic.com/firebasejs/' + SDK_VERSION + '/';

  function isConfigured() {
    return Boolean(
      config.enabled &&
      config.apiKey &&
      config.apiKey.indexOf('PASTE_') === -1 &&
      config.projectId &&
      config.projectId !== 'YOUR_PROJECT'
    );
  }

  function emit(status) {
    window.dispatchEvent(new CustomEvent('neon:cloudstatus', { detail: { status: status } }));
  }

  async function init() {
    if (!isConfigured()) return null;
    if (state.initialized) return state;
    try {
      emit('syncing');
      var appMod = await import(BASE + 'firebase-app.js');
      var firestoreMod = await import(BASE + 'firebase-firestore.js');

      state.app = appMod.initializeApp(config, 'neon-media');
      state.db = firestoreMod.getFirestore(state.app);
      state.mods = { firestore: firestoreMod, app: appMod };

      if (config.useStorage && config.storageBucket && config.storageBucket.indexOf('YOUR_PROJECT') === -1) {
        try {
          var storageMod = await import(BASE + 'firebase-storage.js');
          state.storage = storageMod.getStorage(state.app);
          state.mods.storage = storageMod;
        } catch (storageError) {
          console.warn('[NeonCloud] تم تعطيل Storage — الصور ستُحفظ محليًا.', storageError);
          state.storage = null;
        }
      }

      state.initialized = true;
      if (authEnabled()) {
        try {
          await initAuth();
        } catch (authError) {
          console.warn('[NeonCloud] تعذر تهيئة تسجيل الدخول:', authError);
        }
      }
      emit('connected');
      return state;
    } catch (error) {
      console.error('[NeonCloud] فشل تهيئة Firebase:', error);
      emit('error');
      throw error;
    }
  }

  function docRef() {
    return state.mods.firestore.doc(state.db, config.collection || 'sites', config.docId || 'neon-media');
  }

  async function load() {
    if (!isConfigured()) return null;
    await init();
    try {
      var snapshot = await state.mods.firestore.getDoc(docRef());
      if (!snapshot.exists()) return null;
      var payload = snapshot.data();
      return payload && payload.data ? payload.data : null;
    } catch (error) {
      console.error('[NeonCloud] تعذر قراءة البيانات:', error);
      emit('error');
      throw error;
    }
  }

  async function save(data) {
    if (!isConfigured()) return false;
    if (authEnabled() && !state.user) {
      emit('auth-required');
      var authError = new Error('يجب تسجيل الدخول بحساب المشرف أولًا ليتم حفظ التغييرات في السحابة.');
      authError.code = 'AUTH_REQUIRED';
      throw authError;
    }
    var payloadSize = 0;
    try { payloadSize = JSON.stringify(data).length; } catch (sizeProbeError) { payloadSize = 0; }
    if (payloadSize > 900000) {
      var sizeError = new Error('حجم المحتوى ' + Math.round(payloadSize / 1024) + ' كيلوبايت — قريب من الحد الأقصى (1 ميجابايت). صغّر الصور أو استخدم روابط صور.');
      sizeError.code = 'DOC_TOO_LARGE';
      throw sizeError;
    }
    state.pendingData = data;
    if (state.saveTimer) clearTimeout(state.saveTimer);
    return new Promise(function (resolve, reject) {
      state.saveTimer = setTimeout(async function () {
        try {
          await init();
          emit('saving');
          await state.mods.firestore.setDoc(docRef(), {
            data: state.pendingData,
            updatedAt: state.mods.firestore.serverTimestamp()
          });
          emit('connected');
          resolve(true);
        } catch (error) {
          console.error('[NeonCloud] تعذر حفظ البيانات في السحابة:', error);
          emit('error');
          reject(error);
        }
      }, 900);
    });
  }

  async function reserveOrderNumber(startValue) {
    if (!isConfigured() || counterUnavailable) return null;
    await init();
    var fs = state.mods.firestore;
    if (!fs || !fs.runTransaction) return null;
    var ref = fs.doc(state.db, 'counters', 'orders');
    try {
      return await fs.runTransaction(state.db, async function (transaction) {
        var snapshot = await transaction.get(ref);
        var current = snapshot.exists() ? (Number(snapshot.data().value) || 0) : 0;
        var next = Math.max(current + 1, Math.floor(Number(startValue) || 1));
        if (snapshot.exists()) {
          transaction.update(ref, { value: next, updatedAt: fs.serverTimestamp() });
        } else {
          transaction.set(ref, { value: next, updatedAt: fs.serverTimestamp() });
        }
        return next;
      });
    } catch (error) {
      // القواعد قد تمنع العدّاد قبل نشرها — نكمل بالترقيم المحلي بدون تعطيل الطلب
      counterUnavailable = true;
      console.warn('[NeonCloud] عدّاد الطلبات غير متاح — سيتم استخدام الترقيم المحلي.', error && error.code ? error.code : error);
      return null;
    }
  }

  function subscribe(callback) {
    if (!isConfigured() || state.subscribed) return;
    init().then(function () {
      state.subscribed = true;
      state.unsubscribe = state.mods.firestore.onSnapshot(docRef(), function (snapshot) {
        if (!snapshot.exists()) return;
        var payload = snapshot.data();
        if (payload && payload.data) callback(payload.data);
      }, function (error) {
        console.warn('[NeonCloud] انقطع الاتصال اللحظي:', error);
        emit('error');
      });
    }).catch(function () { /* handled in init */ });
  }

  function stop() {
    if (state.unsubscribe) state.unsubscribe();
    state.subscribed = false;
  }

  async function uploadImage(dataUrl, folder) {
    if (!isConfigured() || !dataUrl || dataUrl.indexOf('data:') !== 0) return dataUrl;
    if (authEnabled() && !state.user) return dataUrl;
    await init();
    if (!state.storage || !state.mods.storage) return dataUrl;
    try {
      var extension = 'jpg';
      var match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);/);
      if (match) {
        extension = match[1] === 'jpeg' ? 'jpg' : match[1];
        if (extension === 'svg+xml') extension = 'svg';
      }
      var path = (config.storageFolder || 'uploads') + '/' + (folder || 'images') + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 7) + '.' + extension;
      var storageRef = state.mods.storage.ref(state.storage, path);
      await state.mods.storage.uploadString(storageRef, dataUrl, 'data_url');
      return await state.mods.storage.getDownloadURL(storageRef);
    } catch (error) {
      console.warn('[NeonCloud] فشل رفع الصورة — سيتم حفظها محليًا.', error);
      return dataUrl;
    }
  }

  async function initAuth() {
    if (!authEnabled() || state.authMod) return;
    var authMod = await import(BASE + 'firebase-auth.js');
    state.authMod = authMod;
    state.auth = authMod.getAuth(state.app);
    try {
      await authMod.setPersistence(state.auth, authMod.browserLocalPersistence);
    } catch (persistenceError) {
      console.warn('[NeonCloud] تعذر تثبيت الجلسة:', persistenceError);
    }
    authMod.onAuthStateChanged(state.auth, function (user) {
      state.user = user || null;
      emit(user ? 'auth-in' : 'auth-out');
    });
  }

  async function signIn(email, password) {
    if (!authEnabled()) throw new Error('تسجيل الدخول غير مفعّل في الإعدادات.');
    await init();
    await initAuth();
    if (!state.authMod) throw new Error('تعذر تحميل وحدة تسجيل الدخول.');
    await state.authMod.signInWithEmailAndPassword(state.auth, String(email || '').trim(), String(password || ''));
    return state.user;
  }

  async function signOutAdmin() {
    if (!state.authMod || !state.auth) return;
    await state.authMod.signOut(state.auth);
    state.user = null;
    emit('auth-out');
  }

  function isSignedIn() {
    return Boolean(state.user);
  }

  async function testConnection() {
    if (!isConfigured()) return { ok: false, message: 'Firebase غير مفعّل في firebase-config.js' };
    try {
      await init();
      await state.mods.firestore.getDoc(docRef());
      emit('connected');
      return { ok: true, message: 'تم الاتصال بـ Firestore بنجاح' };
    } catch (error) {
      return { ok: false, message: 'تعذر الاتصال: ' + (error.message || 'خطأ غير معروف') };
    }
  }

  window.NeonCloud = {
    isConfigured: isConfigured,
    init: init,
    load: load,
    save: save,
    reserveOrderNumber: reserveOrderNumber,
    subscribe: subscribe,
    stop: stop,
    uploadImage: uploadImage,
    testConnection: testConnection,
    signIn: signIn,
    signOut: signOutAdmin,
    isSignedIn: isSignedIn,
    isAuthEnabled: authEnabled,
    getUser: function () { return state.user; },
    getState: function () { return state; },
    config: config
  };
})();
