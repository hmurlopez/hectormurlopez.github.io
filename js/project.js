/* hectormurlopez.com — project pages
 *
 * A deliberately smaller cousin of main.js: these pages are for reading, so
 * they get scroll reveals and nothing that moves on its own.
 *
 * Same safety rule as main.js — every hidden start state is applied from
 * JavaScript, so if this file fails to load the page is still fully readable.
 * (The one exception is the pre-launch gate, which fails closed on purpose;
 * see js/gate.js.)
 */

import { animate, stagger, onScroll, utils } from '/vendor/animejs/anime.esm.min.js';
import { requireUnlock } from '/js/gate.js';

function reveal(targets, opts = {}) {
  const els = utils.$(targets);
  if (!els.length) return;
  utils.set(els, { opacity: 0 });
  animate(els, {
    opacity: [0, 1],
    translateY: [opts.y ?? '2rem', '0rem'],
    delay: stagger(opts.stagger ?? 90),
    duration: opts.duration ?? 700,
    ease: 'out(3)',
    autoplay: onScroll({ target: opts.trigger ?? els[0], enter: 'bottom-=80 top', once: true }),
  });
}

function boot() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  // Hero animates on load rather than on scroll — it's already in view.
  const hero = utils.$('.project-hero > *, .index-hero > *');
  if (hero.length) {
    utils.set(hero, { opacity: 0 });
    animate(hero, {
      opacity: [0, 1],
      translateY: ['1.5rem', '0rem'],
      delay: stagger(80, { start: 100 }),
      duration: 750,
      ease: 'out(3)',
    });
  }

  utils.$('.rule').forEach((rule) => {
    utils.set(rule, { scaleX: 0 });
    animate(rule, {
      scaleX: [0, 1],
      duration: 900,
      ease: 'inOutQuart',
      autoplay: onScroll({ target: rule, enter: 'bottom top', once: true }),
    });
  });

  utils.$('.section-title').forEach((title) => reveal(title, { trigger: title }));

  reveal('.prose p', { trigger: '.prose' });
  reveal('.spec', { trigger: '.specs', y: '1rem', stagger: 70 });
  reveal('.step', { trigger: '.steps', y: '2.5rem', stagger: 130 });
  reveal('.metric', { trigger: '.metrics', y: '1.25rem', stagger: 90 });
  reveal('.learnings li', { trigger: '.learnings', y: '1.25rem' });
  reveal('.gallery-figure', { trigger: '.gallery', y: '2rem' });
  reveal('.pager-link', { trigger: '.pager', y: '1rem' });
  reveal('.project-card', { trigger: '.projects-index', y: '3rem', stagger: 110 });

  // The timeline's connecting line grows as you scroll through the process.
  const steps = document.querySelector('.steps');
  if (steps) {
    utils.set(steps, { '--track-scale': 0 });
    animate(steps, {
      '--track-scale': 1,
      ease: 'linear',
      autoplay: onScroll({
        target: steps,
        enter: 'bottom-=120 top',
        leave: 'top+=120 bottom',
        sync: 0.4,
      }),
    });
  }
}

requireUnlock(boot);
