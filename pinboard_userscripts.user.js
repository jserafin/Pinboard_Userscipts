// ==UserScript==
// @name         Pinboard fixes: search pager + sidebar tag autocomplete
// @namespace    pinboard-fixes
// @version      2.0.0
// @description  Two fixes for pinboard.in. (1) Search pager: Pinboard shows 20 hits per search page but its "« earlier" link jumps ahead 60, hiding hits 21–60 of every 60; this rewrites earlier/later to step by one page, adds numbered page links, and stops at the backend's 1,000-hit ceiling instead of linking to an error page. (2) Sidebar autocomplete: Pinboard wires tag autocomplete to its banner search box by element id, but that box is hidden on screens wider than 640px and the sidebar search box reuses the same id, so on desktop the visible box never gets autocomplete; this attaches Pinboard's own autocomplete to every search box that is missing it.
// @author       Jimmy
// @match        https://pinboard.in/*
// @run-at       document-end
// @grant        none
// @noframes
// ==/UserScript==

/* ------------------------------------------------------------------ */
/* Fix 1: search results pager (search pages only)                     */
/* ------------------------------------------------------------------ */
(function () {
  'use strict';

  if (!/^\/search(\/|$)/.test(location.pathname)) return; // only on /search and /search/u:name etc.

  // Run once per page load.
  if (document.documentElement.dataset.pbPagerFixed) return;
  document.documentElement.dataset.pbPagerFixed = '1';

  var PAGE_DEFAULT = 20;   // Pinboard renders 20 hits per search page regardless of the per-page setting
  var MAX_HITS = 1000;     // Sphinx (searchd) max_matches: offsets >= 1000 return "offset out of bounds"

  function el(tag, text, style, cls) {
    var e = document.createElement(tag);
    if (text != null) e.textContent = text;
    if (style) e.style.cssText = style;
    if (cls) e.className = cls;
    return e;
  }

  function linkFor(s) {
    var u = new URL(location.href);
    if (s > 0) u.searchParams.set('start', String(s));
    else u.searchParams.delete('start');
    return u.toString();
  }

  function link(text, s, cls) {
    var e = el('a', text, null, cls || 'next_prev');
    e.href = linkFor(s);
    return e;
  }

  var bodyText = document.body ? document.body.textContent || '' : '';

  // --- Case 1: Pinboard's own pager sent us past the backend ceiling and the page is a raw error dump.
  var err = /offset out of bounds \(offset=(\d+), max_matches=(\d+)\)/.exec(bodyText);
  if (err) {
    var maxM = parseInt(err[2], 10) || MAX_HITS;
    var lastOk = Math.floor((maxM - 1) / PAGE_DEFAULT) * PAGE_DEFAULT;
    var box = el('div', null, 'font:14px/1.6 Helvetica,Arial,sans-serif;background:#ffa;border:1px solid #e5d96b;padding:10px 14px;margin:0 0 12px 0;');
    box.appendChild(el('b', 'Pinboard search can only page through the first ' + maxM.toLocaleString() + ' hits. '));
    box.appendChild(document.createTextNode('Offset ' + err[1] + ' is past that ceiling. '));
    box.appendChild(link('Go to the last reachable page (hits ' + (lastOk + 1).toLocaleString() + '–' + maxM.toLocaleString() + ')', lastOk, ''));
    box.appendChild(document.createTextNode(' or narrow the search (add a word, or search within a tag) to reach older matches.'));
    document.body.insertBefore(box, document.body.firstChild);
    return;
  }

  // --- Case 2: a normal results page. ("Found  61 results", "Found about 2,000 results", "Found 1 result")
  var container = document.getElementById('bookmarks') || document.body;
  var m = /Found\s+(about\s+)?([\d,]+)\s+results?/i.exec(container.textContent || '');
  if (!m) return; // "No results found", or not a results page
  var approx = !!m[1];
  var total = parseInt(m[2].replace(/,/g, ''), 10);
  if (!total) return;

  var here = new URL(location.href);
  var start = parseInt(here.searchParams.get('start') || '0', 10);
  if (isNaN(start) || start < 0) start = 0;

  var shown = container.querySelectorAll('.bookmark').length;
  // Follow the real page size if Pinboard ever starts honouring the per-page setting on search pages.
  var PAGE = shown > PAGE_DEFAULT ? shown : PAGE_DEFAULT;

  var reachable = Math.min(total, MAX_HITS);
  if (reachable <= PAGE) return; // everything fits on one page; nothing to fix

  var lastStart = Math.floor((reachable - 1) / PAGE) * PAGE;
  if (start > lastStart) start = lastStart;

  var pageCount = Math.ceil(reachable / PAGE);
  var current = Math.floor(start / PAGE) + 1;

  // Page numbers to show (1-based); long runs collapse to "1 2 … 9 10 11 12 13 … 49 50".
  function pageList() {
    var pages = [], i;
    if (pageCount <= 12) {
      for (i = 1; i <= pageCount; i++) pages.push(i);
      return pages;
    }
    var keep = {};
    [1, 2, pageCount - 1, pageCount, current - 2, current - 1, current, current + 1, current + 2]
      .forEach(function (p) { if (p >= 1 && p <= pageCount) keep[p] = true; });
    var sorted = Object.keys(keep).map(Number).sort(function (x, y) { return x - y; });
    for (i = 0; i < sorted.length; i++) {
      if (i > 0 && sorted[i] - sorted[i - 1] > 1) pages.push(null); // gap
      pages.push(sorted[i]);
    }
    return pages;
  }

  function buildPager() {
    var wrap = el('div', null, 'margin:6px 0 8px 0;line-height:1.9;', 'pb-pager-fix');

    var hasEarlier = start + PAGE < reachable;
    var hasLater = start > 0;
    if (hasEarlier) wrap.appendChild(link('« earlier', start + PAGE));
    if (hasEarlier && hasLater) wrap.appendChild(el('span', ' ‧ ', 'color:#999'));
    if (hasLater) wrap.appendChild(link('later »', Math.max(0, start - PAGE)));

    var pages = el('span', null, 'margin-left:14px;font-size:90%;');
    pages.appendChild(el('span', 'page ', 'color:#777'));
    pageList().forEach(function (p, idx) {
      if (idx > 0) pages.appendChild(document.createTextNode(' '));
      if (p === null) { pages.appendChild(el('span', '…', 'color:#999')); return; }
      if (p === current) {
        pages.appendChild(el('span', String(p), 'background:#ffa;padding:0 4px;font-weight:bold;'));
      } else {
        pages.appendChild(link(String(p), (p - 1) * PAGE, 'pb-page'));
      }
    });
    wrap.appendChild(pages);

    var first = start + 1, last = Math.min(start + PAGE, reachable);
    var range = first === last ? String(first) : first + '–' + last;
    var ofText = (approx ? 'about ' : '') + total.toLocaleString();
    wrap.appendChild(el('span', '  (showing ' + range + ' of ' + ofText + ')', 'color:#777;font-size:85%;margin-left:10px;'));

    if (total > MAX_HITS) {
      wrap.appendChild(el('span', '  — only the first ' + MAX_HITS.toLocaleString() + ' hits are reachable; narrow the search to see older ones',
        'color:#a60;font-size:85%;margin-left:6px;'));
    }
    return wrap;
  }

  // Replace Pinboard's widgets (top and bottom) with working ones; style page links like the originals.
  var css = el('style', '.pb-pager-fix a.pb-page{padding:0 3px;} .pb-pager-fix a.next_prev{margin-right:4px;}');
  document.head.appendChild(css);

  var widgets = container.querySelectorAll('table.next_prev_widget');
  if (widgets.length) {
    Array.prototype.forEach.call(widgets, function (w) {
      w.parentNode.replaceChild(buildPager(), w);
    });
  } else {
    // No widget rendered at all (happens when start+60 overshoots the total): add our own.
    var marks = container.querySelectorAll('.bookmark');
    if (marks.length) {
      marks[0].parentNode.insertBefore(buildPager(), marks[0]);
      var lastMark = marks[marks.length - 1];
      lastMark.parentNode.insertBefore(buildPager(), lastMark.nextSibling);
    }
  }
})();

