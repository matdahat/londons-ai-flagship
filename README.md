# Londons.ai — the flagship

One-page site for Londons.ai. Scrolling down is a single unbroken descent:
THE CITY → THE BUILDING → THE STUDIO → THE FLOOR → (THE WARNING, a light-ground
pause) → THE CONVERGENCE → THE HOLD, told through a six-clip black-and-white
film scrubbed as a canvas frame sequence, then a set of light-ground sections
proving the offer runs across every part of a business, not just fashion.

## Run

```
node tools/serve.js        # http://localhost:4175
```

(Any static server works; `tools/serve.js` adds no-store headers for dev.)

## Structure

- `index.html` — the page. Everyone gets the scroll-scrub descent — it's
  scrollY-driven, not gesture-driven, so it works the same on touch as on a
  wheel/trackpad. `prefers-reduced-motion` users get stacked autoplaying
  loops instead (`html.film-loops`), with THE WARNING as a plain in-flow
  light-ground block between clip 4 and clip 5.
- `styles.css` — the brand design-system tokens, copied verbatim from the
  brand bundle (source of truth for every colour/font/spacing value).
- `site.css` — site layer composed from those tokens only.
- `main.js` — Lenis smooth scroll on non-touch pointers (skipped on touch so
  native momentum/rubber-banding isn't fought by virtualized scroll — the
  redraw loop runs regardless, reading `scrollY` fresh every frame either
  way), canvas frame-sequence scrubber, and the piecewise scroll→frame
  mapping that holds the film on clip 4's last frame for the duration of THE
  WARNING before resuming into clip 5 — so the pause reads as a beat inside
  one continuous journey, not a cut. Zone label/copy fades are near-sequential
  (tiny overlap, not a broad crossfade) — two different paragraphs
  superimposed at partial opacity reads as ghosting, not a blend. Zone
  label/copy timing, reveals, counters.
- `assets/frames/` — desktop frame sequence @ 1920×1080, 8fps, +
  `manifest.json` (built artifact; the manifest carries the real
  clip-boundary fractions used by the frame-hold math and the zone label).
- `assets/frames-mobile/` — the same sequence at 960×540 for viewports under
  901px, so scrubbing on a phone doesn't mean pulling full-res stills over
  cellular. Same manifest shape, regenerated from the same `descent.mp4` —
  no reference to the frame width is baked in anywhere else.
- `assets/film/` — source clips from Seedance 2.0 (`clip-1..6.mp4`), the
  graded intermediates, the concatenated `descent.mp4`, the two seed
  references (`hero-aerial.png`, `cast-ensemble.png`), and compressed loops
  (`clip-N-loop.mp4`) used only by the reduced-motion fallback.
- `tools/process-film.sh` — rebuilds grade → concat → frames (desktop tier)
  → loops from `clip-1..6.mp4`. Re-run the frame-extraction step alone
  (see the script's step 3) at a different `W` to regenerate either tier
  from the existing `descent.mp4` without new generation.
- `tools/verify.js` — headless Chrome check: zone labels/copy at scroll
  positions, the warning pause, poster close, mobile loops.
  `node tools/verify.js /tmp/out`.

## Film provenance

Generated with Seedance 2.0 (Higgsfield MCP), std / 1080p / 16:9 / silent.
One hero aerial (B&W, Tower Bridge + Thames) and one five-model ensemble cast
(B&W, black-void studio, five distinct clothing genres) seed the whole chain
as image references; each clip's final frame is the next clip's
`start_image`, so all six clips join as one unbroken move — camera movement
only, no jump cuts, no cross-dissolves. All film is pure high-contrast B&W —
the only red on the site lives in the interface.

## The scroll-time pause

THE WARNING is the one moment the descent stops moving forward as film, so
the urgency line can be read on a plain ground. It is not a jump cut in the
footage: `main.js` maps scroll progress to frame progress piecewise — linear
through clips 1–4, held flat across the pause's scroll distance, then linear
again from clip 5's first frame to clip 6's last. Zone label and progress
rule stay live throughout, since the underlying journey never actually stops.
