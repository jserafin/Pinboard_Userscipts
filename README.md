# Pinboard Userscripts

A single userscript that fixes two long-standing annoyances on [pinboard.in](https://pinboard.in):

1. **Search pager** — the "« earlier" link on search results skips two thirds of the hits.
2. **Sidebar tag autocomplete** — the search box you can actually see on desktop has no tag autocomplete.

Both fixes live in [`pinboard_userscripts.user.js`](pinboard_userscripts.user.js) and run on every `https://pinboard.in/*` page.

## Install

1. Install a userscript manager: [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open `pinboard_userscripts.user.js` in the browser (the raw file link on GitHub works). The manager will detect the `.user.js` suffix and offer to install it.
3. Reload any pinboard.in page.

No permissions are requested (`@grant none`), so the script runs in the page's own JavaScript scope and can use Pinboard's existing code directly.

## Fix 1: search results pager

**The problem.** Pinboard renders 20 hits per search page, but its "« earlier" link advances the `start` offset by 60. Every click hides hits 21–60 of each block, so two thirds of your results are unreachable through the UI. Worse, when the offset passes 1,000 the search backend (Sphinx, `max_matches=1000`) returns a raw "offset out of bounds" error page instead of results.

**The fix.** On `/search` pages the script:

- Reads the "Found N results" count and the current `start` offset.
- Replaces Pinboard's `next_prev_widget` tables (top and bottom) with a pager whose earlier/later links step by exactly one page.
- Adds numbered page links, collapsing long runs to `1 2 … 9 10 11 12 13 … 49 50`.
- Shows "showing X–Y of N" and stops at the 1,000-hit ceiling with a note to narrow the search.
- If you have already landed on the error page, injects a banner linking back to the last reachable page.

If Pinboard ever honours the per-page setting on search pages, the script follows the real page size automatically.

## Fix 2: sidebar tag autocomplete

**The problem.** Pinboard attaches tag autocomplete to the banner search box by element id. That box is hidden on screens wider than 640px, and the always-visible sidebar search box reuses the same id. So on desktop the box you type into never gets autocomplete.

**The fix.** After the page loads and Pinboard's own init has finished, the script finds every search form whose input is named `query` and lacks a `.pin-ac` dropdown, then attaches Pinboard's own `Pin.Tags` widget using the same options Pinboard uses (`circular`, `submit_on_return`). It waits up to about four seconds for `Pin.Tags` and the user's tag list to load, and never double-wires a box that already has autocomplete.

## Development

The file is plain ES5 with no build step. Edit it, then reinstall or reload it in your userscript manager. Bump `@version` in the header so managers pick up the update.
