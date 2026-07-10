/* hectormurlopez.com — animation system + content rendering
 *
 * Powered by anime.js v4.5.0 (self-hosted, /vendor/animejs — MIT).
 *
 * Motion modes — controlled by <html data-motion="...">:
 *   "bold" (default)  full showcase: floating Miró shapes, word reveals,
 *                     SVG line-drawing, scroll-scrubbed parallax.
 *   "calm"            moderate fallback: simple fades and rises, no loops.
 *   prefers-reduced-motion: reduce  overrides both — nothing animates and
 *                     nothing is ever hidden.
 *
 * Safety rule: all animation start states (opacity 0, offsets) are applied
 * from JS. If this file fails to load, the page is fully readable.
 */

import {
  animate,
  stagger,
  createAnimatable,
  createTimeline,
  createScope,
  onScroll,
  svg,
  utils,
} from '/vendor/animejs/anime.esm.min.js';

const MODE = document.documentElement.dataset.motion === 'calm' ? 'calm' : 'bold';

const PARAMS = {
  bold: {
    revealY: '2.5rem',
    revealDuration: 750,
    revealStagger: 120,
    ease: 'out(3)',
    cardEase: 'outBack',
    cardRotate: true,
    draw: true,
    drawDuration: 1300,
    drift: true,
    scrub: true,
    splitWords: true,
  },
  calm: {
    revealY: '1.25rem',
    revealDuration: 600,
    revealStagger: 100,
    ease: 'out(2)',
    cardEase: 'out(2)',
    cardRotate: false,
    draw: false,
    drawDuration: 0,
    drift: false,
    scrub: false,
    splitWords: false,
  },
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

// Wrap each word in a span.w, preserving <br> and nested spans (e.g. .dim).
function splitWords(el) {
  const words = [];
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const frag = document.createDocumentFragment();
        child.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) {
            frag.appendChild(document.createTextNode(part));
          } else {
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = part;
            frag.appendChild(s);
            words.push(s);
          }
        });
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
        walk(child);
      }
    });
  };
  walk(el);
  return words;
}

// Wrap each character in a span.c (inside the span.w word wrappers so
// words still wrap as units). Used for the hero headline cascade.
function splitChars(el) {
  const chars = [];
  splitWords(el).forEach((word) => {
    const text = word.textContent;
    word.textContent = '';
    [...text].forEach((ch) => {
      const s = document.createElement('span');
      s.className = 'c';
      s.textContent = ch;
      word.appendChild(s);
      chars.push(s);
    });
  });
  return chars;
}

// Scroll-triggered rise-and-fade for a set of elements.
function reveal(targets, P, opts = {}) {
  const els = utils.$(targets);
  if (!els.length) return;
  utils.set(els, { opacity: 0 });
  animate(els, {
    opacity: [0, 1],
    translateY: [opts.y ?? P.revealY, '0rem'],
    ...(P.cardRotate && opts.rotate ? { rotate: [opts.rotate, 0] } : {}),
    delay: stagger(opts.stagger ?? P.revealStagger),
    duration: opts.duration ?? P.revealDuration,
    ease: opts.ease ?? P.ease,
    autoplay: onScroll({
      target: opts.trigger ?? els[0],
      enter: 'bottom-=80 top',
      once: true,
    }),
  });
}

// SVG stroke line-drawing on scroll (bold mode only — callers gate on P.draw).
function drawOnScroll(selector, P, opts = {}) {
  const drawables = svg.createDrawable(selector);
  if (!drawables.length) return;
  animate(drawables, {
    draw: ['0 0', '0 1'],
    delay: stagger(opts.stagger ?? 120),
    duration: opts.duration ?? P.drawDuration,
    ease: 'inOutQuad',
    autoplay: onScroll({
      target: opts.trigger,
      enter: 'bottom-=80 top',
      once: true,
    }),
  });
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

function setupNav(P) {
  const nav = document.querySelector('nav');
  utils.set(nav, { opacity: 0 });
  animate(nav, { opacity: [0, 1], duration: 600, delay: 100, ease: 'out(2)' });
}

// Scroll-progress ring in the nav (bold only).
function setupNavProgress() {
  const el = document.querySelector('.nav-progress');
  const fill = el?.querySelector('.nav-progress-fill');
  if (!fill) return;
  el.classList.add('active');
  const C = 2 * Math.PI * 13;
  fill.setAttribute('stroke-dasharray', String(C));
  fill.setAttribute('stroke-dashoffset', String(C));
  let ticking = false;
  const update = () => {
    ticking = false;
    const doc = document.documentElement;
    const max = doc.scrollHeight - window.innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 0;
    fill.setAttribute('stroke-dashoffset', String(C * (1 - p)));
  };
  window.addEventListener(
    'scroll',
    () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(update);
      }
    },
    { passive: true }
  );
  update();
}

