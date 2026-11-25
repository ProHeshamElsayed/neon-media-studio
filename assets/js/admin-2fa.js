/* ==========================================================================
   NÉON MEDIA — TOTP (RFC 6238) للتحقق بخطوتين
   يعمل بالكامل داخل المتصفح عبر Web Crypto (HMAC-SHA1) — بدون سيرفر.
   Google Authenticator وأي تطبيق OTP يدعم الشفرة يدويًا بسر Base32.
   ========================================================================== */
(function () {
  'use strict';

  var B32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

  function base32Decode(input) {
    var text = String(input || '').replace(/[\s-]/g, '').toUpperCase().replace(/=+$/, '');
    if (!text.length) return new Uint8Array(0);
    var bits = 0, bitCount = 0, out = [];
    for (var i = 0; i < text.length; i++) {
      var val = B32_ALPHABET.indexOf(text.charAt(i));
      if (val === -1) continue;
      bits = (bits << 5) | val;
      bitCount += 5;
      if (bitCount >= 8) {
        bitCount -= 8;
        out.push((bits >>> bitCount) & 0xff);
      }
    }
    return Uint8Array.from(out);
  }

  function base32Encode(bytes) {
    var bits = 0, bitCount = 0, out = '';
    for (var i = 0; i < bytes.length; i++) {
      bits = (bits << 8) | bytes[i];
      bitCount += 8;
      while (bitCount >= 5) {
        bitCount -= 5;
        out += B32_ALPHABET.charAt((bits >>> bitCount) & 31);
      }
    }
    if (bitCount > 0) {
      out += B32_ALPHABET.charAt((bits << (5 - bitCount)) & 31);
    }
    return out;
  }

  function hmacSha1(keyBytes, messageBytes) {
    return crypto.subtle.importKey('raw', keyBytes, { name: 'HMAC', hash: 'SHA-1' }, false, ['sign'])
      .then(function (key) { return crypto.subtle.sign('HMAC', key, messageBytes); })
      .then(function (buf) { return new Uint8Array(buf); });
  }

  function counterBytes(counter) {
    var buf = new Uint8Array(8);
    var value = counter;
    // JavaScript numbers تصلح حتى 2^53 — كافي لقرون من 30 ثانية
    for (var i = 7; i >= 0; i--) {
      buf[i] = value & 0xff;
      value = Math.floor(value / 256);
    }
    return buf;
  }

  function codeFromDigest(digest) {
    var offset = digest[digest.length - 1] & 0x0f;
    var code = ((digest[offset] & 0x7f) << 24)
      | ((digest[offset + 1] & 0xff) << 16)
      | ((digest[offset + 2] & 0xff) << 8)
      | (digest[offset + 3] & 0xff);
    return String(code % 1000000).padStart(6, '0');
  }

  function codeFor(secretBase32, stepCounter) {
    return hmacSha1(base32Decode(secretBase32), counterBytes(stepCounter))
      .then(codeFromDigest);
  }

  function generateSecret() {
    var bytes = new Uint8Array(20); // 160 بت — الحد الموصى به
    crypto.getRandomValues(bytes);
    return base32Encode(bytes);
  }

  function otpauthUrl(secret, account, issuer) {
    var label = encodeURIComponent((issuer || 'NEON MEDIA') + ':' + (account || 'admin'));
    var params = 'secret=' + encodeURIComponent(secret)
      + '&issuer=' + encodeURIComponent(issuer || 'NEON MEDIA')
      + '&algorithm=SHA1&digits=6&period=30';
    return 'otpauth://totp/' + label + '?' + params;
  }

  function verify(secretBase32, code) {
    var clean = String(code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(clean)) return Promise.resolve(false);
    var step = 30;
    var now = Math.floor(Date.now() / 1000 / step);
    var steps = [now, now - 1, now + 1];
    return Promise.all(steps.map(function (s) { return codeFor(secretBase32, s); }))
      .then(function (codes) { return codes.indexOf(clean) !== -1; })
      .catch(function () { return false; });
  }

  window.NeonTotp = {
    base32Decode: base32Decode,
    base32Encode: base32Encode,
    codeFor: codeFor,
    generateSecret: generateSecret,
    otpauthUrl: otpauthUrl,
    verify: verify
  };
})();
