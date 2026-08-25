/**
 * SubSniper — constants.js
 * ------------------------------------------------------------------
 * Namespace bootstrap + config defaults + score thresholds.
 *
 * ZERO-BUILD design: this is a plain classic script (NOT an ES module).
 * It attaches everything to a single shared global object so that content
 * scripts injected in order — and extension pages that include the same
 * files via <script> tags — all share one namespace without imports.
 *
 * Load order matters: constants.js MUST be first.
 * ------------------------------------------------------------------
 */
globalThis.SubSniper = globalThis.SubSniper || {};

(function (NS) {
  'use strict';

  /** Semantic version, mirrored in manifest.json. */
  NS.VERSION = '1.0.0';

  /**
   * Score buckets. A candidate's 0–100 score maps to exactly one bucket.
   * Hot ≥ 70, Warm 40–69, Cold < 40.
   */
  NS.THRESHOLDS = Object.freeze({ HOT: 70, WARM: 40 });

  NS.BUCKETS = Object.freeze({ HOT: 'hot', WARM: 'warm', COLD: 'cold' });

  /** Human labels + accent colors per bucket (used by badges + sidebar). */
  NS.BUCKET_META = Object.freeze({
    hot:  { label: 'Hot',  emoji: '🔥', color: '#ff4500' },
    warm: { label: 'Warm', emoji: '🌤', color: '#ff9800' },
    cold: { label: 'Cold', emoji: '❄️', color: '#5c6bc0' }
  });

  /** Free-tier limits. Pro removes all of these (see license.js). */
  NS.LIMITS = Object.freeze({
    FREE_PRODUCTS: 1,
    FREE_LEADS: 15
  });

  /** Draft tone presets exposed in the composer. */
  NS.TONES = Object.freeze(['helpful', 'concise', 'founder-to-founder']);

  /**
   * Anthropic models offered for the OPTIONAL, user-initiated AI draft mode.
   * Default is claude-sonnet-5 (fast + cheap enough for short replies).
   * The user brings their own API key; nothing is called without it.
   */
  NS.MODELS = Object.freeze([
    { id: 'claude-sonnet-5',  label: 'Claude Sonnet 5 (default — fast, cheap)' },
    { id: 'claude-opus-5',    label: 'Claude Opus 5 (most capable)' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5 (cheapest)' }
  ]);
  NS.ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
  NS.ANTHROPIC_VERSION = '2023-06-01';

  /** Message types passed between content ⇄ background ⇄ popup/options. */
  NS.MSG = Object.freeze({
    OPEN_CHECKOUT: 'subsniper:open-checkout',
    AI_DRAFT: 'subsniper:ai-draft',
    PING: 'subsniper:ping'
  });

  /** chrome.storage keys. Settings live in sync, leads in local. */
  NS.KEYS = Object.freeze({
    SETTINGS: 'subsniper_settings',
    LEADS: 'subsniper_leads',
    STATS: 'subsniper_stats'
  });

  /**
   * Factory so every read gets a fresh, un-shared copy (no accidental
   * mutation of the defaults object).
   * @returns {Object} default settings
   */
  NS.defaultSettings = function defaultSettings() {
    return {
      enabled: true,
      // A starter product so the extension does something on first load.
      // The user edits/replaces this in Options.
      products: [
        {
          id: 'demo-' + Date.now().toString(36),
          name: 'My product',
          keywords: ['crm', 'lead tracking', 'sales pipeline'],
          synonyms: ['customer relationship', 'contact manager', 'pipeline tool'],
          pitch: 'a lightweight CRM that tracks leads without the enterprise bloat',
          url: 'https://example.com'
        }
      ],
      // null ⇒ use the engine's built-in lexicon. Options can materialise a
      // full editable copy here to tune weights.
      intentLexicon: null,
      anthropicKey: '',
      model: 'claude-sonnet-5',
      draftTone: 'helpful',
      minScoreToBadge: 40,
      license: { pro: false, key: '' }
    };
  };

  NS.defaultStats = function defaultStats() {
    return { day: NS.todayKey(), found: 0, saved: 0 };
  };

  /** YYYY-MM-DD in local time — used to reset "leads found today". */
  NS.todayKey = function todayKey(d) {
    d = d || new Date();
    const p = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
  };

  /** Tiny id generator (no crypto dependency needed for local ids). */
  NS.uid = function uid(prefix) {
    return (prefix || 'id') + '-' +
      Date.now().toString(36) + '-' +
      Math.random().toString(36).slice(2, 8);
  };
})(globalThis.SubSniper);