function setupHero(P) {
  if (P.drift) setupHeroBold(P);
  else setupHeroCalm(P);
}

// Calm mode: quiet fades, two static shapes (CSS hides the rest).
function setupHeroCalm(P) {
  const tl = createTimeline({ defaults: { ease: 'out(2)' } });
  const shapes = utils.$('.hero-art .shape');
  if (shapes.length) {
    utils.set(shapes, { opacity: 0 });
    tl.add(shapes, { opacity: [0, 1], delay: stagger(90), duration: 900 });
  }
  const tag = utils.$('.hero-tag');
  utils.set(tag, { opacity: 0 });
  tl.add(tag, { opacity: [0, 1], translateY: ['0.8rem', 0], duration: 500 }, '-=650');
  const h1 = document.querySelector('.hero h1');
  if (h1) {
    utils.set(h1, { opacity: 0 });
    tl.add(h1, { opacity: [0, 1], translateY: ['1rem', 0], duration: 700 }, '-=350');
  }
  const body = utils.$('.hero-body');
  utils.set(body, { opacity: 0 });
  tl.add(body, { opacity: [0, 1], translateY: ['1rem', 0], duration: 600 }, '-=400');
}

// Bold mode: shapes fly in from scattered positions with elastic physics,
// the headline lands letter by letter, then the whole composition comes
// alive — cursor parallax, an orbiting dot, a breathing sun, a squiggle
// that keeps redrawing itself, and a magnetic CTA.
function setupHeroBold(P) {
  const shapes = utils.$('.hero-art .shape');
  const tag = utils.$('.hero-tag');
  const h1 = document.querySelector('.hero h1');
  const body = utils.$('.hero-body');

  shapes.forEach((s) => {
    utils.set(s, {
      opacity: 0,
      translateX: utils.random(-420, 420),
      translateY: utils.random(-240, 240),
      rotate: utils.random(-140, 140),
      scale: 0.2,
    });
  });
  utils.set(tag, { opacity: 0 });
  const chars = h1 ? splitChars(h1) : [];
  utils.set(chars, {
    opacity: 0,
    translateY: '0.9em',
    rotate: () => utils.random(-24, 24),
  });
  utils.set(body, { opacity: 0, translateY: '1.2rem' });

  const tl = createTimeline();
  if (shapes.length) {
    tl.add(shapes, {
      opacity: { to: 1, duration: 450, ease: 'out(2)' },
      translateX: 0,
      translateY: 0,
      rotate: 0,
      scale: 1,
      duration: 1500,
      ease: 'outElastic(1, .65)',
      delay: stagger(90),
    });
  }
  tl.add(tag, { opacity: [0, 1], translateY: ['0.8rem', 0], duration: 500, ease: 'out(3)' }, '-=1350');
  if (chars.length) {
    tl.add(chars, {
      opacity: { to: 1, duration: 260, ease: 'out(2)' },
      translateY: '0em',
      rotate: 0,
      duration: 800,
      ease: 'outBack',
      delay: stagger(16),
    }, '-=1100');
  }
  tl.add(body, { opacity: [0, 1], translateY: ['1.2rem', '0rem'], duration: 600, ease: 'out(3)' }, '-=450');
  if (P.draw) {
    const arrow = svg.createDrawable('.hero-cta .drawable');
    if (arrow.length) {
      tl.add(arrow, { draw: ['0 0', '0 1'], duration: 700, ease: 'inOutQuad' }, '-=350');
    }
  }

  tl.then(() => startHeroAmbient(shapes));
}

