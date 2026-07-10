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
  const shapes = utils.$('.hero-art .shape');
  const tag = utils.$('.hero-tag');
  const h1 = document.querySelector('.hero h1');
  const body = utils.$('.hero-body');

  const tl = createTimeline({ defaults: { ease: 'out(3)' } });

  if (shapes.length) {
    utils.set(shapes, { opacity: 0, scale: P.drift ? 0 : 1 });
    tl.add(shapes, {
      opacity: [0, 1],
      ...(P.drift ? { scale: [0, 1], rotate: [-14, 0] } : {}),
      delay: stagger(90),
      duration: 900,
      ease: P.drift ? 'outBack' : 'out(2)',
    });
  }

  utils.set(tag, { opacity: 0 });
  tl.add(tag, { opacity: [0, 1], translateY: ['0.8rem', 0], duration: 500 }, '-=650');

  if (P.splitWords && h1) {
    const words = splitWords(h1);
    utils.set(words, { opacity: 0 });
    tl.add(words, {
      opacity: [0, 1],
      translateY: ['0.6em', 0],
      delay: stagger(45),
      duration: 700,
    }, '-=350');
  } else if (h1) {
    utils.set(h1, { opacity: 0 });
    tl.add(h1, { opacity: [0, 1], translateY: ['1rem', 0], duration: 700 }, '-=350');
  }

  utils.set(body, { opacity: 0 });
  tl.add(body, { opacity: [0, 1], translateY: ['1rem', 0], duration: 600 }, '-=400');

  // CTA arrow draws itself once the hero has settled.
  if (P.draw) {
    const arrow = svg.createDrawable('.hero-cta .drawable');
    if (arrow.length) {
      tl.add(arrow, { draw: ['0 0', '0 1'], duration: 700, ease: 'inOutQuad' }, '-=300');
    }
  }

  // Ambient drift: each shape floats on its own randomized rhythm.
  if (P.drift) {
    shapes.forEach((shape) => {
      animate(shape, {
        translateY: utils.random(8, 18),
        duration: utils.random(4000, 9000),
        delay: utils.random(0, 1200),
        ease: 'inOutSine',
        loop: true,
        alternate: true,
      });
    });
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

function setupPrinciples(P) {
  const rows = utils.$('.principle');
  if (!rows.length) return;

  if (MODE === 'bold') {
    rows.forEach((row, i) => {
      utils.set(row, { opacity: 0, translateX: i % 2 ? 30 : -30 });
      animate(row, {
        opacity: [0, 1],
        translateX: 0,
        duration: P.revealDuration,
        ease: P.ease,
        autoplay: onScroll({ target: row, enter: 'bottom-=60 top', once: true }),
      });
      const index = row.querySelector('.principle-index');
      if (index) {
        utils.set(index, { scale: 0.4 });
        animate(index, {
          scale: [0.4, 1],
          duration: 650,
          ease: 'outBack',
          autoplay: onScroll({ target: row, enter: 'bottom-=60 top', once: true }),
        });
      }
    });
  } else {
    reveal('.principle', P, { trigger: '.principles' });
  }

  // Ink line drawn down the section, scrubbed to scroll (bold only).
  if (P.scrub) {
    const list = document.querySelector('.principles');
    const ns = 'http://www.w3.org/2000/svg';
    const lineSvg = document.createElementNS(ns, 'svg');
    lineSvg.setAttribute('class', 'principles-line');
    lineSvg.setAttribute('viewBox', '0 0 2 100');
    lineSvg.setAttribute('preserveAspectRatio', 'none');
    lineSvg.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(ns, 'path');
    path.setAttribute('d', 'M1 0 V100');
    path.setAttribute('stroke', '#f9c027');
    path.setAttribute('stroke-width', '2');
    path.setAttribute('fill', 'none');
    lineSvg.appendChild(path);
    list.appendChild(lineSvg);
    animate(svg.createDrawable(path), {
      draw: ['0 0', '0 1'],
      ease: 'linear',
      autoplay: onScroll({
        target: list,
        enter: 'bottom top',
        leave: 'top+=200 top',
        sync: true,
      }),
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
/* Boot                                                                */
/* ------------------------------------------------------------------ */

let motionParams = null; // null = reduced motion, no animation

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
  setupPrinciples(P);
  setupStatement(P);
  setupPortfolio(P);
  setupWriting(P);
  setupContact(P);
  if (MODE === 'bold') setupNavProgress();
});
