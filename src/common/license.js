/**
 * SubSniper — license.js
 * ------------------------------------------------------------------
 * v0.1.0 SHIPS FREE-ONLY. Every feature is unlocked. There is no paywall,
 * no "Upgrade" CTA, and no license key to enter.
 *
 * WHY (this is a deliberate correctness decision, not an omission):
 *   The previous build gated Pro behind a LOCAL checksum check and shipped a
 *   generateDemoKey() helper inside the bundle — anyone reading the extension
 *   source could mint a valid key in seconds. On top of that, no billing
 *   product exists yet, so every "Upgrade to Pro" link 404'd. Shipping a
 *   paywall that is both bypassable and unbuyable is dishonest to users and a
 *   store-review risk. So the gate is simply OFF until real billing exists.
 *
 * ── HOW TO RE-INTRODUCE REAL GATING (when a product actually exists) ────────
 *
 * The non-negotiable rule: a license check is only meaningful if it is
 * VERIFIED SERVER-SIDE. Never ship a check the client can satisfy alone.
 *
 * Option A — ExtensionPay (https://extensionpay.com), easiest for extensions:
 *   1. Create an account, register the extension id `subsniper`.
 *   2. In the background worker:
 *        const extpay = ExtPay('subsniper');
 *        extpay.startBackground();
 *   3. Gate on the server-provided flag:
 *        const user = await extpay.getUser();   //  user.paid
 *   4. Checkout: extpay.openPaymentPage().
 *
 * Option B — Gumroad license keys (https://gumroad.com):
 *   1. Sell a membership product; enable "Generate license keys".
 *   2. Verify from the BACKGROUND WORKER (never the content script):
 *        POST https://api.gumroad.com/v2/licenses/verify
 *             { product_id, license_key, increment_uses_count: false }
 *   3. Grant Pro only when:
 *        success && !purchase.refunded && !purchase.subscription_ended_at
 *      Cache the result with a TTL and re-verify periodically; treat a failed
 *      verification as "not Pro" rather than falling back to a local check.
 *   4. Requires adding https://api.gumroad.com/* to host permissions.
 *
 * Until one of the above is wired up, getStatus() reports everything unlocked.
 * ------------------------------------------------------------------
 */
globalThis.SubSniper = globalThis.SubSniper || {};

(function (NS) {
  'use strict';

  const License = {
    /**
     * @returns {Promise<{pro:boolean, unlocked:boolean, limits:Object}>}
     *   unlocked=true means every feature is available. pro=false because no
     *   paid tier exists yet — nothing in the UI should advertise one.
     */
    async getStatus() {
      return {
        pro: false,
        unlocked: true,
        free: true,
        limits: { products: Infinity, leads: Infinity, ai: true }
      };
    },

    /** Every feature is available in v0.1.0. */
    async isUnlocked() {
      return true;
    },

    /** No paid tier exists yet. Kept so callers can ask without branching. */
    async isPro() {
      return false;
    },

    /** No cap in v0.1.0. */
    async canSaveLead() {
      return { allowed: true };
    },

    /** No cap in v0.1.0. */
    async canAddProduct() {
      return { allowed: true };
    }
  };

  NS.License = License;
})(globalThis.SubSniper);
