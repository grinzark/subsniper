/**
 * SubSniper — intent-engine.js  (THE CROWN JEWEL)
 * ------------------------------------------------------------------
 * A pure, deterministic, EXPLAINABLE local buying-intent scorer.
 *
 * Design principles
 *  1. Pure & deterministic — no DOM, no network, no clock. Same input ⇒ same
 *     output. This makes it unit-testable (see intent-engine.test.mjs).
 *  2. Relevance is a GATE. If the text doesn't mention one of the user's
 *     tracked products (a keyword or synonym hit), it is NOT your lead — score
 *     0, isLead=false. We never surface random high-intent posts about
 *     something else.
 *  3. Explainable. Every point is attributable. We return the exact matched
 *     signals ("reasons") so the UI can show WHY a post scored the way it did.
 *  4. Tunable. Weights come from a lexicon that the user can override in
 *     Options; pass the merged lexicon in via opts.lexicon.
 *
 * Scoring model (all additive, then clamped to 0–100):
 *     raw = relevanceBase
 *         + Σ positive-signal weights (each signal counts once)
 *         + questionBonus
 *         − Σ negative-signal weights (self-promo etc.)
 *     score  = clamp(round(raw), 0, 100)
 *     bucket = Hot ≥70 · Warm 40–69 · Cold <40
 *
 * @typedef {Object} Product
 * @property {string} id
 * @property {string} name
 * @property {string[]} keywords    Required-match terms (strong relevance).
 * @property {string[]} synonyms    Softer relevance terms.
 * @property {string} [pitch]
 * @property {string} [url]
 *
 * @typedef {Object} Candidate
 * @property {string} text          The post/comment body (+title) to score.
 * @property {string} [author]
 * @property {string} [subreddit]
 * @property {('post'|'comment')} [type]
 *
 * @typedef {Object} Reason
 * @property {('relevance'|'intent'|'negative'|'bonus')} type
 * @property {string} label         Human-readable ("Looking for a solution").
 * @property {number} weight        Signed points contributed.
 * @property {string} match         The literal phrase/keyword that matched.
 *
 * @typedef {Object} LexEntry
 * @property {string} id
 * @property {string} label
 * @property {('positive'|'negative')} kind
 * @property {number} weight
 * @property {string[]} phrases
 *
 * @typedef {Object} ScoreResult
 * @property {number} score         0–100
 * @property {('hot'|'warm'|'cold')} bucket
 * @property {boolean} isLead       false ⇒ no product relevance, ignore it.
 * @property {Reason[]} reasons     Sorted strongest-first, for the UI.
 * @property {?Product} product     The best-matched product (or null).
 * @property {number} relevanceHits Count of keyword+synonym hits.
 * ------------------------------------------------------------------
 */
globalThis.SubSniper = globalThis.SubSniper || {};

