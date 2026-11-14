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

  function cleanPayload(payload) {
    try {
      return JSON.parse(JSON.stringify(payload));
    } catch (error) {
      return null;
    }
  }

  // إنشاء سجل عام (طلب/رسالة) من صفحات الزوار — مسموح بالقواعد للإنشاء فقط.
  async function createRecord(name, payload) {
    if (!isConfigured()) return null;
    var body = cleanPayload(payload);
    if (!body) return null;
    await init();
    var fs = state.mods.firestore;
    var ref = await fs.addDoc(fs.collection(state.db, name), body);
    return ref.id;
  }

  // جلب السجلات — يتطلب تسجيل دخول المشرف (قواعد القراءة).
  async function fetchRecords(name, limitCount) {
    if (!isConfigured()) return [];
    await init();
    var fs = state.mods.firestore;
    var q = fs.query(
      fs.collection(state.db, name),
      fs.orderBy('createdAt', 'desc'),
      fs.limit(limitCount || 200)
    );
    var snapshot = await fs.getDocs(q);
    return snapshot.docs.map(function (docSnap) {
      return Object.assign({ _cloudId: docSnap.id }, docSnap.data());
    });
  }

  async function updateRecord(name, id, patch) {
    if (!isConfigured() || !id) return false;
    await init();
    var fs = state.mods.firestore;
    await fs.updateDoc(fs.doc(state.db, name, String(id)), patch || {});
    return true;
  }

  async function deleteRecord(name, id) {
    if (!isConfigured() || !id) return false;
    await init();
    var fs = state.mods.firestore;
    await fs.deleteDoc(fs.doc(state.db, name, String(id)));
    return true;
  }

  // متابعة لحظية للطلبات/الرسائل داخل لوحة التحكم.
  async function watchRecords(name, callback, limitCount) {
    if (!isConfigured() || typeof callback !== 'function') return function () {};
    await init();
    var fs = state.mods.firestore;
    var q = fs.query(
      fs.collection(state.db, name),
      fs.orderBy('createdAt', 'desc'),
      fs.limit(limitCount || 200)
    );
    return fs.onSnapshot(q, function (snapshot) {
      var items = snapshot.docs.map(function (docSnap) {
        return Object.assign({ _cloudId: docSnap.id }, docSnap.data());
      });
      try {
        callback(items);
      } catch (error) {
        console.warn('[NeonCloud] خطأ في معالجة ' + name, error);
      }
    }, function (error) {
      console.warn('[NeonCloud] تعذر متابعة ' + name + ':', error && error.code ? error.code : error);
    });
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

  /* ------------------------------------------------------------------------
     Customer accounts — نسخة Firebase مستقلة عن جلسة المشرف
     حتى لا تتأثر جلسة الأدمن أو توكنه عند دخول عميل من نفس المتصفح.
     ------------------------------------------------------------------------ */
  var customer = {
    initPromise: null,
    app: null,
    auth: null,
    db: null,
    mods: null,
    user: null,
    ready: false
  };

  function isCustomerReady() {
    return Boolean(customer.auth);
  }

  async function initCustomer() {
    if (!isConfigured()) return null;
    if (customer.initPromise) return customer.initPromise;
    customer.initPromise = (async function () {
      var appMod = await import(BASE + 'firebase-app.js');
      var authMod = await import(BASE + 'firebase-auth.js');
      var fsMod = await import(BASE + 'firebase-firestore.js');

      var app;
      try {
        app = appMod.getApp('neon-customers');
      } catch (missingApp) {
        app = appMod.initializeApp(config, 'neon-customers');
      }

      customer.app = app;
      customer.auth = authMod.getAuth(app);
      customer.db = fsMod.getFirestore(app);
      customer.mods = { app: appMod, auth: authMod, fs: fsMod };

      try {
        await authMod.setPersistence(customer.auth, authMod.browserLocalPersistence);
      } catch (persistenceError) {
        console.warn('[NeonCloud] تعذر تثبيت جلسة العميل:', persistenceError);
      }

      authMod.onAuthStateChanged(customer.auth, function (user) {
        customer.user = user || null;
        customer.ready = true;
        window.dispatchEvent(new CustomEvent('neon:customerauth', { detail: { user: customer.user } }));
      });

      return customer;
    })();
    return customer.initPromise;
  }

  function customerError(code, message) {
    var error = new Error(message || 'تعذر تنفيذ العملية.');
    error.code = code || '';
    return error;
  }

  async function customerRegister(options) {
    var opts = options || {};
    var email = String(opts.email || '').trim();
    var password = String(opts.password || '');
    var name = String(opts.name || '').trim();
    var phone = String(opts.phone || '').trim();
    if (!email || !password) throw customerError('auth/missing-fields', 'أدخل الإيميل وكلمة المرور.');
    await initCustomer();
    if (!customer.auth) throw customerError('auth/unavailable', 'خدمة الحسابات غير متاحة حاليًا.');
    var authMod = customer.mods.auth;
    var fs = customer.mods.fs;
    var credential = await authMod.createUserWithEmailAndPassword(customer.auth, email, password);
    var user = credential.user;
    if (!user) throw customerError('auth/failed', 'تعذر إنشاء الحساب.');
    if (name) {
      try { await authMod.updateProfile(user, { displayName: name }); } catch (profileError) { /* اختياري */ }
    }
    try {
      await fs.setDoc(fs.doc(customer.db, 'clients', user.uid), {
        name: name,
        email: email,
        phone: phone,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (profileWriteError) {
      console.warn('[NeonCloud] تم إنشاء الحساب لكن تعذر حفظ الملف الشخصي:', profileWriteError);
    }
    return user;
  }

  async function customerSignIn(email, password) {
    await initCustomer();
    if (!customer.auth) throw customerError('auth/unavailable', 'خدمة الحسابات غير متاحة حاليًا.');
    var credential = await customer.mods.auth.signInWithEmailAndPassword(
      customer.auth,
      String(email || '').trim(),
      String(password || '')
    );
    return credential.user;
  }

  async function customerSignOut() {
    if (!customer.auth) return;
    await customer.mods.auth.signOut(customer.auth);
    customer.user = null;
  }

  async function customerResetPassword(email) {
    await initCustomer();
    if (!customer.auth) throw customerError('auth/unavailable', 'خدمة الحسابات غير متاحة حاليًا.');
    await customer.mods.auth.sendPasswordResetEmail(customer.auth, String(email || '').trim());
    return true;
  }

  function getCustomerUser() {
    return customer.user;
  }

  async function whenCustomerReady(timeoutMs) {
    if (customer.ready) return customer.user;
    await initCustomer().catch(function () { return null; });
    if (customer.ready) return customer.user;
    return new Promise(function (resolve) {
      var done = false;
      function finish() {
        if (done) return;
        done = true;
        window.removeEventListener('neon:customerauth', finish);
        resolve(customer.user);
      }
      window.addEventListener('neon:customerauth', finish);
      setTimeout(finish, timeoutMs || 4000);
    });
  }

  async function getCustomerProfile() {
    await initCustomer();
    if (!customer.user) return null;
    var fs = customer.mods.fs;
    var snapshot = await fs.getDoc(fs.doc(customer.db, 'clients', customer.user.uid));
    return snapshot.exists() ? Object.assign({ _cloudId: snapshot.id }, snapshot.data()) : null;
  }

  async function saveCustomerProfile(patch) {
    await initCustomer();
    if (!customer.user) throw customerError('auth/required', 'سجّل الدخول أولًا.');
    var fs = customer.mods.fs;
    var payload = Object.assign({}, patch || {}, { updatedAt: new Date().toISOString() });
    await fs.setDoc(fs.doc(customer.db, 'clients', customer.user.uid), payload, { merge: true });
    return true;
  }

  async function fetchCustomerOrders() {
    await initCustomer();
    if (!customer.user) return [];
    var fs = customer.mods.fs;
    var q = fs.query(
      fs.collection(customer.db, 'orders'),
      fs.where('userId', '==', customer.user.uid)
    );
    var snapshot = await fs.getDocs(q);
    var rows = snapshot.docs.map(function (docSnap) {
      return Object.assign({ _cloudId: docSnap.id }, docSnap.data());
    });
    rows.sort(function (a, b) {
      return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
    });
    return rows;
  }

  window.NeonCloud = {
    isConfigured: isConfigured,
    init: init,
    load: load,
    save: save,
    reserveOrderNumber: reserveOrderNumber,
    createRecord: createRecord,
    fetchRecords: fetchRecords,
    updateRecord: updateRecord,
    deleteRecord: deleteRecord,
    watchRecords: watchRecords,
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
    config: config,

    // حسابات العملاء — تطبيق Firebase مستقل تمامًا عن جلسة المشرف
    initCustomer: initCustomer,
    customerRegister: customerRegister,
    customerSignIn: customerSignIn,
    customerSignOut: customerSignOut,
    customerResetPassword: customerResetPassword,
    getCustomerUser: getCustomerUser,
    whenCustomerReady: whenCustomerReady,
    getCustomerProfile: getCustomerProfile,
    saveCustomerProfile: saveCustomerProfile,
    fetchCustomerOrders: fetchCustomerOrders
  };
})();
