/* Londons.ai — The Flagship. One unbroken descent through six chained clips,
   paced by scroll. A single light-ground pause (THE WARNING) interrupts the
   film without cutting it: frame progress holds on clip 4's last frame while
   the page reads, then resumes into clip 5 exactly where it left off. */
(function () {
  'use strict';

  var doc = document.documentElement;

  /* ————— film mode: scrub on fine pointers, stacked loops on touch-only/small ————— */
  var touchOnly = window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  function viewportW() {
    return window.innerWidth || doc.clientWidth || window.screen.width || 0;
  }
  var loopsMode = touchOnly || (viewportW() > 0 && viewportW() < 901);
  if (loopsMode) doc.classList.add('film-loops');

  window.addEventListener('resize', function () {
    var w = viewportW();
    var want = touchOnly || (w > 0 && w < 901);
    if (want !== loopsMode) window.location.reload();
  });

  /* ————— smooth scroll ————— */
  var lenis = null;
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var noLenis = /[?&]nolenis/.test(window.location.search);
  if (!loopsMode && !reducedMotion && !noLenis && window.Lenis) {
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
  var navBrand = nav.querySelector('.brand-lockup');
  var mainContent = document.getElementById('main-content');
  var warningEl = document.getElementById('zone-warning');

  var ZONES = [
    { index: '01', name: 'The City' },
    { index: '02', name: 'The Building' },
    { index: '03', name: 'The Studio' },
    { index: '04', name: 'The Floor' },
    { index: '05', name: 'The Convergence' }
  ];

  /* ————— segment plan (vh) — must match .descent-track height in site.css ————— */
  var SEG_VH = {
    clip1: 130, clip2: 130, clip3: 145, clip4: 130,
    pause: 170,
    clip5: 145, clip6: 140
  };
  var TOTAL_VH = SEG_VH.clip1 + SEG_VH.clip2 + SEG_VH.clip3 + SEG_VH.clip4 +
    SEG_VH.pause + SEG_VH.clip5 + SEG_VH.clip6; /* 990 */

  var c1End = SEG_VH.clip1 / TOTAL_VH;
  var c2End = (SEG_VH.clip1 + SEG_VH.clip2) / TOTAL_VH;
  var c3End = (SEG_VH.clip1 + SEG_VH.clip2 + SEG_VH.clip3) / TOTAL_VH;
  var c4End = (SEG_VH.clip1 + SEG_VH.clip2 + SEG_VH.clip3 + SEG_VH.clip4) / TOTAL_VH; /* pause start */
  var pauseEnd = c4End + SEG_VH.pause / TOTAL_VH; /* clip5 start */
  var c5End = pauseEnd + SEG_VH.clip5 / TOTAL_VH;

  /* pinned copy: [element, fadeInStart, fadeInEnd, fadeOutStart, fadeOutEnd] — in SCROLL fraction.
     Seeded with vh-proportional estimates; refined to the real clip-boundary
     scroll-fractions once the manifest loads (applyRefinedBoundaries below),
     since clip durations vary slightly and this keeps text/zone timing
     locked to the actual footage rather than the vh guess. */
  var COPY = [
    [document.getElementById('copy-hero'), -1, 0, c1End - 0.04, c1End + 0.02],
    [document.getElementById('copy-z2'), c1End - 0.03, c1End + 0.03, c2End - 0.04, c2End + 0.02],
    [document.getElementById('copy-z3'), c2End - 0.03, c2End + 0.03, c3End - 0.04, c3End + 0.02],
    [document.getElementById('copy-z4'), c3End - 0.03, c3End + 0.03, c4End - 0.05, c4End - 0.01],
    [document.getElementById('copy-z5'), pauseEnd - 0.02, pauseEnd + 0.04, c5End - 0.04, c5End + 0.02]
  ];
  var WARNING_FADE = [c4End - 0.02, c4End + 0.03, pauseEnd - 0.03, pauseEnd + 0.02];
  /* zone-label boundaries (scroll fraction where the eyebrow switches) — same refinement */
  var ZONE_BOUNDS = [c1End, c2End, c3End, pauseEnd];

  function applyRefinedBoundaries(zones) {
    var f4 = zones[3];
    if (!(f4 > 0)) return;
    var b1 = (zones[0] / f4) * c4End;
    var b2 = (zones[1] / f4) * c4End;
    var b3 = (zones[2] / f4) * c4End;
    var b4 = c4End;
    var tail = 1 - f4;
    var b5 = tail > 0 ? pauseEnd + ((zones[4] - f4) / tail) * (1 - pauseEnd) : c5End;

    COPY[0][3] = b1 - 0.04; COPY[0][4] = b1 + 0.02;
    COPY[1][1] = b1 - 0.03; COPY[1][2] = b1 + 0.03; COPY[1][3] = b2 - 0.04; COPY[1][4] = b2 + 0.02;
    COPY[2][1] = b2 - 0.03; COPY[2][2] = b2 + 0.03; COPY[2][3] = b3 - 0.04; COPY[2][4] = b3 + 0.02;
    COPY[3][1] = b3 - 0.03; COPY[3][2] = b3 + 0.03; COPY[3][3] = b4 - 0.05; COPY[3][4] = b4 - 0.01;
    COPY[4][1] = pauseEnd - 0.02; COPY[4][2] = pauseEnd + 0.04; COPY[4][3] = b5 - 0.04; COPY[4][4] = b5 + 0.02;

    WARNING_FADE[0] = b4 - 0.02; WARNING_FADE[1] = b4 + 0.03;
    WARNING_FADE[2] = pauseEnd - 0.03; WARNING_FADE[3] = pauseEnd + 0.02;

    ZONE_BOUNDS[0] = b1; ZONE_BOUNDS[1] = b2; ZONE_BOUNDS[2] = b3; ZONE_BOUNDS[3] = pauseEnd;
  }

  /* ————— frame sequence ————— */
  var frames = [];
  var frameCount = 0;
  var framePad = 4;
  var frameExt = '.jpg';
  var frameAtC4End = null; /* fraction of frames where clip4 ends / clip5 begins, from manifest zones */
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

  /* scroll fraction -> frame fraction, holding flat across the WARNING pause */
  function frameFraction(p) {
    var f4 = frameAtC4End != null ? frameAtC4End : c4End;
    if (p <= c4End) {
      return c4End > 0 ? (p / c4End) * f4 : 0;
    }
    if (p <= pauseEnd) {
      return f4;
    }
    var span = 1 - pauseEnd;
    return f4 + (span > 0 ? ((p - pauseEnd) / span) * (1 - f4) : 0);
  }

  function targetFrame() {
    var ff = frameFraction(progress());
    return Math.min(frameCount - 1, Math.round(ff * (frameCount - 1)));
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
      } else {
        navBrand.style.opacity = 1 - o;
      }
    }

    /* THE WARNING — light-ground pause, occludes the held film frame */
    var wo = fadeWindow(p, WARNING_FADE[0], WARNING_FADE[1], WARNING_FADE[2], WARNING_FADE[3]);
    warningEl.style.opacity = wo;
    warningEl.style.visibility = wo > 0.01 ? 'visible' : 'hidden';
    warningEl.style.pointerEvents = wo > 0.5 ? 'auto' : 'none';

    /* nav ground state — also flips dark-on-light while THE WARNING's light
       ground is substantially covering the canvas, so the reversed lockup
       never sits light-on-light */
    var mcTop = mainContent.getBoundingClientRect().top;
    nav.classList.toggle('on-ground', mcTop <= nav.offsetHeight || wo > 0.5);

    window.__descent = { p: p, frame: currentFrame, zone: lastZone, live: live, warning: wo };
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

  /* ————— counters ————— */
  function runCounter(el) {
    var end = parseInt(el.getAttribute('data-count'), 10);
    var t0 = null, DUR = 1400;
    function tick(t) {
      if (!t0) t0 = t;
      var k = Math.min(1, (t - t0) / DUR);
      var eased = 1 - Math.pow(1 - k, 3);
      el.textContent = Math.round(end * eased);
      if (k < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  var counterObserver = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) {
        runCounter(e.target);
        counterObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('.count').forEach(function (el) { counterObserver.observe(el); });

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
        /* manifest.zones = [afterClip1, afterClip2, afterClip3, afterClip4, afterClip5] as frame-fractions */
        if (m.zones && m.zones.length >= 5) {
          frameAtC4End = m.zones[3];
          applyRefinedBoundaries(m.zones);
        }
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
    var mobileHeroLockup = document.querySelector('.descent-mobile .hero-lockup');
    var mobileWarning = document.querySelector('.descent-mobile .m-warning');
    function loopsNavState() {
      if (!window.innerWidth || !window.innerHeight) return;
      var mcTop = mainContent.getBoundingClientRect().top;
      var overWarning = false;
      if (mobileWarning) {
        var wr = mobileWarning.getBoundingClientRect();
        overWarning = wr.top <= nav.offsetHeight && wr.bottom > nav.offsetHeight;
      }
      nav.classList.toggle('on-ground', mcTop <= nav.offsetHeight || overWarning);
      if (mobileHeroLockup) {
        var r = mobileHeroLockup.getBoundingClientRect();
        navBrand.style.opacity = (r.bottom > 0 && r.top < window.innerHeight) ? 0 : 1;
      }
    }
    window.addEventListener('scroll', loopsNavState, { passive: true });
    loopsNavState();

    /* play only the clip currently in view — six autoplaying loops at once
       is a real battery/data cost on a phone, so pause everything off-screen
       instead of relying on the browser to throttle it for us */
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
