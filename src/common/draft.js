/**
 * SubSniper — draft.js
 * ------------------------------------------------------------------
 * Reply composer. Produces a DRAFT the user copies and pastes themselves.
 * NOTHING here posts to Reddit. There is no code path that submits.
 *
 * Two modes:
 *   • LOCAL templates (default, no network) — buildLocalDrafts()
 *       Returns 2–3 non-spammy variants that mirror the person's stated pain,
 *       give one concrete helpful line, and end with a soft, honest mention.
 *       Tone selector: 'helpful' | 'concise' | 'founder-to-founder'.
 *   • AI mode (optional, user's own key) — buildAiRequest()
 *       Returns a fully-formed Anthropic Messages API REQUEST OBJECT. It does
 *       NOT call the network — the background service worker executes it (host
 *       permission lives there). Still just returns text for a copy box.
 * ------------------------------------------------------------------
 */
globalThis.SubSniper = globalThis.SubSniper || {};

(function (NS) {
  'use strict';

  function firstName(author) {
    if (!author) return 'there';
    return author.replace(/^u\//i, '').split(/[-_\d]/)[0] || 'there';
  }

  /** Pull the single most-telling sentence from the lead as the "pain". */
  function extractPain(lead) {
    const text = (lead && (lead.snippet || lead.text)) || '';
    const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
    if (!sentences.length) return '';
    // Prefer a sentence that reads like a problem/question.
    const painCue = /(looking for|frustrat|hate|tired|struggl|wish|any (tool|app|one)|recommend|alternative|how do|is there|too expensive|pricing|cheaper)/i;
    const hit = sentences.find((s) => painCue.test(s));
    return (hit || sentences[0]).replace(/\s+/g, ' ').slice(0, 180);
  }

  /** Grab a short phrase describing what they're struggling with. */
  function painPhrase(lead) {
    const reasons = (lead && lead.reasons) || [];
    const intent = reasons.find((r) => r.type === 'intent');
    if (intent && intent.match) return intent.match;
    return 'this';
  }

  function softMention(product, tone) {
    const name = (product && product.name) || 'a tool I work on';
    const pitch = (product && product.pitch) || 'it might be a fit';
    const url = (product && product.url) || '';
    const link = url ? ' (' + url + ')' : '';
    if (tone === 'concise') {
      return 'Full disclosure, I build ' + name + link + ' — ' + pitch + '. Happy to help either way.';
    }
    if (tone === 'founder-to-founder') {
      return "Transparent heads-up: I'm the founder of " + name + link + ', which does exactly ' +
        'this — ' + pitch + '. Not trying to pitch you, just mention it in case it saves you time.';
    }
    // helpful (default)
    return "For what it's worth, I help build " + name + link + ' — ' + pitch + '. ' +
      'Only mentioning it because it lines up with what you described; no pressure at all.';
  }

  /**
   * Build 2–3 local template drafts.
   * @param {Object} lead   Saved/candidate lead (needs snippet/text, author, reasons).
   * @param {Object} product The matched product.
   * @param {('helpful'|'concise'|'founder-to-founder')} [tone]
   * @returns {{tone:string, variants:{label:string, text:string}[]}}
   */
  function buildLocalDrafts(lead, product, tone) {
    tone = NS.TONES.indexOf(tone) !== -1 ? tone : 'helpful';
    const name = firstName(lead && lead.author);
    const pain = extractPain(lead);
    const phrase = painPhrase(lead);
    const mention = softMention(product, tone);
    const painLine = pain
      ? 'Totally hear you on ' + '“' + pain + '”' + ' — that exact thing trips a lot of people up.'
      : "I've run into the same frustration you're describing.";

    const helpfulTip = tone === 'concise'
      ? 'Quick tip: nail down the one workflow that hurts most first, then pick a tool around that.'
      : "One thing that helped me: get crystal clear on the single workflow that's costing you time, " +
        'then judge any option purely on how well it fixes that — ignore the feature checklists.';

    const variants = [
      {
        label: 'Empathy-first',
        text: [
          'Hey ' + name + ',',
          '',
          painLine,
          '',
          helpfulTip,
          '',
          mention
        ].join('\n')
      },
      {
        label: 'Straight answer',
        text: [
          painLine + ' Here\'s the short version of how I\'d approach ' + phrase + ':',
          '',
          '• Figure out the must-have vs nice-to-have.',
          '• Try one option end-to-end before committing.',
          '• Watch out for per-seat pricing that balloons later.',
          '',
          mention
        ].join('\n')
      }
    ];

    if (tone !== 'concise') {
      variants.push({
        label: 'Story / relatable',
        text: [
          'Funny timing — I was in the exact same spot not long ago and it drove me nuts.',
          '',
          'What finally worked was fixing ' + phrase + ' first and letting everything else follow. ' +
            painLine.toLowerCase(),
          '',
          mention
        ].join('\n')
      });
    }

    return { tone, variants };
  }

  /**
   * Build the Anthropic Messages API request object for AI drafting.
   * DOES NOT execute — the background worker runs it (see service-worker.js).
   *
   * SECURITY: this deliberately does NOT include the API key. The key lives in
   * chrome.storage.local and is injected by the background worker after its
   * origin check, so the key never enters a content script running on
   * reddit.com and is never passed across extension messaging.
   *
   * @param {Object} lead
   * @param {Object} product
   * @param {Object} settings  { model, draftTone }  (no key — by design)
   * @returns {{url:string, headers:Object, body:Object}}
   */
  function buildAiRequest(lead, product, settings) {
    const tone = settings.draftTone || 'helpful';
    const model = settings.model || 'claude-sonnet-5';
    const painText = (lead && (lead.snippet || lead.text)) || '';

    const system =
      'You are helping a founder write an authentic, NON-SPAMMY Reddit reply to a ' +
      'potential customer. Rules: (1) Genuinely help first — mirror their specific pain ' +
      'and give one concrete, useful suggestion. (2) Mention the product only once, softly, ' +
      'with an honest disclosure that you build it. (3) No hype, no emojis-as-bait, no hard ' +
      'CTA, no "DM me". (4) Sound like a real person on Reddit, lowercase-casual is fine. ' +
      '(5) Keep it under 120 words. Output ONLY the reply text, no preamble.';

    const user = [
      'Reddit ' + (lead.type || 'post') + ' from u/' + (lead.author || 'someone') +
        ' in r/' + (lead.subreddit || 'unknown') + ':',
      '"""',
      painText,
      '"""',
      '',
      'My product: ' + (product.name || '') +
        (product.url ? ' (' + product.url + ')' : ''),
      'What it does: ' + (product.pitch || ''),
      'Desired tone: ' + tone,
      '',
      'Write the reply.'
    ].join('\n');

    return {
      url: NS.ANTHROPIC_API_URL,
      headers: {
        'content-type': 'application/json',
        // NOTE: no 'x-api-key' here — the background worker adds it.
        'anthropic-version': NS.ANTHROPIC_VERSION,
        // Required for calling the Anthropic API directly from a browser
        // extension (opts in to browser-origin requests / CORS).
        'anthropic-dangerous-direct-browser-access': 'true'
      },
      body: {
        model: model,
        max_tokens: 400,
        system: system,
        messages: [{ role: 'user', content: user }]
      }
    };
  }

  NS.Draft = {
    buildLocalDrafts,
    buildAiRequest,
    extractPain,
    // The immutable disclaimer shown above every copy box.
    MANUAL_POST_NOTICE:
      'SubSniper never posts for you. Read it, edit it to sound like you, ' +
      'then copy and paste it into Reddit yourself.'
  };
})(globalThis.SubSniper);
