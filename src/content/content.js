/**
 * SubSniper — content.js  (orchestrator)
 * ------------------------------------------------------------------
 * On load + on a throttled MutationObserver:
 *   1. pull candidates from the DOM (dom-reddit.js)  — read only
 *   2. score each against the tracked products       (intent-engine.js)
 *   3. inject an intent badge on qualifying posts/comments
 *   4. feed the leads to the sidebar
 *
 * Respects the global on/off toggle (settings.enabled). Never writes to Reddit.
 * ------------------------------------------------------------------
 */
(function (NS) {
  'use strict';

  const BADGE_ATTR = 'data-subsniper-badge';
  const PROCESSED = new WeakSet(); // nodes we've already badged this DOM state

  const state = {
    settings: null,
    lexicon: null,
    leadsById: new Map(), // id → scored lead (with node)
    scanScheduled: false,
    observer: null,
    booted: false
  };

  function activeProducts() {
    return (state.settings.products || []).filter(
      (p) => p && p.name && ((p.keywords || []).length || (p.synonyms || []).length)
    );
  }

  function currentLexicon() {
    const custom = state.settings.intentLexicon;
    return Array.isArray(custom) && custom.length ? custom : NS.IntentEngine.DEFAULT_INTENT_LEXICON;
  }

  /** Build/refresh the badge on a candidate's node. */
  function paintBadge(candidate, result) {
    const node = candidate.node;
    if (!node || !node.isConnected) return;

    // Don't badge below the user's threshold.
    const minScore = Number(state.settings.minScoreToBadge) || 0;
    let badge = node.querySelector(':scope > [' + BADGE_ATTR + ']') ||
      findExistingBadge(node);

    if (result.score < minScore) {
      if (badge) badge.remove();
      return;
    }

    const meta = NS.BUCKET_META[result.bucket] || NS.BUCKET_META.cold;
    if (!badge) {
      badge = document.createElement('button');
      badge.setAttribute(BADGE_ATTR, candidate.id);
      badge.className = 'subsniper-badge';
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        NS.Sidebar.open(candidate.id);
      }, true);
      // Anchor: make the host positioned so absolute badge sits nicely.
      try {
        const cs = getComputedStyle(node);
        if (cs.position === 'static') node.style.position = 'relative';
      } catch (_e) { /* ignore */ }
      node.appendChild(badge);
    }
    badge.dataset.bucket = result.bucket;
    badge.title = 'SubSniper: ' + meta.label + ' lead · score ' + result.score + ' — click for why';
    badge.innerHTML =
      '<span class="subsniper-badge-dot"></span>' +
      '<span class="subsniper-badge-score">' + result.score + '</span>' +
      '<span class="subsniper-badge-label">' + meta.label + '</span>';
  }

  function findExistingBadge(node) {
    const all = node.querySelectorAll('[' + BADGE_ATTR + ']');
    for (const b of all) {
      // Only treat a badge as "this node's" if it's a direct-ish child.
      if (b.parentElement === node) return b;
    }
    return null;
  }

  function scan() {
    state.scanScheduled = false;
    if (!state.settings || !state.settings.enabled) return;
    const products = activeProducts();
    if (!products.length) {
      NS.Sidebar.update([], state.settings);
      return;
    }

    let candidates;
    try {
      candidates = NS.DomReddit.collectCandidates();
    } catch (e) {
      return; // Reddit markup changed mid-scan; try again next tick.
    }

    const lexicon = currentLexicon();
    const pageLeads = [];
    let newFound = 0;

    for (const cand of candidates) {
      let result;
      try {
        result = NS.IntentEngine.scoreCandidate(cand, products, { lexicon });
      } catch (_e) { continue; }
      if (!result.isLead) continue;

      const lead = {
        id: cand.id,
        node: cand.node,
        text: cand.text,
        snippet: cand.text,
        title: cand.title,
        author: cand.author,
        subreddit: cand.subreddit || NS.DomReddit.pageSubreddit(),
        type: cand.type,
        permalink: cand.permalink,
        score: result.score,
        bucket: result.bucket,
        reasons: result.reasons,
        product: result.product,
        productId: result.product && result.product.id
      };

      if (!state.leadsById.has(cand.id)) newFound++;
      state.leadsById.set(cand.id, lead);
      pageLeads.push(lead);

      if (!PROCESSED.has(cand.node)) {
        PROCESSED.add(cand.node);
      }
      paintBadge(cand, result);
    }

    if (newFound > 0) NS.Storage.bumpStat('found', newFound);

    // Mark which page leads are already saved (so the button shows ✓).
    markSaved(pageLeads).then((withSaved) => {
      NS.Sidebar.update(withSaved, state.settings);
    });
  }

  async function markSaved(pageLeads) {
    try {
      const saved = await NS.Storage.getLeads();
      const savedIds = new Set(saved.filter((l) => !l.dismissed).map((l) => l.id));
      pageLeads.forEach((l) => { l.saved = savedIds.has(l.id); });
    } catch (_e) { /* ignore */ }
    return pageLeads;
  }

  function scheduleScan() {
    if (state.scanScheduled) return;
    state.scanScheduled = true;
    // Throttle: coalesce bursts of mutations into one scan.
    setTimeout(scan, 400);
  }

  function startObserver() {
    if (state.observer) return;
    const obs = new MutationObserver((mutations) => {
      // Ignore mutations caused by our own badge/sidebar DOM.
      for (const m of mutations) {
        const t = m.target;
        if (t && t.nodeType === 1) {
          if (t.closest && (t.closest('#subsniper-root') || t.hasAttribute(BADGE_ATTR))) continue;
        }
        scheduleScan();
        break;
      }
    });
    obs.observe(document.body || document.documentElement, {
      childList: true, subtree: true
    });
    state.observer = obs;
  }

  function applyEnabled() {
    const on = !!(state.settings && state.settings.enabled);
    NS.Sidebar.setVisible(on);
    if (on) {
      startObserver();
      scheduleScan();
    } else {
      // Remove badges when turned off.
      document.querySelectorAll('[' + BADGE_ATTR + ']').forEach((b) => b.remove());
    }
  }

  async function boot() {
    if (state.booted) return;
    state.booted = true;
    state.settings = await NS.Storage.getSettings();

    NS.Sidebar.init({
      onChange: () => { scheduleScan(); }
    });

    applyEnabled();

    // React to settings changes from popup/options in real time.
    NS.Storage.onSettingsChanged((next) => {
      const wasEnabled = state.settings && state.settings.enabled;
      state.settings = next;
      if (wasEnabled !== next.enabled) applyEnabled();
      else scheduleScan();
    });

    // Reddit is an SPA — re-scan on history navigation.
    window.addEventListener('popstate', scheduleScan);
    const origPush = history.pushState;
    history.pushState = function () {
      const r = origPush.apply(this, arguments);
      // Clear the page-lead map on navigation.
      state.leadsById.clear();
      scheduleScan();
      return r;
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})(globalThis.SubSniper);
