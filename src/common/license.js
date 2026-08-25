/**
 * SubSniper — license.js
 * ------------------------------------------------------------------
 * Free vs Pro gating.
 *
 *   FREE  → 1 tracked product · max 15 saved leads · template drafts only.
 *   PRO   → unlimited products & leads · AI drafts.
 *
 * The key check here is an HONEST LOCAL STUB so the extension is fully
 * functional offline and reviewable. In production you swap the stub for a
 * real verification against ExtensionPay or Gumroad (see WIRE-UP notes below).
 * ------------------------------------------------------------------
 */
globalThis.SubSniper = globalThis.SubSniper || {};

(function (NS) {
  'use strict';

  // Where to send users who click "Upgrade". Replace with your real checkout.
  //
  //  ── WIRE-UP: ExtensionPay (https://extensionpay.com) ──────────────────────
  //   1. `npm i extensionpay` (or load extpay.js) and create an account.
  //   2. In the background worker:  const extpay = ExtPay('subsniper');
  //      extpay.startBackground();
  //   3. Replace isPro()/activate() below with `await extpay.getUser()` and
  //      gate on `user.paid`.  startCheckout ⇒ `extpay.openPaymentPage()`.
  //
  //  ── WIRE-UP: Gumroad license keys (https://gumroad.com) ───────────────────
  //   1. Sell a membership product; enable "Generate license keys".
  //   2. Verify a key server-lessly from the background worker:
  //        POST https://api.gumroad.com/v2/licenses/verify
  //             { product_id, license_key, increment_uses_count:false }
  //      and gate on `success && !purchase.refunded && purchase.subscription…`.
  //   3. Point CHECKOUT_URL at your Gumroad product URL.
  const CHECKOUT_URL = 'https://subsniper.gumroad.com/l/pro';

  // ── Local stub key format ────────────────────────────────────────────────
  // A valid demo key looks like:  SUBSNIPER-PRO-XXXX-XXXX-CHK
  // where CHK is a 2-char checksum of the middle blocks. This is intentionally
  // simple + offline; it is NOT anti-piracy — real verification is server-side
  // (see WIRE-UP above). It exists so activation is testable end-to-end.
  function checksum(str) {
    let sum = 0;
    for (let i = 0; i < str.length; i++) sum = (sum * 31 + str.charCodeAt(i)) >>> 0;
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';
    return alphabet[sum % 34] + alphabet[(sum >>> 5) % 34];
  }

  /** @returns {boolean} whether a key passes the local format+checksum check. */
  function isValidKeyFormat(key) {
    if (typeof key !== 'string') return false;
    const k = key.trim().toUpperCase();
    const m = k.match(/^SUBSNIPER-PRO-([A-Z0-9]{4})-([A-Z0-9]{4})-([A-Z0-9]{2})$/);
    if (!m) return false;
    return checksum('SUBSNIPER-PRO-' + m[1] + '-' + m[2]) === m[3];
  }

  /** Generate a valid demo key (used by tests / docs; not shipped in UI). */
  function generateDemoKey() {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ23456789';
    const block = () => Array.from({ length: 4 }, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)]).join('');
    const a = block(), b = block();
    return 'SUBSNIPER-PRO-' + a + '-' + b + '-' + checksum('SUBSNIPER-PRO-' + a + '-' + b);
  }

  const License = {
    CHECKOUT_URL,
    isValidKeyFormat,
    generateDemoKey,

    /** @returns {Promise<{pro:boolean, key:string, limits:Object}>} */
    async getStatus() {
      const settings = await NS.Storage.getSettings();
      const lic = settings.license || { pro: false, key: '' };
      return {
        pro: !!lic.pro,
        key: lic.key || '',
        limits: lic.pro
          ? { products: Infinity, leads: Infinity, ai: true }
          : { products: NS.LIMITS.FREE_PRODUCTS, leads: NS.LIMITS.FREE_LEADS, ai: false }
      };
    },

    async isPro() {
      const s = await this.getStatus();
      return s.pro;
    },

    /**
     * Activate a license key. In production this is where you call ExtensionPay
     * / Gumroad. The local stub validates format+checksum.
     * @returns {Promise<{ok:boolean, pro:boolean, error?:string}>}
     */
    async activate(key) {
      const clean = (key || '').trim();
      if (!clean) return { ok: false, pro: false, error: 'Enter a license key.' };
      // ── Replace this block with a real Gumroad/ExtensionPay verification. ──
      const valid = isValidKeyFormat(clean);
      if (!valid) {
        return { ok: false, pro: false, error: 'That key is not valid.' };
      }
      await NS.Storage.updateSettings({ license: { pro: true, key: clean.toUpperCase() } });
      return { ok: true, pro: true };
    },

    /** Remove Pro (for testing / "sign out of Pro"). */
    async deactivate() {
      await NS.Storage.updateSettings({ license: { pro: false, key: '' } });
      return { ok: true, pro: false };
    },

    /**
     * Open the checkout page. Content-script/popup context can't reliably open
     * tabs, so we route through the background worker.
     */
    startCheckout() {
      try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
          chrome.runtime.sendMessage({ type: NS.MSG.OPEN_CHECKOUT, url: CHECKOUT_URL });
          return;
        }
      } catch (_e) { /* fall through */ }
      if (typeof window !== 'undefined' && window.open) window.open(CHECKOUT_URL, '_blank');
    },

    /**
     * Gate helper for the UI: can the user save another lead right now?
     * @param {number} activeLeadCount
     */
    async canSaveLead(activeLeadCount) {
      const s = await this.getStatus();
      if (s.pro) return { allowed: true };
      return {
        allowed: activeLeadCount < s.limits.leads,
        limit: s.limits.leads
      };
    },

    /** Gate helper: can the user add another product? */
    async canAddProduct(currentCount) {
      const s = await this.getStatus();
      if (s.pro) return { allowed: true };
      return { allowed: currentCount < s.limits.products, limit: s.limits.products };
    }
  };

  NS.License = License;
})(globalThis.SubSniper);
