# Londons.ai — the flagship

The Londons.ai site, deployed to **https://londons.ai** via GitHub Pages
(`matdahat/londons-ai-flagship`, custom domain + enforced HTTPS).

Scrolling down is a single unbroken descent:
`THE CITY → THE MACHINE → THE STUDIO → THE FLOOR → (THE WARNING) → THE CONVERGENCE`
told through six chained black-and-white clips scrubbed as a canvas frame
sequence. After the descent the page runs on a light ground: Services (Business
AI, then Creative AI), Every sector, The numbers, Commercial judgement, About
(Matt Meyers' bio), How we work, and a closing poster with the contact form.

Copy follows the humanizer standard: no em dashes, no mirrored "isn't / it's"
lines, no stock AI vocabulary. The desktop descent copy (`.zone-copy`) and the
mobile chapters (`.descent-mobile .m-copy`) are separate copies of the same
lines, so edit both.

The `<head>` carries JSON-LD for Londons.ai and Matt Meyers. It repeats claims
from the About section (role, 30 years in music, areas of expertise), so change
the two together. About is written for Londons.ai, so HitVocals appears only as
one inline link there and is deliberately absent from the JSON-LD.

## Run locally

```
node tools/serve.js        # http://localhost:4175
```

Sibling builds in the parent folder use their own ports: `4173` london skyline,
`4174` model shoot, `4176` the flagship mk2 (the staging copy this build came
from — kept so future changes can be trialled before going live).

## Structure

- `index.html` — the page. Desktop gets the scroll-scrub descent; touch and
  narrow viewports get full-bleed snap-scrolling story chapters instead
  (`html.film-loops`), because scroll-scrubbing tested badly on a real phone.
  `prefers-reduced-motion` gets the same chapter treatment.
- `styles.css` — brand design-system tokens, verbatim from the brand bundle.
- `site.css` — site layer composed from those tokens only.
- `main.js` — Lenis smooth scroll on non-touch pointers, canvas frame-sequence
  scrubber, and the piecewise scroll→frame mapping that holds the film on clip
  4's last frame for the duration of THE WARNING before resuming into clip 5 —
  so the pause reads as a beat inside one continuous journey, not a cut.
  Copy fades are near-sequential rather than a broad crossfade: two paragraphs
  superimposed at partial opacity reads as ghosting, not a blend.
- `assets/frames/` — 1920×1080 frame sequence @ 8fps + `manifest.json`, whose
  real clip-boundary fractions drive both the frame-hold maths and the zone
  label.
- `assets/film/` — the six mobile loops actually served, plus `cast-b.png`, the
  locked cast reference. The 4K masters, graded intermediates and
  `descent.mp4` are gitignored: they are build inputs, not site assets, and
  live in `the flagship mk2/assets/film/` locally.
- `tools/process-film.sh` — grade → concat → frames → loops from `clip-1..6.mp4`.
- `tools/verify.js` — headless Chrome check of zone labels, copy positions,
  the warning pause, poster close and mobile chapters.

## The film

Seedance 2.0 via Higgsfield MCP, **4k / std / high bitrate / 16:9 / silent**.
Each clip's final frame becomes the next clip's `start_image`, and the cast
plate is passed as `image_references` on the clips the models appear in — so
the six clips join as one unbroken camera move with no jump cuts, and the same
three models recur throughout.

Source is 4K but the site ships frames at 1920px: rendered-high/delivered-low,
which buys cleaner detail through supersampling rather than a 4K viewing
experience. `bitrate_mode: high` costs nothing extra at any tier, so it is
always on.

The cast is three models — one man, two women, mid-twenties, contemporary
wearable fashion — introduced in the studio in front of the camera and crew.
THE MACHINE (zone 02) dives through a window into an open laptop and on into
macro circuitry, which states what the company does within the first fifteen
seconds and holds far more perceived sharpness than a wide aerial, where a
whole city of fine detail competes for pixels.

All film is pure high-contrast B&W; the only red on the site is in the
interface.

## Deploying

Run `tools/stamp-assets.sh` first, then `git push` to `main` — GitHub Pages
rebuilds automatically.

**Always stamp before deploying.** `index.html` links `site.css?v=…` and
`main.js?v=…`; if that version does not change, the asset URL does not change,
and browsers keep serving the copy they already cached — the deploy goes live
but looks like nothing happened until a manual hard refresh. The script writes
a fresh timestamp into both links so the browser is obliged to refetch.

The same script also writes that stamp into a `build-stamp` meta tag and into
`version.txt`. GitHub Pages sends `cache-control: max-age=600` on every file,
including `index.html`, and Pages offers no way to change that, so a browser can
hold an old copy of the page for ten minutes after a deploy. On load (and when a
background tab comes back into view) `main.js` fetches `version.txt` uncached
and, if it disagrees with the page's own stamp, reloads once to a cache-busted
URL. It does nothing on localhost.

To roll back to the previous five-model build: `git revert <deploy commit>` or
reset to `33c35d4`. The last deploy before the services, judgement and approach
content was added was `27abdce`.
