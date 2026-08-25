/**
 * SubSniper — intent-engine.test.mjs
 * Run with:  node --test src/common/intent-engine.test.mjs
 *
 * intent-engine.js is a classic script that attaches to globalThis.SubSniper.
 * We load the SAME source the extension ships (no duplicate logic) by reading
 * the file and evaluating it against a stubbed namespace, then assert on the
 * public API. This keeps the test honest — it tests the shipped file.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Minimal constants the engine reads from the namespace.
globalThis.SubSniper = {
  THRESHOLDS: { HOT: 70, WARM: 40 },
  BUCKETS: { HOT: 'hot', WARM: 'warm', COLD: 'cold' }
};

// Load + evaluate the real intent-engine.js in this global scope.
const src = readFileSync(join(__dirname, 'intent-engine.js'), 'utf8');
// eslint-disable-next-line no-new-func
new Function(src)();

const { IntentEngine } = globalThis.SubSniper;
const PRODUCTS = [
  {
    id: 'p1',
    name: 'CRM',
    keywords: ['crm', 'lead tracking'],
    synonyms: ['contact manager', 'pipeline tool']
  }
];

test('exposes a stable public API', () => {
  assert.equal(typeof IntentEngine.scoreCandidate, 'function');
  assert.equal(typeof IntentEngine.bucketFor, 'function');
  assert.ok(Array.isArray(IntentEngine.DEFAULT_INTENT_LEXICON));
});

test('relevance gate: no product mention ⇒ not a lead, score 0', () => {
  const r = IntentEngine.scoreCandidate(
    { text: 'Looking for a great pizza place in Brooklyn, any recommendations?' },
    PRODUCTS
  );
  assert.equal(r.isLead, false);
  assert.equal(r.score, 0);
  assert.equal(r.product, null);
});

test('empty / missing input is handled gracefully', () => {
  assert.equal(IntentEngine.scoreCandidate({ text: '' }, PRODUCTS).isLead, false);
  assert.equal(IntentEngine.scoreCandidate({}, PRODUCTS).isLead, false);
  assert.equal(IntentEngine.scoreCandidate({ text: 'crm' }, []).isLead, false);
  assert.equal(IntentEngine.scoreCandidate(null, PRODUCTS).isLead, false);
});

test('hot lead: strong buying intent + relevance scores ≥70', () => {
  const r = IntentEngine.scoreCandidate(
    {
      text: 'Looking for a good alternative to my current CRM — anyone use something cheaper? Frustrated with the pricing.',
      type: 'post'
    },
    PRODUCTS
  );
  assert.equal(r.isLead, true);
  assert.ok(r.score >= 70, 'expected hot, got ' + r.score);
  assert.equal(r.bucket, 'hot');
  assert.equal(r.product.id, 'p1');
  // Explainability: the reasons must include the intent signals we matched.
  const labels = r.reasons.map((x) => x.label).join(' | ');
  assert.match(labels, /alternative/i);
  assert.match(labels, /price/i);
});

test('cold lead: bare mention with no intent stays Cold', () => {
  const r = IntentEngine.scoreCandidate(
    { text: 'We migrated our contact manager data last year and it was fine.' },
    PRODUCTS
  );
  assert.equal(r.isLead, true);
  assert.ok(r.score < 40, 'expected cold, got ' + r.score);
  assert.equal(r.bucket, 'cold');
});

test('self-promo negative signal reduces score below a genuine buyer', () => {
  const buyer = IntentEngine.scoreCandidate(
    { text: 'Looking for a CRM recommendation, what do you use?' },
    PRODUCTS
  );
  const promoter = IntentEngine.scoreCandidate(
    { text: 'I built a CRM — check out my app! Looking for a recommendation on marketing it.' },
    PRODUCTS
  );
  assert.ok(promoter.score < buyer.score, 'self-promo should score lower');
  assert.ok(promoter.reasons.some((x) => x.type === 'negative'));
});

test('scoring is deterministic', () => {
  const c = { text: 'Any tool to help with lead tracking? Wish there was a cheaper option.' };
  const a = IntentEngine.scoreCandidate(c, PRODUCTS);
  const b = IntentEngine.scoreCandidate(c, PRODUCTS);
  assert.deepEqual(a, b);
});

test('bucketFor maps thresholds correctly', () => {
  assert.equal(IntentEngine.bucketFor(85), 'hot');
  assert.equal(IntentEngine.bucketFor(70), 'hot');
  assert.equal(IntentEngine.bucketFor(69), 'warm');
  assert.equal(IntentEngine.bucketFor(40), 'warm');
  assert.equal(IntentEngine.bucketFor(39), 'cold');
  assert.equal(IntentEngine.bucketFor(0), 'cold');
});

test('user-overridable weights change the outcome', () => {
  const text = { text: 'Any recommendation for a CRM?' };
  const base = IntentEngine.scoreCandidate(text, PRODUCTS);
  const boosted = IntentEngine.cloneDefaultLexicon().map((e) =>
    e.id === 'recommend' ? Object.assign({}, e, { weight: 60 }) : e
  );
  const tuned = IntentEngine.scoreCandidate(text, PRODUCTS, { lexicon: boosted });
  assert.ok(tuned.score > base.score, 'raising a weight should raise the score');
});
