# UI and UX pass, 11 November 2026

## Intent
Blank Atlas already has a distinct identity (terra incognita hatching, italic serif water labels, aviation-chart magenta). This pass keeps that identity and fixes the places where the interface gets in the way of the map or of the next action. The request was "work extensively on better UI and better UX"; the calls below are the builder's, made without a brief.

## Problems found by playing the current build
- Desktop home: the cartouche carries identity, progress, the mode toggle and a mode description. The real next step (start or continue a region) is a small button at the bottom-left of a card strip. Nothing on the screen says "do this next".
- Phone home: the cartouche fills almost half the screen and the world map shrinks to a thumbnail between it and the region strip. The "map is the hero" concept collapses on the device most people will use.
- Region strip: six near-identical cards, each repeating "Start learning →", plus a heading, a "scroll sideways" hint and two text buttons. Lots of chrome for one choice.
- The big map on the home screen is decorative only. Hovering a card highlights a region, but the map itself cannot be used to choose one.
- Play: Space means "Continue" during a teach step and "Reveal location" (give up) during a question. Tapping through introductions can accidentally forfeit the first question.
- Play: feedback copy is 14px muted text under a 32px country name; a wrong answer barely registers.
- Light theme: the uncharted hatching is too faint to read as "unknown".

## Goals
- The next action is obvious within a second, on desktop and on a phone.
- The map stays the hero on every screen size, including the phone home screen.
- Fewer, calmer controls; the strip reads like atlas plates rather than a product-card grid.
- Nothing regresses: all existing tests keep passing, keyboard access and reduced motion stay intact.

## Non-goals
- No new game modes, no scoring changes, no data changes.
- No change to the colour identity, typefaces or the night-chart dark theme.

## Design decisions
### Home, desktop
- Cartouche shrinks to identity plus progress: wordmark, byline, charted count, tick bar, map key. On a fresh atlas it also shows a three-line "how it works".
- A single primary action, `#nextCta`, sits at the head of the action row above the strip: "Start learning South America" or "Continue Europe · 12 of 45 charted". It follows the current mode (learn, map run, explore).
- The mode toggle moves to the strip heading row, where it governs what the cards do. The mode note sits beside it.
- Region cards become plates: a full-bleed mini-map with the progress badge on top, a footer with name, status line and a small progress ring, and one quiet action label. Width 188px so all seven fit at 1440px without scrolling.
- The home map becomes a region picker: hovering a country highlights its region and card; clicking it does what the card would do.

### Home, phone (≤760px)
- Top bar in one row: wordmark and charted count on the left, streak, goal ring and settings on the right. Byline, key and how-it-works hidden.
- Bottom sheet: primary action, chips row, mode tabs, then the plate strip at 150px per card. Target: the map keeps at least 40% of the screen height.

### Play
- Space is ignored for the first 500ms after a question opens, so a Space press meant for "Continue" cannot forfeit the question.
- Feedback line grows to 15px and gets a tinted band when it carries a result (green for right, red for wrong), so the outcome registers without reading.
- Map hint text raised to a legible size.

### Summary
- Learn summaries show the region's progress as a bar, not a sentence.

### Theme
- Light hatch darkened a step so uncharted land reads as hatched.

## Left to the builder
- Exact spacing, ring sizes, hover states, and the wording of each action label.

## Added during the build
- Learn, review and practice results open as a side panel (like map-run results) so the map with the newly charted countries stays visible.
- On phones the cartouche subline shortens to "N of 196 charted" and the daily-goal pill shows the count inside its ring.