function startHeroAmbient(shapes) {
  // Drift lives on each shape's inner geometry so it never fights the
  // cursor parallax, which owns the outer <svg> transforms.
  shapes.forEach((shape) => {
    const inner = shape.firstElementChild;
    if (!inner) return;
    animate(inner, {
      translateY: utils.random(6, 14),
      duration: utils.random(3200, 7000),
      delay: utils.random(0, 1000),
      ease: 'inOutSine',
      loop: true,
      alternate: true,
    });
  });

  // A red dot rides the blue orbit circle.
  const orbitGroup = document.querySelector('.shape-orbit .orbit-group');
  if (orbitGroup) {
    animate(orbitGroup, { rotate: 360, duration: 14000, ease: 'linear', loop: true });
  }

  // The sun breathes.
  const sunDisc = document.querySelector('.shape-sun circle');
  if (sunDisc) {
    animate(sunDisc, { scale: 1.06, duration: 3800, ease: 'inOutSine', loop: true, alternate: true });
  }

  // The squiggle keeps redrawing itself.
  const squiggle = svg.createDrawable('.shape-squiggle .drawable');
  if (squiggle.length) {
    animate(squiggle, {
      draw: [{ to: '0 1' }, { to: '1 1' }],
      duration: 4200,
      ease: 'inOutQuad',
      loop: true,
      loopDelay: 1400,
    });
  }

  // Cursor parallax: every shape follows the pointer at its own depth.
  if (matchMedia('(hover: hover)').matches) {
    const depths = [26, 44, 36, 52, 18, 60, 32];
    const followers = shapes.map((s) =>
      createAnimatable(s, { translateX: 450, translateY: 450, ease: 'out(3)' })
    );
    window.addEventListener('mousemove', (e) => {
      const nx = e.clientX / window.innerWidth - 0.5;
      const ny = e.clientY / window.innerHeight - 0.5;
      followers.forEach((f, i) => {
        const d = depths[i % depths.length];
        f.translateX(nx * d);
        f.translateY(ny * d * 0.7);
      });
    }, { passive: true });

    // Magnetic CTA: the Explore button leans toward the cursor.
    const cta = document.querySelector('.hero-cta');
    if (cta) {
      const magnet = createAnimatable(cta, { translateX: 350, translateY: 350, ease: 'out(2)' });
      cta.addEventListener('mousemove', (e) => {
        const r = cta.getBoundingClientRect();
        magnet.translateX((e.clientX - r.left - r.width / 2) * 0.3);
        magnet.translateY((e.clientY - r.top - r.height / 2) * 0.4);
      });
      cta.addEventListener('mouseleave', () => {
        magnet.translateX(0);
        magnet.translateY(0);
      });
    }
  }
}

function setupRules(P) {
  if (!P.scrub) return; // calm: dividers stay static
  utils.$('.rule').forEach((rule) => {
    utils.set(rule, { scaleX: 0 });
    animate(rule, {
      scaleX: [0, 1],
      duration: 1000,
      ease: 'inOutQuart',
      autoplay: onScroll({ target: rule, enter: 'bottom top', once: true }),
    });
  });
}

function setupAbout(P) {
  reveal('.about-section h2', P, { trigger: '.about-section' });
  reveal('.about-bio p', P, { trigger: '.about-bio', stagger: 90 });
  reveal('.about-highlight', P, { trigger: '.about-aside', y: '1.5rem' });
  if (P.draw) {
    drawOnScroll('.about-star .drawable', P, { trigger: '.about-aside' });
  }
}

function setupPillars(P) {
  reveal('.pillar', P, { trigger: '.pillars', rotate: -1.5, ease: P.cardEase });
  if (P.draw) {
    drawOnScroll('.pillar-glyph .drawable', P, { trigger: '.pillars', stagger: 150 });
    // Playful one-shot glyph spin on hover.
    utils.$('.pillar').forEach((pillar) => {
      const glyph = pillar.querySelector('.pillar-glyph');
      if (!glyph) return;
      let spinning = false;
      pillar.addEventListener('mouseenter', () => {
        if (spinning) return;
        spinning = true;
        animate(glyph, {
          rotate: '+=360',
          duration: 800,
          ease: 'inOutBack',
          onComplete: () => { spinning = false; },
        });
      });
    });
  }
}

