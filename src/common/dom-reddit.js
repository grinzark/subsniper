/**
 * SubSniper — dom-reddit.js
 * ------------------------------------------------------------------
 * DOM adapters that extract candidate leads from the page the user is
 * ALREADY viewing. Reads only — never writes to Reddit, never calls an API.
 *
 * Supports both:
 *   • New Reddit  — shreddit web components (<shreddit-post>, <shreddit-comment>)
 *   • Old Reddit  — old.reddit.com markup (.thing / .usertext-body)
 *
 * Each adapter returns normalised Candidate objects with a stable node handle
 * so the content script can attach a badge and re-find the element later.
 *
 * @typedef {Object} DomCandidate
 * @property {string} id          Stable id (permalink or thing id).
 * @property {Element} node       The element to anchor a badge on.
 * @property {string} text        Title + body, for scoring.
 * @property {string} title
 * @property {string} author
 * @property {string} subreddit
 * @property {('post'|'comment')} type
 * @property {string} permalink   Absolute reddit.com URL.
 * ------------------------------------------------------------------
 */
globalThis.SubSniper = globalThis.SubSniper || {};

(function (NS) {
  'use strict';

  const ORIGIN = 'https://www.reddit.com';

  function absUrl(href) {
    if (!href) return '';
    if (/^https?:\/\//i.test(href)) return href;
    if (href.charAt(0) === '/') return ORIGIN + href;
    return ORIGIN + '/' + href;
  }

  function textOf(el) {
    if (!el) return '';
    return (el.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function firstText(root, selectors) {
    for (const sel of selectors) {
      const el = root.querySelector(sel);
      const t = textOf(el);
      if (t) return t;
    }
    return '';
  }

  function cleanSub(sub) {
    if (!sub) return '';
    return sub.replace(/^\/?r\//i, '').replace(/^r\//i, '').trim();
  }

  function cleanAuthor(a) {
    if (!a) return '';
    return a.replace(/^\/?u\//i, '').replace(/^u\//i, '').trim();
  }

  // ── New Reddit (shreddit) ──────────────────────────────────────────────
  function extractShredditPosts() {
    const out = [];
    document.querySelectorAll('shreddit-post').forEach((node) => {
      const title = node.getAttribute('post-title') ||
        firstText(node, ['[slot="title"]', 'a[slot="full-post-link"]', 'h1', 'h2', 'h3']);
      const body = firstText(node, [
        '[slot="text-body"]', '[slot="post-media-container"] .md',
        '[slot="post-rtjson-content"]', '.md'
      ]);
      const author = cleanAuthor(node.getAttribute('author'));
      const sub = cleanSub(node.getAttribute('subreddit-prefixed-name') ||
        node.getAttribute('subreddit-name'));
      const permalink = absUrl(node.getAttribute('permalink') ||
        node.getAttribute('content-href') || '');
      const id = node.getAttribute('id') || permalink || NS.uid('post');
      const text = (title + '. ' + body).trim();
      if (!text) return;
      out.push({ id, node, text, title, author, subreddit: sub, type: 'post', permalink });
    });
    return out;
  }

  function extractShredditComments() {
    const out = [];
    document.querySelectorAll('shreddit-comment').forEach((node) => {
      const body = firstText(node, [
        '[slot="comment"] .md', '[slot="comment"]', '.md',
        '[id$="-comment-rtjson-content"]'
      ]);
      if (!body) return;
      const author = cleanAuthor(node.getAttribute('author'));
      const permalink = absUrl(node.getAttribute('permalink') || '');
      const id = node.getAttribute('thingid') || node.getAttribute('id') ||
        permalink || NS.uid('cmt');
      // Subreddit isn't on the comment node — read it from the page context.
      const sub = pageSubreddit();
      out.push({ id, node, text: body, title: '', author, subreddit: sub, type: 'comment', permalink });
    });
    return out;
  }

  // ── Old Reddit (.thing) ────────────────────────────────────────────────
  function extractOldReddit() {
    const out = [];
    document.querySelectorAll('.thing').forEach((node) => {
      // Skip ads / promoted / deleted.
      if (node.classList.contains('promoted')) return;
      const author = cleanAuthor(node.getAttribute('data-author') || '');
      const sub = cleanSub(node.getAttribute('data-subreddit') || pageSubreddit());
      const permalink = absUrl(node.getAttribute('data-permalink') || '');
      const isComment = node.classList.contains('comment');
      if (isComment) {
        const body = firstText(node, ['.usertext-body .md', '.usertext-body', '.md']);
        if (!body) return;
        const id = node.getAttribute('data-fullname') || permalink || NS.uid('cmt');
        out.push({ id, node, text: body, title: '', author, subreddit: sub, type: 'comment', permalink });
      } else if (node.classList.contains('link')) {
        const title = firstText(node, ['a.title', '.title a', 'p.title']);
        const body = firstText(node, ['.expando .usertext-body .md', '.usertext-body .md']);
        const text = (title + '. ' + body).trim();
        if (!text) return;
        const id = node.getAttribute('data-fullname') || permalink || NS.uid('post');
        out.push({ id, node, text, title, author, subreddit: sub, type: 'post', permalink });
      }
    });
    return out;
  }

  /** Best-effort current subreddit from the URL. */
  function pageSubreddit() {
    try {
      const m = location.pathname.match(/\/r\/([^/]+)/i);
      return m ? m[1] : '';
    } catch (_e) {
      return '';
    }
  }

  /** True if the page is using the old.reddit.com markup. */
  function isOldReddit() {
    return !!document.querySelector('.thing') && !document.querySelector('shreddit-post, shreddit-comment');
  }

  /**
   * Collect every candidate on the current page, de-duplicated by id.
   * @returns {DomCandidate[]}
   */
  function collectCandidates() {
    let list;
    if (isOldReddit()) {
      list = extractOldReddit();
    } else {
      list = extractShredditPosts().concat(extractShredditComments());
      // Fallback: some pages mix markup — also sweep old-style things.
      if (document.querySelector('.thing')) {
        list = list.concat(extractOldReddit());
      }
    }
    const seen = new Set();
    const deduped = [];
    for (const c of list) {
      if (!c || !c.id || seen.has(c.id)) continue;
      // Ignore very short noise (single-word replies etc.).
      if ((c.text || '').length < 12) continue;
      seen.add(c.id);
      deduped.push(c);
    }
    return deduped;
  }

  NS.DomReddit = {
    collectCandidates,
    isOldReddit,
    pageSubreddit,
    // Exposed for testing / debugging in the console.
    _extractShredditPosts: extractShredditPosts,
    _extractShredditComments: extractShredditComments,
    _extractOldReddit: extractOldReddit
  };
})(globalThis.SubSniper);
