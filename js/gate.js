/* hectormurlopez.com — pre-launch gate
 *
 * Shared by index.html (which owns the gate form) and every generated
 * project page (which has no form and just bounces to the homepage).
 *
 * This is a curtain, not a vault. The key hash below ships in the client,
 * so it keeps out a casual visitor and would not keep out anyone who opens
 * devtools. Don't put anything on the site you'd mind a stranger reading.
 *
 * To change the key:
 *   node -e "crypto.subtle.digest('SHA-256', new TextEncoder().encode('NEW-KEY')).then(b => console.log([...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('')))"
 *
 * At launch: delete the #gate block from index.html and set "gated": false
 * in projects.json, then rebuild. Both paths below become no-ops.
 */

import { animate } from '/vendor/animejs/anime.esm.min.js';

const GATE_HASH = '4497efb7c8acf0e17afab99d2db2d5facae578ce7382493ab0cf0c2f809110e4';
const GATE_STORE = 'hml-site-key';

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function isUnlocked() {
  try {
    return localStorage.getItem(GATE_STORE) === GATE_HASH;
  } catch {
    return false; // storage blocked (private mode, etc.) — treat as locked
  }
}

// Same-origin path only. Rejects "//evil.com" and absolute URLs so the
// ?next= round-trip can't be turned into an open redirect.
function safePath(value) {
  if (typeof value !== 'string') return null;
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

/* ------------------------------------------------------------------ */
/* Homepage: the gate form lives here                                  */
/* ------------------------------------------------------------------ */

export function mountGate(onUnlock) {
  const gate = document.getElementById('gate');

  // No gate in the markup means the site has launched — boot straight through.
  if (!gate) {
    onUnlock();
    return;
  }

  const open = () => {
    gate.remove();
    onUnlock();
    // If we got here from a project page, hand the visitor back to it.
    const next = safePath(new URLSearchParams(location.search).get('next'));
    if (next) location.replace(next);
  };

  if (isUnlocked()) {
    open();
    return;
  }

  const form = gate.querySelector('.gate-form');
  const input = gate.querySelector('.gate-input');
  const error = gate.querySelector('.gate-error');
  if (!form || !input) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const hash = await sha256Hex(input.value.trim());

    if (hash !== GATE_HASH) {
      if (error) error.hidden = false;
      input.select();
      if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
        animate(input, {
          translateX: [{ to: -8 }, { to: 8 }, { to: -5 }, { to: 5 }, { to: 0 }],
          duration: 400,
          ease: 'inOutQuad',
        });
      }
      return;
    }

    try {
      localStorage.setItem(GATE_STORE, hash);
    } catch {
      // Storage blocked — they still get in for this pageview, just not the next.
    }
    window.scrollTo(0, 0);
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      open();
    } else {
      animate(gate, { opacity: [1, 0], duration: 450, ease: 'out(2)', onComplete: open });
    }
  });
}

/* ------------------------------------------------------------------ */
/* Project pages: no form, just a bounce                               */
/* ------------------------------------------------------------------ */

// Generated pages carry <html data-gated="true"> while the site is gated.
// Rebuild with "gated": false in projects.json and this stops bouncing —
// which is what stops these pages redirecting forever once the homepage
// gate has been deleted.
export function requireUnlock(onUnlock) {
  const root = document.documentElement;
  const gated = root.dataset.gated === 'true';

  if (!gated || isUnlocked()) {
    // styles.css keeps <body> hidden while data-gated is set and this class
    // is absent, so gated content never flashes before the redirect below.
    root.classList.add('unlocked');
    onUnlock();
    return;
  }

  const next = encodeURIComponent(location.pathname + location.search);
  location.replace(`/?next=${next}`);
}