function setupStatement(P) {
  const p = document.querySelector('.statement p');
  if (!p) return;

  if (P.splitWords) {
    const words = splitWords(p);
    utils.set(words, { opacity: 0 });
    animate(words, {
      opacity: [0, 1],
      translateY: ['0.5em', 0],
      delay: stagger(35),
      duration: 650,
      ease: 'out(3)',
      autoplay: onScroll({ target: '.statement', enter: 'bottom-=120 top', once: true }),
    });
  } else {
    reveal('.statement p', P, { trigger: '.statement' });
  }

  if (P.scrub) {
    animate('.statement-disc', {
      translateY: [-45, 45],
      ease: 'linear',
      autoplay: onScroll({ target: '.statement', enter: 'bottom top', leave: 'top bottom', sync: true }),
    });
    animate('.statement-arc', {
      translateY: [35, -35],
      ease: 'linear',
      autoplay: onScroll({ target: '.statement', enter: 'bottom top', leave: 'top bottom', sync: true }),
    });
  }
}

function setupPortfolio(P) {
  reveal('.portfolio-section h2', P, { trigger: '.portfolio-section' });
  reveal('.project-card', P, {
    trigger: '.projects',
    rotate: -1.2,
    ease: P.cardEase,
    y: '3rem',
  });
  if (MODE === 'bold') {
    reveal('.project-tags .tag', P, {
      trigger: '.projects',
      y: '0.6rem',
      stagger: 60,
      duration: 450,
    });
  }
}

function setupWriting(P) {
  reveal('.writing-section h2', P, { trigger: '.writing-section' });
  reveal('.writing-intro', P, { trigger: '.writing-section', y: '1rem' });
  reveal('.subscribe-box', P, { trigger: '.subscribe-box', y: '1.5rem' });
}

// Essay cards arrive async (see posts rendering) — reveal them on injection.
function revealEssays(items, P) {
  reveal(items, P, { trigger: '.essays', y: '1.5rem', stagger: 90 });
}

function setupContact(P) {
  reveal('.contact-section h2', P, { trigger: '.contact-section' });
  reveal('.contact-link', P, { trigger: '.contact-links', y: '1.5rem' });
  if (P.draw) {
    drawOnScroll('.contact-sun .drawable', P, { trigger: '.contact-section', stagger: 90 });
  }
}

/* ------------------------------------------------------------------ */
/* Latest essays — rendered from posts.json (synced by GitHub Action)  */
/* ------------------------------------------------------------------ */

// Only links back to the newsletter are ever rendered — keeps the
// pipeline poison-proof even if the feed data were ever tampered with.
const SUBSTACK_ORIGIN = 'https://hectormurlopez.substack.com';

function essayArrow() {
  const ns = 'http://www.w3.org/2000/svg';
  const arrow = document.createElementNS(ns, 'svg');
  arrow.setAttribute('class', 'essay-arrow');
  arrow.setAttribute('width', '14');
  arrow.setAttribute('height', '10');
  arrow.setAttribute('viewBox', '0 0 14 10');
  arrow.setAttribute('fill', 'none');
  arrow.setAttribute('aria-hidden', 'true');
  arrow.setAttribute('focusable', 'false');
  const path = document.createElementNS(ns, 'path');
  path.setAttribute('d', 'M1 5h12M8 1l5 4-5 4');
  path.setAttribute('stroke', 'currentColor');
  path.setAttribute('stroke-width', '1.2');
  path.setAttribute('stroke-linecap', 'round');
  path.setAttribute('stroke-linejoin', 'round');
  arrow.appendChild(path);
  return arrow;
}

