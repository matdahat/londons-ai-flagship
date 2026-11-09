/* Londons.ai — The Flagship. On desktop, one unbroken descent through six
   chained clips, paced by scroll, with a line of copy pinned over each of the
   first five. Phones get the opening clip and the copy as type instead. */
(function () {
  'use strict';

  var doc = document.documentElement;

  /* self-heal stale HTML — see tools/stamp-assets.sh for why this exists.
     GitHub Pages caches index.html itself for up to 10 minutes with no way
     to override that, so a browser can be looking at a page from before the
     last deploy with no signal anything's wrong. version.txt is fetched with
     cache: 'no-store' so it always reflects the live deploy; if it disagrees
     with this page's own build-stamp meta tag, force a fresh navigation.
     No-ops on localhost — the dev servers don't serve version.txt. */
  if (location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    (function () {
      var mine = (document.querySelector('meta[name="build-stamp"]') || {}).content;
      var lastCheck = 0;
      function checkFresh() {
        var now = Date.now();
        if (now - lastCheck < 60000) return; /* visibilitychange can fire often; keep this cheap */
        lastCheck = now;
        if (sessionStorage.getItem('lai_reloaded')) return; /* at most one auto-reload per tab */
        fetch('/version.txt', { cache: 'no-store' }).then(function (r) { return r.text(); }).then(function (v) {
          v = v.trim();
          if (v && mine && v !== mine) {
            sessionStorage.setItem('lai_reloaded', '1');
            var u = new URL(location.href);
            u.searchParams.set('_r', now); /* force a real fetch, not the cached document */
            location.replace(u.toString());
          }
        }).catch(function () {}); /* a network hiccup just means we stay on the page we have */
      }
      checkFresh();
      document.addEventListener('visibilitychange', function () {
        if (document.visibilityState === 'visible') checkFresh();
      });
    })();
  }

  /* ————— film mode: scroll-scrub on desktop, snap-through story chapters on touch/small —————
     Tried scroll-scrubbing on touch too (it's scrollY-driven, not gesture-driven, so it
     technically works) — real-device testing showed it just doesn't feel right on a phone,
     so touch/narrow viewports get a dedicated chapter format instead: full-bleed video per
     clip, CSS scroll-snap between them, no frame-sequence downloading at all. */
  var touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  function viewportW() {
    return window.innerWidth || doc.clientWidth || window.screen.width || 0;
  }
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var MOBILE_BREAKPOINT = 901;
  function wantsLoopsMode() {
    return reducedMotion || touchOnly || (viewportW() > 0 && viewportW() < MOBILE_BREAKPOINT);
  }
  var loopsMode = wantsLoopsMode();
  if (loopsMode) doc.classList.add('film-loops');

  window.addEventListener('resize', function () {
    if (wantsLoopsMode() !== loopsMode) window.location.reload();
  });

  /* ————— smooth scroll ————— */
  var lenis = null;
  var noLenis = /[?&]nolenis/.test(window.location.search);
  /* skip Lenis on touch: it virtualizes scroll input, which can fight native touch
     momentum/rubber-banding — desktop wheel/trackpad gets the smoothing, touch gets
     native feel, both drive the same always-running redraw loop below */
  if (!loopsMode && !touchOnly && !noLenis && window.Lenis) {
    lenis = new Lenis({ lerp: 0.09, wheelMultiplier: 1.0 });
  }

  /* ————— elements ————— */
  var canvas = document.getElementById('film');
  var ctx = canvas.getContext('2d');
  var track = document.getElementById('descent-track');
  var scrim = document.getElementById('film-scrim');
  var progressRule = document.getElementById('descent-progress');
  var zoneLabel = document.getElementById('zone-label');
  var zoneIndex = document.getElementById('zone-index');
  var zoneName = document.getElementById('zone-name');
  var nav = document.getElementById('site-nav');
  var mainContent = document.getElementById('main-content');
  var skipFilm = document.getElementById('skip-film');

  var ZONES = [
    { index: '01', name: 'The City' },
    { index: '02', name: 'The Machine' },
    { index: '03', name: 'The Studio' },
    { index: '04', name: 'The Floor' },
    { index: '05', name: 'The Convergence' }
  ];

  /* ————— scroll plan —————
     .descent-track is 520vh in site.css. The six clips share the scroll evenly,
     so the scroll fraction is also the frame fraction. Until Nov 2026 this was
     990vh with a 170vh pause for THE WARNING; it was halved so the film stops
     gating the page. */

  /* pinned copy: [element, fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd] in
     scroll fraction. Line i plays over clip i+1; clip 6 carries none and runs
     into the page. The windows are strictly sequential (out ends where the next
     in begins): two lines superimposed at half opacity read as ghosting. Ramps
     stay short so each line spends most of its time at full strength. */
  var COPY_IDS = ['copy-hero', 'copy-z2', 'copy-z3', 'copy-z4', 'copy-z5'];
  var COPY = [];
  /* zone-label boundaries (scroll fraction where the label switches) */
  var ZONE_BOUNDS = [];

  /* b = boundaries after clips 1-5 as fractions. Seeded for six equal clips,
     then replaced by the manifest's real ones, since clip lengths vary slightly. */
  function setBoundaries(b) {
    COPY = COPY_IDS.map(function (id, i) {
      var inA = i === 0 ? -1 : b[i - 1] - 0.004;
      var inB = i === 0 ? 0 : b[i - 1] + 0.016;
      return [document.getElementById(id), inA, inB, b[i] - 0.020, b[i] - 0.004];
    });
    ZONE_BOUNDS = [b[0], b[1], b[2], b[3]];
  }
  setBoundaries([1 / 6, 2 / 6, 3 / 6, 4 / 6, 5 / 6]);

  /* ————— frame sequence ————— */
  var frames = [];
  var frameCount = 0;
  var framePad = 4;
  var frameExt = '.jpg';
  var loadedFlags = [];
  var currentFrame = -1;
  var pendingDraw = false;

  function framePath(i) {
    var n = String(i + 1);
    while (n.length < framePad) n = '0' + n;
    return 'assets/frames/f-' + n + frameExt;
  }

  var LATTICE = 8;
  var WINDOW = 28;
  var inFlightCount = 0;
  var MAX_INFLIGHT = 4;

  function isLattice(i) { return i % LATTICE === 0 || i === frameCount - 1; }

  function loadFrame(i, cb) {
    if (frames[i]) { if (cb && loadedFlags[i]) cb(); return; }
    var img = new Image();
    img.decoding = 'async';
    img.onload = function () { loadedFlags[i] = true; if (cb) cb(); };
    img.onerror = function () { frames[i] = null; };
    img.src = framePath(i);
    frames[i] = img;
  }

  function evictFar(center) {
    for (var i = 0; i < frameCount; i++) {
      if (frames[i] && !isLattice(i) && Math.abs(i - center) > WINDOW * 2) {
        frames[i] = null;
        loadedFlags[i] = false;
      }
    }
  }

  var lastFillCenter = -9999;
  function fillWindow(center) {
    if (Math.abs(center - lastFillCenter) < 4) return;
    lastFillCenter = center;
    evictFar(center);
    var want = [];
    for (var d = 0; d <= WINDOW; d++) {
      if (center + d < frameCount) want.push(center + d);
      if (d > 0 && center - d >= 0) want.push(center - d);
    }
    for (var k = 0; k < want.length; k++) {
      var idx = want[k];
      if (!frames[idx] && inFlightCount < MAX_INFLIGHT) {
        inFlightCount++;
        (function (j) {
          loadFrame(j, function () {
            inFlightCount--;
            if (Math.abs(j - targetFrame()) < 3) requestDraw(targetFrame());
          });
        })(idx);
      }
    }
  }

  function nearestLoaded(i) {
    if (loadedFlags[i] && frames[i]) return i;
    for (var d = 1; d < frameCount; d++) {
      if (i - d >= 0 && loadedFlags[i - d] && frames[i - d]) return i - d;
      if (i + d < frameCount && loadedFlags[i + d] && frames[i + d]) return i + d;
    }
    return -1;
  }

  function drawFrame(i) {
    var idx = nearestLoaded(i);
    if (idx < 0) return;
    var img = frames[idx];
    var cw = canvas.width, ch = canvas.height;
    var iw = img.naturalWidth, ih = img.naturalHeight;
    if (!iw || !ih) return;
    var scale = Math.max(cw / iw, ch / ih);
    var dw = iw * scale, dh = ih * scale;
    ctx.drawImage(img, (cw - dw) / 2, (ch - dh) / 2, dw, dh);
    currentFrame = idx;
  }

  function requestDraw(i) {
    if (pendingDraw) return;
    pendingDraw = true;
    requestAnimationFrame(function () {
      pendingDraw = false;
      drawFrame(i);
    });
  }

  function preload() {
    loadFrame(0, function () { requestDraw(0); });
    var order = [];
    for (var i = 0; i < frameCount; i += LATTICE) order.push(i);
    order.push(frameCount - 1);
    var cursor = 0, inFlight = 0, MAX = 4;
    function pump() {
      while (inFlight < MAX && cursor < order.length) {
        (function (idx) {
          inFlight++;
          loadFrame(idx, function () {
            inFlight--;
            if (Math.abs(idx - targetFrame()) < LATTICE) requestDraw(targetFrame());
            pump();
          });
        })(order[cursor++]);
      }
    }
    pump();
  }

  /* ————— scroll mapping ————— */
  var trackTop = 0, trackHeight = 1, viewportH = 1;

  function viewportHeight() {
    return window.innerHeight || doc.clientHeight || 0;
  }

  function measure() {
    viewportH = viewportHeight() || 1;
    var rect = track.getBoundingClientRect();
    trackTop = rect.top + window.scrollY;
    trackHeight = rect.height - viewportH;
    if (trackHeight < 1) trackHeight = 1;
    sizeCanvas();
  }

  function sizeCanvas() {
    var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    var w = Math.round(viewportW() * dpr);
    var h = Math.round(viewportHeight() * dpr);
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w; canvas.height = h;
      if (currentFrame >= 0) drawFrame(currentFrame);
    }
  }

  function progress() {
    var p = (window.scrollY - trackTop) / trackHeight;
    return p < 0 ? 0 : (p > 1 ? 1 : p);
  }

  /* the clips share the scroll evenly, so scroll fraction is frame fraction */
  function targetFrame() {
    return Math.min(frameCount - 1, Math.round(progress() * (frameCount - 1)));
  }

  function fadeWindow(p, a, b, c, d) {
    if (p <= a || p >= d) return 0;
    if (p < b) return (p - a) / (b - a);
    if (p <= c) return 1;
    return 1 - (p - c) / (d - c);
  }

  var lastZone = -1;
  function update() {
    if (!window.innerWidth || !window.innerHeight) return;
    if (Math.abs(viewportHeight() - viewportH) > 1) measure();
    var p = progress();
    var inDescent = window.scrollY < trackTop + trackHeight + viewportH * 0.25;

    if (frameCount) {
      var tf = targetFrame();
      requestDraw(tf);
      if (inDescent) fillWindow(tf);
    }

    var live = inDescent;
    scrim.classList.toggle('live', live);
    zoneLabel.classList.toggle('live', live);
    progressRule.classList.toggle('live', live);
    canvas.classList.toggle('parked', !inDescent);
    progressRule.style.transform = 'scaleY(' + p + ')';

    /* zone label — real clip-boundary scroll-fractions (the pause belongs to zone 04) */
    var z = 0;
    if (p >= ZONE_BOUNDS[3]) z = 4;
    else if (p >= ZONE_BOUNDS[2]) z = 3;
    else if (p >= ZONE_BOUNDS[1]) z = 2;
    else if (p >= ZONE_BOUNDS[0]) z = 1;
    else z = 0;
    if (z !== lastZone) {
      lastZone = z;
      zoneIndex.textContent = ZONES[z].index;
      zoneName.textContent = ZONES[z].name;
    }

    /* pinned film copy */
    for (var i = 0; i < COPY.length; i++) {
      var el = COPY[i][0];
      var o = fadeWindow(p, COPY[i][1], COPY[i][2], COPY[i][3], COPY[i][4]);
      el.style.opacity = o;
      el.style.visibility = o > 0.01 ? 'visible' : 'hidden';
      var drift = (1 - o) * 14;
      if (el.id !== 'copy-hero') {
        el.style.transform = 'translateY(calc(-50% + ' + drift + 'px))';
      }
      /* the nav lockup used to fade out here so the giant hero lockup could
         own the brand; it now sits inside a solid accent masthead, so it
         stays put */
    }

    /* nav ground state: the light style once the page content reaches it */
    var mcTop = mainContent.getBoundingClientRect().top;
    nav.classList.toggle('on-ground', mcTop <= nav.offsetHeight);
    /* Skip the film stays up until the film stops, i.e. until the page
       content starts coming up over the last frame */
    if (skipFilm) skipFilm.classList.toggle('live', mcTop > viewportH - 1);

    window.__descent = { p: p, frame: currentFrame, zone: lastZone, live: live };
  }

  /* ————— reveals ————— */
  var revealObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        e.target.classList.add('in');
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.18 });
  document.querySelectorAll('.reveal').forEach(function (el) { revealObserver.observe(el); });

  /* ————— contact form —————
     The form is a plain HTML POST to Formspree, so it still works with no script. This
     upgrade validates inline, sends in the background and shows the result on the page
     instead of dropping the visitor on Formspree's own thank-you page. It shares one
     markup for desktop and mobile. */
  var contactForm = document.getElementById('contact-form');
  if (contactForm) {
    var cfStatus = document.getElementById('cf-status');
    var cfSuccess = document.getElementById('cf-success');
    var cfButton = contactForm.querySelector('.btn-submit');
    var cfLabel = cfButton.querySelector('.btn-label');
    var cfSendText = cfLabel.textContent;
    var CF_REQUIRED = ['name', 'email', 'message'];
    var CF_ERRORS = {
      name: 'Please tell us your name.',
      email: 'Please enter your email so we can reply.',
      emailBad: "That email address doesn't look right.",
      message: "Please add a few lines about what you'd like help with."
    };
    contactForm.noValidate = true; /* our messages replace the browser's, but only when script runs */

    var cfProblem = function (key) {
      var el = document.getElementById('cf-' + key);
      if (el.value.replace(/\s+/g, '') === '') return CF_ERRORS[key];
      if (key === 'email' && el.validity && el.validity.typeMismatch) return CF_ERRORS.emailBad;
      return '';
    };
    var cfShowError = function (key, msg) {
      var el = document.getElementById('cf-' + key), err = document.getElementById('cf-' + key + '-err');
      err.textContent = msg; err.hidden = false;
      el.setAttribute('aria-invalid', 'true');
      el.parentNode.classList.add('has-error');
    };
    var cfClearError = function (key) {
      var el = document.getElementById('cf-' + key), err = document.getElementById('cf-' + key + '-err');
      err.textContent = ''; err.hidden = true;
      el.removeAttribute('aria-invalid');
      el.parentNode.classList.remove('has-error');
    };
    CF_REQUIRED.forEach(function (key) {
      document.getElementById('cf-' + key).addEventListener('input', function () { cfClearError(key); });
    });
    var cfSetSending = function (on) {
      cfButton.disabled = on;
      cfLabel.textContent = on ? 'Sending…' : cfSendText;
      contactForm.setAttribute('aria-busy', on ? 'true' : 'false');
    };
    var cfSent = function () {
      document.getElementById('cf-success-name').textContent = document.getElementById('cf-name').value.trim().split(/\s+/)[0];
      document.getElementById('cf-success-email').textContent = document.getElementById('cf-email').value.trim();
      contactForm.hidden = true;
      cfSuccess.hidden = false;
      cfSuccess.focus();
    };
    var cfFailed = function () {
      cfSetSending(false);
      cfStatus.hidden = false;
    };

    contactForm.addEventListener('submit', function (e) {
      e.preventDefault();
      cfStatus.hidden = true;
      var firstBad = null;
      CF_REQUIRED.forEach(function (key) {
        var msg = cfProblem(key);
        if (msg) { cfShowError(key, msg); if (!firstBad) firstBad = key; } else { cfClearError(key); }
      });
      if (firstBad) { document.getElementById('cf-' + firstBad).focus(); return; }

      /* only a real Formspree address may be posted to; anything else (a missing or
         placeholder action) shows the email fallback instead of pretending to send */
      var endpoint = contactForm.getAttribute('action') || '';
      if (!/^https:\/\/formspree\.io\/f\/[A-Za-z0-9]+$/.test(endpoint)) { cfFailed(); return; }

      cfSetSending(true);
      fetch(endpoint, { method: 'POST', body: new FormData(contactForm), headers: { 'Accept': 'application/json' } })
        .then(function (res) { if (!res.ok) throw new Error('status ' + res.status); })
        .then(cfSent, cfFailed);
    });
  }

  /* ————— boot ————— */
  function raf(time) {
    if (lenis) lenis.raf(time);
    update();
    requestAnimationFrame(raf);
  }

  if (!loopsMode) {
    fetch('assets/frames/manifest.json')
      .then(function (r) { return r.json(); })
      .then(function (m) {
        frameCount = m.count;
        framePad = m.pad || 4;
        frameExt = m.ext || '.jpg';
        /* manifest.zones = [afterClip1 .. afterClip5] as frame fractions, which are
           also scroll fractions now the clips share the scroll evenly */
        if (m.zones && m.zones.length >= 5) setBoundaries(m.zones);
        loadedFlags = new Array(frameCount);
        measure();
        preload();
        update();
      })
      .catch(function () { /* frames not built yet — page still works */ });

    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', function () { measure(); update(); });
    measure();
    update();
    requestAnimationFrame(raf);
  } else {
    function loopsNavState() {
      if (!window.innerWidth || !window.innerHeight) return;
      var mcTop = mainContent.getBoundingClientRect().top;
      nav.classList.toggle('on-ground', mcTop <= nav.offsetHeight);
    }
    window.addEventListener('scroll', loopsNavState, { passive: true });
    loopsNavState();

    /* the opening clip comes in two crops: portrait for a phone held upright,
       the original landscape loop for anything wider (a tablet on its side, a
       narrow desktop window), so neither is stretched to fit */
    var heroVideo = document.querySelector('.m-zone--hero video');
    var landscape = window.matchMedia('(orientation: landscape)');
    function pickHeroClip() {
      if (!heroVideo) return;
      var want = heroVideo.getAttribute(landscape.matches ? 'data-src-landscape' : 'data-src-portrait');
      if (!want || heroVideo.getAttribute('src') === want) return;
      heroVideo.setAttribute('src', want);
      var r = heroVideo.getBoundingClientRect();
      if (r.bottom > 0 && r.top < window.innerHeight) heroVideo.play().catch(function () {});
    }
    pickHeroClip();
    if (landscape.addEventListener) landscape.addEventListener('change', pickHeroClip);

    /* play the opening loop only while it is in view: a looping video scrolled
       off-screen is a battery and data cost on a phone */
    var mobileVideos = document.querySelectorAll('.descent-mobile video');
    var videoObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          if (v.paused) v.play().catch(function () {});
        } else if (!v.paused) {
          v.pause();
        }
      });
    }, { threshold: 0.25 });
    mobileVideos.forEach(function (v) { videoObserver.observe(v); });
  }
})();
