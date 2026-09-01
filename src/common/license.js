/**
 * SubSniper — license.js
 * ------------------------------------------------------------------
 * Free vs Pro gating — CONFIG-DRIVEN and SERVER-VERIFIED.
 *
 * The switch lives in billing-config.js (NS.BillingConfig.LEMON_SQUEEZY):
 *   • any field empty ⇒ billing OFF ⇒ free-only, everything unlocked, no CTAs.
 *   • all fields set  ⇒ billing ON  ⇒ Free = 1 product + template drafts;
 *                                     Pro  = unlimited products + AI drafts.
 *
 * HOW PRO IS DECIDED (the only rule that matters):
 *   Pro is granted ONLY from a result returned by the Lemon Squeezy License
 *   API, fetched by the BACKGROUND WORKER, and only when that result says the
 *   key is valid AND its status is "active" (i.e. the subscription is still
 *   paying). The verified result is cached in chrome.storage.local:
 *     - re-validated with the server once it is >24h old (REVALIDATE_MS)
 *     - if the server is unreachable, Pro survives up to 3 days past the last
 *       successful validation (GRACE_MS), then falls back to Free.
 *   Nothing in this file can grant Pro on its own — there is no local key
 *   check to bypass. computeStatus() is a PURE function of (config, cache,
 *   now) so the gate logic is unit-tested (license.test.mjs).
 *
 * WHAT IS SENT TO LEMON SQUEEZY: the license key and the instance id (plus a
 * fixed instance name on first activation). Nothing else — no page content,
 * no products, no Anthropic key.
 * ------------------------------------------------------------------
 */
globalThis.SubSniper = globalThis.SubSniper || {};

