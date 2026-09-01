/**
 * SubSniper — license.test.mjs
 * Run with:  node --test src/common/license.test.mjs
 *
 * Tests THE GATE — License.computeStatus — which is a pure function of
 * (billing config, cached server result, now). We evaluate the real shipped
 * files (constants.js, billing-config.js, license.js) against a stub
 * namespace so the test can never drift from the code.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
globalThis.SubSniper = {};
for (const f of ['constants.js', 'billing-config.js', 'license.js']) {
  // eslint-disable-next-line no-new-func
  new Function(readFileSync(join(__dirname, f), 'utf8'))();
}
const { License, BillingConfig, LICENSE } = globalThis.SubSniper;

const H = 60 * 60 * 1000;
const D = 24 * H;
const NOW = 1_800_000_000_000; // fixed clock

const EMPTY_CFG = { storeId: '', productId: '', variantId: '', checkoutUrl: '' };
const LIVE_CFG = {
  storeId: '12345',
  productId: '67890',
  variantId: '11111',
  checkoutUrl: 'https://moe.lemonsqueezy.com/checkout/buy/abc-123'
};
const activeCache = (overrides) => Object.assign({
  key: 'XXXX-YYYY-ZZZZ',
  instanceId: 'inst-1',
  status: 'active',
  valid: true,
  validatedAt: NOW - 1 * H,
  productId: '67890',
  storeId: '12345',
  variantId: '11111'
}, overrides || {});

test('shipped billing-config is EMPTY ⇒ billing disabled out of the box', () => {
  assert.equal(BillingConfig.isBillingEnabled(), false);
  assert.equal(License.isBillingEnabled(), false);
});

test('config empty ⇒ free-only, everything unlocked, no gate', () => {
  const s = License.computeStatus(EMPTY_CFG, null, NOW);
  assert.equal(s.billing, false);
  assert.equal(s.pro, false);
  assert.equal(s.unlocked, true);
  assert.equal(s.reason, 'billing-disabled');
  assert.equal(s.limits.products, Infinity);
  assert.equal(s.limits.ai, true);
  // Even a perfect cache changes nothing when billing is off.
  assert.equal(License.computeStatus(EMPTY_CFG, activeCache(), NOW).unlocked, true);
});

test('partially-filled config ⇒ still disabled (all four fields required)', () => {
  for (const missing of ['storeId', 'productId', 'variantId', 'checkoutUrl']) {
    const cfg = Object.assign({}, LIVE_CFG, { [missing]: '' });
    assert.equal(BillingConfig.isBillingEnabled(cfg), false, 'missing ' + missing);
    assert.equal(License.computeStatus(cfg, activeCache(), NOW).unlocked, true);
  }
});

test('checkoutUrl must be an https lemonsqueezy.com link', () => {
  assert.equal(BillingConfig.isBillingEnabled(Object.assign({}, LIVE_CFG, { checkoutUrl: 'http://moe.lemonsqueezy.com/x' })), false);
  assert.equal(BillingConfig.isBillingEnabled(Object.assign({}, LIVE_CFG, { checkoutUrl: 'https://evil.example.com/x' })), false);
  assert.equal(BillingConfig.isBillingEnabled(LIVE_CFG), true);
});

test('config set + no license ⇒ Free tier gate is ON', () => {
  const s = License.computeStatus(LIVE_CFG, null, NOW);
  assert.equal(s.billing, true);
  assert.equal(s.pro, false);
  assert.equal(s.unlocked, false);
  assert.equal(s.reason, 'no-license');
  assert.equal(s.limits.products, 1);
  assert.equal(s.limits.ai, false);
});

test('config set + server-verified valid+active ⇒ Pro', () => {
  const s = License.computeStatus(LIVE_CFG, activeCache(), NOW);
  assert.equal(s.pro, true);
  assert.equal(s.unlocked, true);
  assert.equal(s.reason, 'active');
  assert.equal(s.stale, false);
  assert.equal(s.limits.products, Infinity);
  assert.equal(s.limits.ai, true);
});

test('config set + status expired (subscription lapsed) ⇒ Free', () => {
  const s = License.computeStatus(LIVE_CFG, activeCache({ status: 'expired', valid: false }), NOW);
  assert.equal(s.pro, false);
  assert.equal(s.unlocked, false);
  assert.equal(s.reason, 'expired');
  assert.equal(s.limits.ai, false);
});

test('config set + valid:true but status not active ⇒ Free (both required)', () => {
  for (const status of ['inactive', 'disabled', 'expired']) {
    const s = License.computeStatus(LIVE_CFG, activeCache({ status, valid: true }), NOW);
    assert.equal(s.pro, false, status);
    assert.equal(s.reason, status);
  }
});

test('config set + valid:false even with status active ⇒ Free', () => {
  const s = License.computeStatus(LIVE_CFG, activeCache({ valid: false }), NOW);
  assert.equal(s.pro, false);
});

test('cache older than 24h is stale but still Pro (within 3-day grace)', () => {
  const s = License.computeStatus(LIVE_CFG, activeCache({ validatedAt: NOW - 25 * H }), NOW);
  assert.equal(s.pro, true);
  assert.equal(s.stale, true);
  assert.equal(LICENSE.REVALIDATE_MS, 24 * H);
});

test('cache older than 3-day grace ⇒ falls back to Free until re-verified', () => {
  const s = License.computeStatus(LIVE_CFG, activeCache({ validatedAt: NOW - 3 * D - 1 }), NOW);
  assert.equal(s.pro, false);
  assert.equal(s.unlocked, false);
  assert.equal(s.reason, 'grace-expired');
  assert.equal(LICENSE.GRACE_MS, 3 * D);
  // Exactly at the boundary is still inside grace.
  assert.equal(License.computeStatus(LIVE_CFG, activeCache({ validatedAt: NOW - 3 * D }), NOW).pro, true);
});

test('a key for a different product or store is rejected', () => {
  assert.equal(License.computeStatus(LIVE_CFG, activeCache({ productId: '99999' }), NOW).reason, 'wrong-product');
  assert.equal(License.computeStatus(LIVE_CFG, activeCache({ storeId: '1' }), NOW).reason, 'wrong-store');
});

test('gate is deterministic', () => {
  const a = License.computeStatus(LIVE_CFG, activeCache(), NOW);
  const b = License.computeStatus(LIVE_CFG, activeCache(), NOW);
  assert.deepEqual(a, b);
});