/* ------------------------------------------------------------------ */
/* Fix 2: tag autocomplete on the sidebar search box (every page)      */
/* ------------------------------------------------------------------ */
(function () {
  'use strict';

  // With @grant none the script runs in the page's own scope; fall back to unsafeWindow if a manager sandboxes it anyway.
  var w = (typeof unsafeWindow !== 'undefined') ? unsafeWindow : window;

  function pageReady() {
    // Pin.Tags comes from /js/pin.js, usertags from /user_tag_list/. Both load with the page.
    return w.Pin && typeof w.Pin.Tags === 'function' && Array.isArray(w.usertags);
  }

  function pinboardInitDone() {
    // Pinboard's own onload init attaches a .pin-ac dropdown to the (hidden) banner search form.
    // Wait for that so we never double-wire the banner box on narrow screens.
    var banner = document.querySelector('#banner_searchbox form');
    return !banner || !!banner.querySelector('.pin-ac');
  }

  function attach() {
    var inputs = document.querySelectorAll('form input[name="query"]');
    Array.prototype.forEach.call(inputs, function (input) {
      if (!input.form || input.form.querySelector('.pin-ac')) return; // already has autocomplete
      if (input.dataset.pbAcAttached) return;
      input.dataset.pbAcAttached = '1';
      // Same options Pinboard uses for the banner box.
      new w.Pin.Tags(input, w.usertags, { circular: true, submit_on_return: true });
    });
  }

  var tries = 0;
  function run() {
    if (pageReady() && pinboardInitDone()) { attach(); return; }
    if (++tries < 40) setTimeout(run, 100); // give the page up to ~4s to finish its own setup
  }

  if (document.readyState === 'complete') run();
  else window.addEventListener('load', function () { setTimeout(run, 0); });
})();