(function (NS) {
  'use strict';

  const UNLIMITED = Object.freeze({ products: Infinity, ai: true });
  const FREE = Object.freeze({ products: NS.LIMITS.FREE_PRODUCTS, ai: false });

  /**
   * @typedef {Object} LicenseCache
   * @property {string}  key          The license key (needed to re-validate).
   * @property {string}  instanceId   Lemon Squeezy instance id from activation.
   * @property {string}  status       'active' | 'inactive' | 'expired' | 'disabled' | other
   * @property {boolean} valid        Server's `valid`/`activated` flag.
   * @property {number}  validatedAt  ms timestamp of the last SUCCESSFUL server check.
   * @property {string}  [productId]  From the server's meta — must match config.
   * @property {string}  [storeId]
   * @property {string}  [variantId]
   *
   * @typedef {Object} LicenseStatus
   * @property {boolean} billing   Is the Pro gate switched on at all?
   * @property {boolean} pro       Server-verified, active subscription.
   * @property {boolean} unlocked  Every feature available (billing off OR pro).
   * @property {string}  reason    Machine-readable explanation for the UI.
   * @property {boolean} stale     Cache is older than REVALIDATE_MS.
   * @property {{products:number, ai:boolean}} limits
   */

  /**
   * THE GATE. Pure and deterministic.
   * @param {Object|null} config   Lemon Squeezy config (billing-config.js shape)
   * @param {LicenseCache|null} cache
   * @param {number} nowMs
   * @returns {LicenseStatus}
   */
  function computeStatus(config, cache, nowMs) {
    const billing = NS.BillingConfig.isBillingEnabled(config);
    if (!billing) {
      return { billing: false, pro: false, unlocked: true, reason: 'billing-disabled', stale: false, limits: UNLIMITED };
    }
    if (!cache || typeof cache !== 'object' || !cache.key) {
      return { billing: true, pro: false, unlocked: false, reason: 'no-license', stale: false, limits: FREE };
    }
    const validatedAt = Number(cache.validatedAt) || 0;
    const age = Math.max(0, (Number(nowMs) || 0) - validatedAt);
    const stale = age > NS.LICENSE.REVALIDATE_MS;

    // Defence in depth: a key from a different product/store is not ours.
    const cfg = config || NS.BillingConfig.LEMON_SQUEEZY;
    if (cache.productId && String(cache.productId) !== String(cfg.productId)) {
      return { billing: true, pro: false, unlocked: false, reason: 'wrong-product', stale, limits: FREE };
    }
    if (cache.storeId && String(cache.storeId) !== String(cfg.storeId)) {
      return { billing: true, pro: false, unlocked: false, reason: 'wrong-store', stale, limits: FREE };
    }

    const active = cache.valid === true && cache.status === 'active';
    if (!active) {
      return { billing: true, pro: false, unlocked: false, reason: cache.status || 'invalid', stale, limits: FREE };
    }
    if (age > NS.LICENSE.GRACE_MS) {
      return { billing: true, pro: false, unlocked: false, reason: 'grace-expired', stale: true, limits: FREE };
    }
    return { billing: true, pro: true, unlocked: true, reason: 'active', stale, limits: UNLIMITED };
  }

  // ── Messaging to the background worker (which owns every network call) ────
  function inWorker() {
    return typeof window === 'undefined';
  }
  function send(msg) {
    return new Promise((resolve) => {
      try {
        if (typeof chrome === 'undefined' || !chrome.runtime || !chrome.runtime.sendMessage || inWorker()) {
          return resolve({ ok: false, error: 'Extension messaging unavailable.' });
        }
        chrome.runtime.sendMessage(msg, (resp) => {
          if (chrome.runtime.lastError) {
            resolve({ ok: false, error: chrome.runtime.lastError.message });
          } else {
            resolve(resp || { ok: false, error: 'No response from background.' });
          }
        });
      } catch (e) {
        resolve({ ok: false, error: String((e && e.message) || e) });
      }
    });
  }

  // Throttle background re-validation requests per page/context.
  let lastRevalidateRequest = 0;
  const REVALIDATE_THROTTLE_MS = 10 * 60 * 1000;
  function requestRevalidate() {
    const now = Date.now();
    if (now - lastRevalidateRequest < REVALIDATE_THROTTLE_MS) return;
    lastRevalidateRequest = now;
    send({ type: NS.MSG.LICENSE_VALIDATE }); // fire-and-forget
  }

  const License = {
    computeStatus,
    UNLIMITED,
    FREE,

    /** Is the Pro gate switched on (all billing-config fields set)? */
    isBillingEnabled() {
      return NS.BillingConfig.isBillingEnabled();
    },

    /** @returns {Promise<LicenseStatus>} */
    async getStatus() {
      const cache = await NS.Storage.getLicenseCache();
      const status = computeStatus(NS.BillingConfig.LEMON_SQUEEZY, cache, Date.now());
      // Keep the cache fresh in the background; the current answer stands.
      if (status.billing && cache && cache.key && status.stale) requestRevalidate();
      return status;
    },

    async isPro() {
      return (await this.getStatus()).pro;
    },

    async isUnlocked() {
      return (await this.getStatus()).unlocked;
    },

    /**
     * Activate a license key. The background worker calls Lemon Squeezy and
     * writes the verified result to the cache; this just relays.
     * @returns {Promise<{ok:boolean, pro:boolean, error?:string, status?:string}>}
     */
    async activate(key) {
      const clean = (key || '').trim();
      if (!clean) return { ok: false, pro: false, error: 'Enter your license key.' };
      if (!this.isBillingEnabled()) return { ok: false, pro: false, error: 'Billing is not enabled in this build.' };
      const res = await send({ type: NS.MSG.LICENSE_ACTIVATE, key: clean });
      return res && typeof res === 'object' ? res : { ok: false, pro: false, error: 'Activation failed.' };
    },

    /** Force a server re-check now. */
    async revalidate() {
      return send({ type: NS.MSG.LICENSE_VALIDATE });
    },

    /** Release this device's activation and clear the cache. */
    async deactivate() {
      return send({ type: NS.MSG.LICENSE_DEACTIVATE });
    },

    /** Open the Lemon Squeezy checkout (via the worker; allow-listed URL). */
    startCheckout() {
      if (!this.isBillingEnabled()) return;
      const url = NS.BillingConfig.LEMON_SQUEEZY.checkoutUrl;
      send({ type: NS.MSG.OPEN_CHECKOUT, url }).then((res) => {
        if (!(res && res.ok) && typeof window !== 'undefined' && window.open) {
          window.open(url, '_blank', 'noopener');
        }
      });
    },

    /** Gate helper: can another product be tracked? */
    async canAddProduct(currentCount) {
      const s = await this.getStatus();
      if (s.unlocked) return { allowed: true, limit: Infinity, billing: s.billing };
      return { allowed: currentCount < s.limits.products, limit: s.limits.products, billing: s.billing };
    },

    /** Gate helper: are AI drafts available? */
    async canUseAi() {
      const s = await this.getStatus();
      return { allowed: s.unlocked || s.limits.ai, billing: s.billing, pro: s.pro };
    }
  };

  NS.License = License;
})(globalThis.SubSniper);
