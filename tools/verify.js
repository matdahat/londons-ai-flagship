/* Headless verification: drive the descent, assert zone labels/copy, save screenshots. */
const puppeteer = require('puppeteer-core');
const path = require('path');

const OUT = process.argv[2] || '/tmp/londons-flagship-verify';
const BASE = 'http://localhost:4175';

(async () => {
  const fs = require('fs');
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: 'new',
    args: ['--hide-scrollbars', '--mute-audio']
  });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
  await page.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2500));

  const vh = 900;
  const scrollable = 9.9 * vh - vh; /* 990vh track */
  const stops = [
    ['01-hero', 0.0],
    ['02-city-mid', 0.09],
    ['03-building', 0.20],
    ['04-studio', 0.33],
    ['05-floor', 0.48],
    ['06-warning', 0.61],
    ['07-convergence', 0.78],
    ['08-hold', 0.93]
  ];

  const results = [];
  for (const [name, t] of stops) {
    await page.evaluate(y => window.scrollTo(0, y), Math.round(t * scrollable));
    await new Promise(r => setTimeout(r, 1800));
    const state = await page.evaluate(() => ({
      p: window.__descent && +window.__descent.p.toFixed(3),
      frame: window.__descent && window.__descent.frame,
      label: document.getElementById('zone-index').textContent + ' — ' +
             document.getElementById('zone-name').textContent,
      heroOp: getComputedStyle(document.getElementById('copy-hero')).opacity,
      z2: getComputedStyle(document.getElementById('copy-z2')).opacity,
      z3: getComputedStyle(document.getElementById('copy-z3')).opacity,
      z4: getComputedStyle(document.getElementById('copy-z4')).opacity,
      z5: getComputedStyle(document.getElementById('copy-z5')).opacity,
      warning: getComputedStyle(document.getElementById('zone-warning')).opacity,
      navGround: document.getElementById('site-nav').classList.contains('on-ground')
    }));
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    results.push({ name, t, ...state });
  }

  /* main content sections */
  for (const [name, sel] of [['09-services', '#services'], ['10-beyond', '#beyond'],
    ['11-proof', '#proof'], ['12-how', '#how'], ['13-poster', '#contact'], ['14-footer', '.site-footer']]) {
    await page.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'start' }), sel);
    await new Promise(r => setTimeout(r, 1200));
    await page.screenshot({ path: path.join(OUT, name + '.png') });
  }
  const posterState = await page.evaluate(() => {
    const poster = document.getElementById('contact');
    const cs = getComputedStyle(poster);
    return { bg: cs.backgroundColor, navGround: document.getElementById('site-nav').classList.contains('on-ground') };
  });

  /* mobile pass */
  const mob = await browser.newPage();
  await mob.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await mob.goto(BASE + '/', { waitUntil: 'networkidle2', timeout: 60000 });
  await new Promise(r => setTimeout(r, 2000));
  const mobState = await mob.evaluate(() => ({
    loops: document.documentElement.classList.contains('film-loops'),
    videos: [...document.querySelectorAll('.descent-mobile video')].map(v => ({
      src: v.getAttribute('src'), ready: v.readyState, playing: !v.paused, w: v.videoWidth
    }))
  }));
  await mob.screenshot({ path: path.join(OUT, 'm1-top.png') });
  await mob.evaluate(() => document.querySelector('.descent-mobile .m-zone:nth-of-type(3)').scrollIntoView());
  await new Promise(r => setTimeout(r, 1200));
  await mob.screenshot({ path: path.join(OUT, 'm2-studio.png') });
  await mob.evaluate(() => document.querySelector('.descent-mobile .m-warning').scrollIntoView());
  await new Promise(r => setTimeout(r, 1200));
  await mob.screenshot({ path: path.join(OUT, 'm3-warning.png') });
  await mob.evaluate(() => document.getElementById('contact').scrollIntoView());
  await new Promise(r => setTimeout(r, 1200));
  await mob.screenshot({ path: path.join(OUT, 'm4-poster.png') });

  console.log(JSON.stringify({ desktop: results, poster: posterState, mobile: mobState }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