(function (NS) {
  'use strict';

  /**
   * Default buying-intent lexicon. Each entry fires at most once per candidate
   * (matching multiple phrases in one entry does NOT stack). Weights are tuned
   * so that a genuinely hot lead ("looking for an alternative to X, anyone use
   * something cheaper?") lands ≥70 while a passing mention stays Cold.
   * @type {LexEntry[]}
   */
  const DEFAULT_INTENT_LEXICON = [
    // ── Positive: active demand ────────────────────────────────────────────
    { id: 'looking-for', kind: 'positive', weight: 18, label: 'Actively looking for a solution',
      phrases: ['looking for', 'in search of', 'searching for', 'trying to find', 'need to find', 'need a', 'need an', 'need something', 'need some help with'] },
    { id: 'buying', kind: 'positive', weight: 18, label: 'Ready to buy',
      phrases: ['want to buy', 'ready to buy', 'looking to purchase', 'shopping for', 'in the market for', 'happy to pay', 'willing to pay', 'take my money'] },
    { id: 'alternative-to', kind: 'positive', weight: 20, label: 'Wants an alternative / replacement',
      phrases: ['alternative to', 'alternatives to', 'replacement for', 'instead of', 'switch from', 'switching from', 'migrate from', 'moving away from', 'ditch'] },
    { id: 'recommend', kind: 'positive', weight: 16, label: 'Asking for a recommendation',
      phrases: ['recommend', 'recommendation', 'recommendations', 'suggestions', 'any suggestions', 'what do you use', 'what should i use', 'what are you using', 'go-to tool', 'what tool'] },
    { id: 'any-tool', kind: 'positive', weight: 15, label: 'Looking for any tool/app that does X',
      phrases: ['any tool', 'any app', 'any service', 'any software', 'any platform', 'is there a tool', 'is there an app', 'is there a', 'is there any', 'a tool that', 'an app that'] },
    { id: 'anyone-use', kind: 'positive', weight: 12, label: 'Polling the community',
      phrases: ['anyone use', 'anyone using', 'anybody use', 'does anyone', 'has anyone', 'anyone tried', 'anyone here', 'anyone else'] },
    { id: 'how-do-i', kind: 'positive', weight: 10, label: 'How-to / best-way question',
      phrases: ['how do i', 'how do you', 'how to', 'best way to', 'whats the best way', "what's the best way", 'easiest way to'] },
    { id: 'frustrated', kind: 'positive', weight: 14, label: 'Frustrated with current solution',
      phrases: ['frustrated with', 'fed up with', 'tired of', 'sick of', 'struggling with', 'pain in the', 'such a pain', 'driving me crazy', 'headache'] },
    { id: 'hate-that', kind: 'positive', weight: 12, label: 'Dislikes current option',
      phrases: ['hate that', 'hate how', 'hate when', 'annoyed that', 'so annoying', 'the worst', "doesn't work", 'stopped working', 'keeps breaking'] },
    { id: 'wish-there-was', kind: 'positive', weight: 16, label: 'Wishes a solution existed',
      phrases: ['wish there was', 'wish there were', 'i wish', 'if only there was', 'someone should build', 'someone should make', 'why is there no'] },
    { id: 'worth-it', kind: 'positive', weight: 10, label: 'Evaluating whether to buy',
      phrases: ['worth it', 'worth paying', 'is it worth', 'worth the money', 'should i pay for'] },
    { id: 'pricing', kind: 'positive', weight: 12, label: 'Price-sensitive / evaluating cost',
      phrases: ['pricing', 'how much does', 'how much do you', 'cost per', 'per month', 'monthly cost', 'too expensive', 'free plan', 'free tier', 'budget for', 'cheaper option', 'affordable'] },
    { id: 'comparison', kind: 'positive', weight: 8, label: 'Comparing options',
      phrases: ['vs', 'versus', 'compared to', 'comparison', 'or should i', 'which is better', 'pros and cons'] },

    // ── Negative: self-promo / noise (subtract) ────────────────────────────
    { id: 'self-promo', kind: 'negative', weight: 28, label: 'Self-promotion (not a buyer)',
      phrases: ['i built', 'i made', 'i created', 'i just launched', 'i launched', 'check out my', 'checkout my', "i'm building", 'i am building', "i'm working on", 'my startup', 'my saas', 'my app', 'my product', 'my tool', '[promo]', 'shameless plug', 'use my code', 'sign up for my', 'link in bio', 'dm me for'] },
    { id: 'affiliate', kind: 'negative', weight: 18, label: 'Affiliate / referral spam',
      phrases: ['affiliate', 'referral link', 'ref link', 'commission', 'discount code', 'promo code', 'coupon code'] },
    { id: 'already-solved', kind: 'negative', weight: 10, label: 'Already solved / not looking',
      phrases: ['solved it', 'figured it out', 'never mind', 'nvm', 'already using', 'happy with my', 'no longer looking'] }
  ];

  // Escapes a string for safe inclusion in a RegExp.
  function escapeRe(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Cache compiled matchers per-phrase so repeated scoring is cheap.
  const _matcherCache = new Map();
  function matcherFor(phrase) {
    let m = _matcherCache.get(phrase);
    if (m) return m;
    // Word-boundary regex for clean alphanumeric phrases (avoids matching "vs"
    // inside "vsphere"); substring fallback for phrases with punctuation.
    if (/^[a-z0-9 ]+$/.test(phrase)) {
      m = new RegExp('(^|[^a-z0-9])' + escapeRe(phrase) + '($|[^a-z0-9])', 'i');
      m._kind = 'regex';
    } else {
      m = { _kind: 'includes', phrase: phrase };
    }
    _matcherCache.set(phrase, m);
    return m;
  }

  function phraseMatches(normText, phrase) {
    const m = matcherFor(phrase);
    if (m._kind === 'regex') return m.test(normText);
    return normText.indexOf(m.phrase) !== -1;
  }

  // Normalise text once: lowercase + collapse whitespace. Keeps punctuation so
  // '?' bonus and phrases like "[promo]" still work.
  function normalize(text) {
    return String(text || '').toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /**
   * Count relevance hits for a single product against normalised text.
   * Keyword hits are weighted more than synonym hits.
   * @returns {{keywordHits:number, synonymHits:number, matches:Reason[]}}
   */
  function productRelevance(normText, product) {
    let keywordHits = 0;
    let synonymHits = 0;
    const matches = [];
    (product.keywords || []).forEach((kw) => {
      const k = normalize(kw);
      if (k && phraseMatches(normText, k)) {
        keywordHits++;
        matches.push({ type: 'relevance', label: 'Matches keyword "' + kw + '"', weight: 0, match: kw });
      }
    });
    (product.synonyms || []).forEach((sy) => {
      const s = normalize(sy);
      if (s && phraseMatches(normText, s)) {
        synonymHits++;
        matches.push({ type: 'relevance', label: 'Matches related term "' + sy + '"', weight: 0, match: sy });
      }
    });
    return { keywordHits, synonymHits, matches };
  }

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

  /** Map a 0–100 score to its bucket. */
  function bucketFor(score) {
    if (score >= NS.THRESHOLDS.HOT) return NS.BUCKETS.HOT;
    if (score >= NS.THRESHOLDS.WARM) return NS.BUCKETS.WARM;
    return NS.BUCKETS.COLD;
  }

  /**
   * Score one candidate against the user's tracked products.
   *
   * @param {Candidate} candidate
   * @param {Product[]} products
   * @param {Object} [opts]
   * @param {LexEntry[]} [opts.lexicon]  Override lexicon (from user settings).
   * @returns {ScoreResult}
   */
  function scoreCandidate(candidate, products, opts) {
    opts = opts || {};
    const lexicon = Array.isArray(opts.lexicon) && opts.lexicon.length
      ? opts.lexicon
      : DEFAULT_INTENT_LEXICON;

    const normText = normalize(candidate && candidate.text);
    const empty = {
      score: 0, bucket: NS.BUCKETS.COLD, isLead: false,
      reasons: [], product: null, relevanceHits: 0
    };
    if (!normText || !Array.isArray(products) || products.length === 0) {
      return empty;
    }

    // ── 1. Relevance gate: pick the best-matching product ──────────────────
    let best = null;
    for (const product of products) {
      const rel = productRelevance(normText, product);
      const hits = rel.keywordHits + rel.synonymHits;
      if (hits === 0) continue;
      const relScore = rel.keywordHits * 2 + rel.synonymHits; // weight keywords
      if (!best || relScore > best.relScore) {
        best = { product, rel, hits, relScore };
      }
    }
    if (!best) return empty; // no product relevance ⇒ not your lead.

    const reasons = best.rel.matches.slice();

    // relevanceBase: 12 + up to 3 keyword hits ×6 + up to 2 synonym hits ×4.
    const kw = Math.min(best.rel.keywordHits, 3);
    const sy = Math.min(best.rel.synonymHits, 2);
    const relevanceBase = 12 + kw * 6 + sy * 4;
    let raw = relevanceBase;
    reasons.unshift({
      type: 'relevance',
      label: 'Relevant to "' + best.product.name + '" (' + best.hits + ' hit' + (best.hits === 1 ? '' : 's') + ')',
      weight: relevanceBase,
      match: best.product.name
    });

    // ── 2. Buying-intent + negative signals ────────────────────────────────
    for (const entry of lexicon) {
      let hitPhrase = null;
      for (const phrase of entry.phrases) {
        const p = normalize(phrase);
        if (p && phraseMatches(normText, p)) { hitPhrase = phrase; break; }
      }
      if (!hitPhrase) continue;
      const w = Number(entry.weight) || 0;
      if (entry.kind === 'negative') {
        raw -= w;
        reasons.push({ type: 'negative', label: entry.label, weight: -w, match: hitPhrase });
      } else {
        raw += w;
        reasons.push({ type: 'intent', label: entry.label, weight: w, match: hitPhrase });
      }
    }

    // ── 3. Question bonus (a question is a mild demand signal) ──────────────
    if (normText.indexOf('?') !== -1) {
      raw += 6;
      reasons.push({ type: 'bonus', label: 'Asked a question', weight: 6, match: '?' });
    }

    const score = clamp(Math.round(raw), 0, 100);

    // Sort reasons: relevance first, then by absolute weight (strongest first).
    reasons.sort((a, b) => {
      if (a.type === 'relevance' && b.type !== 'relevance') return -1;
      if (b.type === 'relevance' && a.type !== 'relevance') return 1;
      return Math.abs(b.weight) - Math.abs(a.weight);
    });

    return {
      score,
      bucket: bucketFor(score),
      isLead: true,
      reasons,
      product: best.product,
      relevanceHits: best.hits
    };
  }

  NS.IntentEngine = {
    scoreCandidate,
    bucketFor,
    normalize,
    DEFAULT_INTENT_LEXICON,
    /** Deep clone of the default lexicon, for the Options tuner. */
    cloneDefaultLexicon() {
      return DEFAULT_INTENT_LEXICON.map((e) => Object.assign({}, e, { phrases: e.phrases.slice() }));
    }
  };
})(globalThis.SubSniper);
