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
 *   • storeId, productId or checkoutUrl empty ⇒ billing is OFF. The extension
 *                        is free-only: every feature unlocked, no upgrade CTAs,
 *                        no license UI.
 *   • all three set    ⇒ billing is ON. Free = 1 tracked product + template
 *                        drafts. Pro = unlimited products + AI drafts.
 *                        "Upgrade" opens checkoutUrl.
 *   • variantId is OPTIONAL. It is never used for verification — the worker
 *     enforces store_id + product_id on the server's response and merely
 *     caches meta.variant_id. Fill it in later from the first activated
 *     license (Options → Plan & license shows "variant <id>" once active).
 *
 * LIVE CONFIG (v0.2.0) — Lemon Squeezy store "Zarkside":
 *   storeId     465122
 *   productId   1332124   SubSniper Pro — £29.00/month subscription,
 *                         license keys ON, activation limit 5
 *   checkoutUrl the product's checkout link (below)
 *   variantId   (not exposed in the LS dashboard without an API key — left
 *                empty; optional, see above)
 *
 * The license key must have "Generate license keys" enabled on the product.
 * ------------------------------------------------------------------
 */
globalThis.SubSniper = globalThis.SubSniper || {};

(function (NS) {
  'use strict';

  const LEMON_SQUEEZY = {
    storeId: '465122',
    productId: '1332124',
    variantId: '',   // optional — fill from the first license's meta.variant_id
    checkoutUrl: 'https://zarkside.lemonsqueezy.com/checkout/buy/a59439d9-cae6-4d63-9fbf-8c06dd6908d9'
  };

  /**
   * Billing is enabled when storeId, productId and checkoutUrl are non-empty
   * strings and the checkout URL is an https Lemon Squeezy link. variantId is
   * OPTIONAL and does not affect this. Pure; the unit tests pass explicit
   * config objects.
   * @param {Object} [cfg] override (tests) — defaults to LEMON_SQUEEZY
   */
  function isBillingEnabled(cfg) {
    const c = cfg || LEMON_SQUEEZY;
    if (!c) return false;
    const required = ['storeId', 'productId', 'checkoutUrl'];
    for (const f of required) {
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