function buildEssayItem(post) {
  // Strictly createElement + textContent — feed data is never parsed as HTML.
  const li = document.createElement('li');
  const link = document.createElement('a');
  link.className = 'essay-card';
  link.href = post.url;
  link.target = '_blank';
  link.rel = 'noopener';

  const time = document.createElement('time');
  time.dateTime = post.date;
  const parsed = new Date(`${post.date}T00:00:00`);
  time.textContent = Number.isNaN(parsed.getTime())
    ? post.date
    : new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric' }).format(parsed);

  const body = document.createElement('div');
  const title = document.createElement('h3');
  title.textContent = post.title;
  body.appendChild(title);
  if (post.excerpt) {
    const excerpt = document.createElement('p');
    excerpt.textContent = post.excerpt;
    body.appendChild(excerpt);
  }

  link.append(time, body, essayArrow());
  li.appendChild(link);
  return li;
}

function validPost(post) {
  if (!post || typeof post.title !== 'string' || !post.title.trim()) return false;
  if (typeof post.url !== 'string' || typeof post.date !== 'string') return false;
  try {
    return new URL(post.url).origin === SUBSTACK_ORIGIN;
  } catch {
    return false;
  }
}

async function renderPosts() {
  const list = document.querySelector('.essays');
  if (!list) return;
  try {
    const res = await fetch('/posts.json', { cache: 'no-cache' });
    if (!res.ok) return;
    const data = await res.json();
    const posts = (Array.isArray(data?.posts) ? data.posts : []).filter(validPost).slice(0, 5);
    if (!posts.length) return; // section degrades to subscribe box + link

    const items = posts.map(buildEssayItem);
    list.append(...items);
    list.hidden = false;

    if (motionParams) {
      revealEssays(items.map((li) => li.firstElementChild), motionParams);
    }
  } catch {
    // fetch/parse failed — the essays list simply stays hidden
  }
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

let motionParams = null; // null = reduced motion, no animation

function boot() {
  createScope({
    mediaQueries: { reduced: '(prefers-reduced-motion: reduce)' },
  }).add((self) => {
    if (self.matches.reduced) {
      motionParams = null;
      return; // nothing animates, nothing is hidden
    }
    const P = PARAMS[MODE];
    motionParams = P;
    setupNav(P);
    setupHero(P);
    setupRules(P);
    setupAbout(P);
    setupPillars(P);
    setupStatement(P);
    setupPortfolio(P);
    setupWriting(P);
    setupContact(P);
    if (MODE === 'bold') setupNavProgress();
  });

  renderPosts();
}

/* ------------------------------------------------------------------ */
/* Coming-soon gate (temporary — delete the #gate block in index.html  */
/* at launch and this section becomes a no-op)                         */
/* ------------------------------------------------------------------ */

// SHA-256 of the site key. To change the key:
//   node -e "crypto.subtle.digest('SHA-256', new TextEncoder().encode('NEW-KEY')).then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')))"
// Note: this is a curtain, not a vault — the source is public, so it keeps
// out casual visitors, not determined ones.
const GATE_HASH = '4497efb7c8acf0e17afab99d2db2d5facae578ce7382493ab0cf0c2f809110e4';
const GATE_STORE = 'hml-site-key';

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function openSite() {
  document.getElementById('gate')?.remove();
  document.querySelectorAll('nav[hidden], main[hidden], footer[hidden], .skip-link[hidden]')
    .forEach((el) => el.removeAttribute('hidden'));
  boot();
}

const gate = document.getElementById('gate');

if (!gate || localStorage.getItem(GATE_STORE) === GATE_HASH) {
  openSite();
} else {
  const form = gate.querySelector('.gate-form');
  const input = gate.querySelector('.gate-input');
  const error = gate.querySelector('.gate-error');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hash = await sha256Hex(input.value.trim());
    if (hash === GATE_HASH) {
      localStorage.setItem(GATE_STORE, hash);
      if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
        openSite();
      } else {
        animate(gate, {
          opacity: [1, 0],
          duration: 450,
          ease: 'out(2)',
          onComplete: openSite,
        });
      }
      window.scrollTo(0, 0);
    } else {
      error.hidden = false;
      input.select();
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animate(input, {
          translateX: [{ to: -8 }, { to: 8 }, { to: -5 }, { to: 5 }, { to: 0 }],
          duration: 400,
          ease: 'inOutQuad',
        });
      }
    }
  });
}
