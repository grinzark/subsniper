/**
 * SubSniper — billing-config.js
 * ------------------------------------------------------------------
 * THE BILLING SWITCH. One place to turn the Pro gate on or off.
 *
 * Lemon Squeezy (https://lemonsqueezy.com) is the Merchant of Record: it
 * handles checkout, VAT/sales tax, recurring subscriptions, and issues a
 * license key per subscription. SubSniper verifies that key SERVER-SIDE via
 * the Lemon Squeezy License API from the background worker — never with a
 * client-only check.
 *
 * BEHAVIOUR:
 *   • Any field empty  ⇒ billing is OFF. The extension is free-only: every
 *                        feature unlocked, no upgrade CTAs, no license UI.
 *                        (This is how v0.1.0 ships.)
 *   • All fields set   ⇒ billing is ON. Free = 1 tracked product + template
 *                        drafts. Pro = unlimited products + AI drafts.
 *                        "Upgrade" opens checkoutUrl.
 *
 * TO GO LIVE, fill in all four values from your Lemon Squeezy dashboard:
 *   storeId     Settings → Stores → the numeric id (e.g. "12345")
 *   productId   Products → your SubSniper Pro product → numeric id
 *   variantId   The subscription variant's numeric id (monthly/yearly)
 *   checkoutUrl The product's share/checkout link, e.g.
 *               "https://<store>.lemonsqueezy.com/checkout/buy/<variant-uuid>"
 *
 * The license key must have "Generate license keys" enabled on the product.
 * ------------------------------------------------------------------
 */
globalThis.SubSniper = globalThis.SubSniper || {};

(function (NS) {
  'use strict';

  const LEMON_SQUEEZY = {
    storeId: '',
    productId: '',
    variantId: '',
    checkoutUrl: ''
  };

  /**
   * Billing is enabled only when EVERY field is a non-empty string and the
   * checkout URL is an https Lemon Squeezy link. Anything less ⇒ off.
   * Pure; also used by the unit tests with explicit config objects.
   * @param {Object} [cfg] override (tests) — defaults to LEMON_SQUEEZY
   */
  function isBillingEnabled(cfg) {
    const c = cfg || LEMON_SQUEEZY;
    if (!c) return false;
    const fields = ['storeId', 'productId', 'variantId', 'checkoutUrl'];
    for (const f of fields) {
      if (typeof c[f] !== 'string' || !c[f].trim()) return false;
    }
    return /^https:\/\/[a-z0-9.-]+\.lemonsqueezy\.com\//i.test(c.checkoutUrl.trim());
  }

  NS.BillingConfig = {
    LEMON_SQUEEZY,
    isBillingEnabled,
    /** Public license endpoints (no API key needed). */
    LEMON_API_ORIGIN: 'https://api.lemonsqueezy.com/',
    LEMON_ACTIVATE_URL: 'https://api.lemonsqueezy.com/v1/licenses/activate',
    LEMON_VALIDATE_URL: 'https://api.lemonsqueezy.com/v1/licenses/validate',
    LEMON_DEACTIVATE_URL: 'https://api.lemonsqueezy.com/v1/licenses/deactivate'
  };
})(globalThis.SubSniper);
