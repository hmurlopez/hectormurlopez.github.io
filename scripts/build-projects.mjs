/* Generates the portfolio from projects.json.
 *
 *   node scripts/build-projects.mjs
 *
 * Writes:
 *   index.html            the homepage grid, between the projects: markers
 *   projects/index.html   the full project index
 *   projects/<slug>/      one static page per project
 *   sitemap.xml           every public URL
 *
 * Static output rather than client-side rendering, so each project has a real
 * URL that shares, indexes, and works with JavaScript off. Vercel runs this on
 * every deploy (see vercel.json), and the output is committed too, so the repo
 * also serves correctly from anywhere with no build step at all.
 *
 * No dependencies. Everything interpolated into HTML goes through esc().
 */

import { readFile, writeFile, mkdir, rm, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'projects');

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VERDICTS = new Set(['worked', 'partial', 'failed']);
const VERDICT_LABEL = { worked: 'Worked', partial: 'Partly worked', failed: 'Failed' };

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const esc = (v) =>
  String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const arr = (v) => (Array.isArray(v) ? v : []);

// Only same-origin paths and http(s) URLs become hrefs — keeps a stray
// "javascript:" in the data file from becoming a live link.
function safeHref(url) {
  const s = String(url ?? '').trim();
  if (s.startsWith('/') && !s.startsWith('//')) return s;
  try {
    const { protocol } = new URL(s);
    return protocol === 'https:' || protocol === 'http:' ? s : null;
  } catch {
    return null;
  }
}

const isExternal = (href) => /^https?:/i.test(href);

const ARROW = `<svg width="14" height="10" viewBox="0 0 14 10" fill="none" aria-hidden="true" focusable="false">
            <path d="M1 5h12M8 1l5 4-5 4" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>`;

const pad = (n) => String(n).padStart(2, '0');

/* ------------------------------------------------------------------ */
/* Validation                                                          */
/* ------------------------------------------------------------------ */

function validate(projects) {
  const seen = new Set();
  const problems = [];

  projects.forEach((p, i) => {
    const where = `projects[${i}]`;
    if (!p.slug || !SLUG_RE.test(p.slug)) {
      problems.push(`${where}: slug "${p.slug}" must be lowercase letters, numbers and single hyphens`);
    } else if (seen.has(p.slug)) {
      problems.push(`${where}: duplicate slug "${p.slug}"`);
    } else {
      seen.add(p.slug);
    }
    if (!p.title) problems.push(`${where}: missing title`);

    arr(p.process).forEach((step, j) => {
      if (step.verdict && !VERDICTS.has(step.verdict)) {
        problems.push(`${where}.process[${j}]: verdict "${step.verdict}" must be one of ${[...VERDICTS].join(', ')}`);
      }
    });
  });

  if (problems.length) {
    console.error('projects.json has errors:\n  ' + problems.join('\n  '));
    process.exit(1);
  }
}

/* ------------------------------------------------------------------ */
/* Page shell                                                          */
/* ------------------------------------------------------------------ */

const CSP =
  "default-src 'self'; script-src 'self' https://gc.zgo.at; " +
  "connect-src 'self' https://hmurlopez.goatcounter.com; " +
  "img-src 'self' data: https://hmurlopez.goatcounter.com; " +
  "style-src 'self'; font-src 'self'; base-uri 'none'; form-action 'none'";

function shell({ title, description, canonical, gated, body, siteUrl }) {
  return `<!DOCTYPE html>
<html lang="en" data-motion="bold"${gated ? ' data-gated="true"' : ''}>
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <meta http-equiv="Content-Security-Policy" content="${CSP}"/>
  <meta name="description" content="${esc(description)}"/>
${gated ? '  <meta name="robots" content="noindex"/>\n' : ''}  <title>${esc(title)}</title>
  <link rel="canonical" href="${esc(siteUrl + canonical)}"/>
  <link rel="icon" type="image/svg+xml" href="/icon.svg"/>
  <link rel="preload" href="/fonts/familjen-grotesk-latin-400-normal.woff2" as="font" type="font/woff2" crossorigin/>
  <link rel="stylesheet" href="/styles.css"/>

  <meta property="og:type"        content="article"/>
  <meta property="og:url"         content="${esc(siteUrl + canonical)}"/>
  <meta property="og:title"       content="${esc(title)}"/>
  <meta property="og:description" content="${esc(description)}"/>
  <meta property="og:image"       content="${esc(siteUrl)}/og-image.svg"/>
</head>
<body>

  <a class="skip-link" href="#main">Skip to content</a>

  <nav>
    <div class="nav-left">
      <a class="nav-name" href="/">Hector Mur Lopez</a>
    </div>
    <ul class="nav-links">
      <li><a href="/#about">About</a></li>
      <li><a href="/projects">Projects</a></li>
      <li><a href="/#writing">Writing</a></li>
      <li><a href="/#contact">Contact</a></li>
    </ul>
  </nav>

${body}

  <footer>
    <span>&copy; 2026 Hector Mur Lopez</span>
    <a href="https://www.linkedin.com/in/hector-mur-lopez/" target="_blank" rel="noopener">LinkedIn</a>
  </footer>

  <script type="module" src="/js/project.js"></script>
  <script data-goatcounter="https://hmurlopez.goatcounter.com/count" async src="https://gc.zgo.at/count.js"></script>

</body>
</html>
`;
}

/* ------------------------------------------------------------------ */
/* Fragments                                                           */
/* ------------------------------------------------------------------ */

function tagList(tags) {
  if (!arr(tags).length) return '';
  return `<ul class="project-tags" aria-label="Tags">
${tags.map((t) => `            <li class="tag">${esc(t)}</li>`).join('\n')}
          </ul>`;
}

// Used on the homepage grid and the /projects index. `href` is the detail page.
function card(project, i) {
  return `      <li class="project">
        <a class="project-card" href="/projects/${esc(project.slug)}">
          <span class="project-index">${pad(i + 1)}</span>
          <h3>${esc(project.title)}</h3>
          <p>${esc(project.summary || project.tagline)}</p>
          ${tagList(project.tags)}
          <span class="project-link">
            ${esc(project.status || 'View project')}
            ${ARROW}
          </span>
        </a>
      </li>`;
}

function figure(image, className = 'project-figure') {
  const src = image && safeHref(image.src);
  if (!src) return '';
  const caption = image.caption
    ? `\n        <figcaption>${esc(image.caption)}</figcaption>`
    : '';
  return `
      <figure class="${className}">
        <img src="${esc(src)}" alt="${esc(image.alt || '')}" loading="lazy" decoding="async"/>${caption}
      </figure>`;
}

function processTimeline(steps) {
  if (!steps.length) return '';
  const items = steps
    .map((step, i) => {
      const verdict = VERDICTS.has(step.verdict) ? step.verdict : 'partial';
      const outcome = step.outcome
        ? `
        <p class="step-outcome"><span class="step-outcome-label">Result</span>${esc(step.outcome)}</p>`
        : '';
      return `    <li class="step step-${verdict}">
      <div class="step-marker" aria-hidden="true"></div>
      <div class="step-body">
        <div class="step-head">
          <span class="step-phase">${esc(step.phase || pad(i + 1))}</span>
          <span class="step-verdict">${esc(VERDICT_LABEL[verdict])}</span>
        </div>
        <h3>${esc(step.title)}</h3>
        <p>${esc(step.body)}</p>${outcome}${figure(step.image, 'step-figure')}
      </div>
    </li>`;
    })
    .join('\n');

  return `
  <div class="rule"></div>

  <section class="section process-section" aria-labelledby="process-title">
    <span class="section-label">How it was built</span>
    <h2 class="section-title" id="process-title">Process</h2>
    <p class="process-intro">Every version, including the ones that didn't work.</p>
    <ol class="steps">
${items}
    </ol>
  </section>`;
}

function specTable(specs) {
  if (!specs.length) return '';
  const rows = specs
    .map(
      (s) => `      <div class="spec">
        <dt>${esc(s.label)}</dt>
        <dd>${esc(s.value)}</dd>
      </div>`
    )
    .join('\n');
  return `
    <dl class="specs">
${rows}
    </dl>`;
}

function metricRow(metrics) {
  if (!metrics.length) return '';
  const cells = metrics
    .map(
      (m) => `      <li class="metric">
        <span class="metric-value">${esc(m.value)}</span>
        <span class="metric-label">${esc(m.label)}</span>
      </li>`
    )
    .join('\n');
  return `
    <ul class="metrics">
${cells}
    </ul>`;
}

function gallery(images) {
  const figures = images.map((img) => figure(img, 'gallery-figure')).filter(Boolean);
  if (!figures.length) return '';
  return `
  <div class="rule"></div>

  <section class="section gallery-section" aria-labelledby="gallery-title">
    <span class="section-label">In the shop</span>
    <h2 class="section-title" id="gallery-title">Gallery</h2>
    <div class="gallery">${figures.join('')}
    </div>
  </section>`;
}

function linkList(links) {
  const valid = links
    .map((l) => ({ label: l.label, href: safeHref(l.url) }))
    .filter((l) => l.href && l.label);
  if (!valid.length) return '';
  return `
    <div class="project-links">
${valid
  .map((l) => {
    const ext = isExternal(l.href) ? ' target="_blank" rel="noopener"' : '';
    return `      <a class="hero-cta" href="${esc(l.href)}"${ext}>
        ${esc(l.label)}
        ${ARROW}
      </a>`;
  })
  .join('\n')}
    </div>`;
}

function paragraphs(list, className = '') {
  const cls = className ? ` class="${className}"` : '';
  return arr(list)
    .map((p) => `      <p${cls}>${esc(p)}</p>`)
    .join('\n');
}

function pager(prev, next) {
  if (!prev && !next) return '';
  const link = (p, rel, label) =>
    p
      ? `      <a class="pager-link pager-${rel}" href="/projects/${esc(p.slug)}">
        <span class="pager-label">${label}</span>
        <span class="pager-title">${esc(p.title)}</span>
      </a>`
      : '      <span></span>';
  return `
  <div class="rule"></div>

  <nav class="section pager" aria-label="More projects">
${link(prev, 'prev', 'Previous')}
${link(next, 'next', 'Next')}
  </nav>`;
}

/* ------------------------------------------------------------------ */
/* Pages                                                               */
/* ------------------------------------------------------------------ */

function detailPage(project, i, all, config) {
  const prev = all[i - 1] || null;
  const next = all[i + 1] || null;

  const meta = [
    project.status && ['Status', project.status],
    project.year && ['Year', project.year],
    project.role && ['Role', project.role],
  ].filter(Boolean);

  const body = `  <main id="main">

  <header class="section project-hero">
    <span class="section-label">Project ${pad(i + 1)}</span>
    <h1 class="project-title">${esc(project.title)}</h1>
    <p class="project-tagline">${esc(project.tagline)}</p>
    ${tagList(project.tags)}
    <dl class="project-meta">
${meta
  .map(
    ([label, value]) => `      <div class="meta-item">
        <dt>${esc(label)}</dt>
        <dd>${esc(value)}</dd>
      </div>`
  )
  .join('\n')}
    </dl>
  </header>

  <div class="rule"></div>

  <section class="section problem-section" aria-labelledby="problem-title">
    <span class="section-label">Why it exists</span>
    <h2 class="section-title" id="problem-title">The problem</h2>
    <div class="prose">
${paragraphs(project.problem)}
    </div>${specTable(arr(project.specs))}
  </section>
${processTimeline(arr(project.process))}
  <div class="rule"></div>

  <section class="section outcome-section" aria-labelledby="outcome-title">
    <span class="section-label">Where it landed</span>
    <h2 class="section-title" id="outcome-title">Outcome</h2>
    <div class="prose">
${paragraphs(project.outcome?.body)}
    </div>${metricRow(arr(project.outcome?.metrics))}${linkList(arr(project.links))}
  </section>
${arr(project.learnings).length
      ? `
  <div class="rule"></div>

  <section class="section learnings-section" aria-labelledby="learnings-title">
    <span class="section-label">What it taught me</span>
    <h2 class="section-title" id="learnings-title">Lessons</h2>
    <ul class="learnings">
${arr(project.learnings)
          .map(
            (l, n) => `      <li><span class="learning-index">${pad(n + 1)}</span><p>${esc(l)}</p></li>`
          )
          .join('\n')}
    </ul>
  </section>`
      : ''}
${gallery(arr(project.gallery))}
${pager(prev, next)}

  </main>`;

  return shell({
    title: `${project.title} — Hector Mur Lopez`,
    description: project.summary || project.tagline || project.title,
    canonical: `/projects/${project.slug}`,
    gated: config.gated,
    siteUrl: config.siteUrl,
    body,
  });
}

function indexPage(projects, config) {
  const body = `  <main id="main">

  <header class="section index-hero">
    <span class="section-label">Selected work</span>
    <h1 class="project-title">Projects</h1>
    <p class="project-tagline">Things I've built, and the messy middle of building them. Each one shows the versions that failed alongside the one that shipped.</p>
  </header>

  <div class="rule"></div>

  <section class="section portfolio-section" aria-label="All projects">
    <ul class="projects projects-index">
${projects.map((p, i) => card(p, i)).join('\n')}
    </ul>
  </section>

  </main>`;

  return shell({
    title: 'Projects — Hector Mur Lopez',
    description: "Selected work by Hector Mur Lopez — what was built, how it was prototyped, and what broke along the way.",
    canonical: '/projects',
    gated: config.gated,
    siteUrl: config.siteUrl,
    body,
  });
}

/* ------------------------------------------------------------------ */
/* Homepage grid injection                                             */
/* ------------------------------------------------------------------ */

const START = '<!-- projects:start -->';
const END = '<!-- projects:end -->';

async function injectHomepage(projects) {
  const file = path.join(ROOT, 'index.html');
  const html = await readFile(file, 'utf8');
  const from = html.indexOf(START);
  const to = html.indexOf(END);

  if (from === -1 || to === -1) {
    console.warn(`! index.html has no ${START} / ${END} markers — homepage grid left alone`);
    return;
  }

  const featured = projects.filter((p) => p.featured !== false).slice(0, 3);
  const grid = `${START}
    <ul class="projects">
${featured.map((p, i) => card(p, i)).join('\n')}
    </ul>
    ${projects.length > featured.length
      ? `<a class="hero-cta projects-more" href="/projects">
      See all ${projects.length} projects
      ${ARROW}
    </a>
    `
      : ''}${END}`;

  await writeFile(file, html.slice(0, from) + grid + html.slice(to + END.length));
  console.log(`  index.html          homepage grid (${featured.length} featured)`);
}

/* ------------------------------------------------------------------ */
/* Sitemap                                                             */
/* ------------------------------------------------------------------ */

async function writeSitemap(projects, config) {
  // A gated site shouldn't advertise its pages. Keep the sitemap to the
  // homepage until "gated" is flipped off.
  const urls = config.gated
    ? [{ loc: '/', priority: '1.0' }]
    : [
        { loc: '/', priority: '1.0' },
        { loc: '/projects', priority: '0.8' },
        ...projects.map((p) => ({ loc: `/projects/${p.slug}`, priority: '0.6' })),
      ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls
  .map(
    (u) => `  <url>
    <loc>${esc(config.siteUrl + u.loc)}</loc>
    <changefreq>monthly</changefreq>
    <priority>${u.priority}</priority>
  </url>`
  )
  .join('\n')}
</urlset>
`;
  await writeFile(path.join(ROOT, 'sitemap.xml'), xml);
  console.log(`  sitemap.xml         ${urls.length} url${urls.length === 1 ? '' : 's'}`);
}

/* ------------------------------------------------------------------ */
/* Build                                                               */
/* ------------------------------------------------------------------ */

async function build() {
  const raw = await readFile(path.join(ROOT, 'projects.json'), 'utf8');
  const data = JSON.parse(raw);
  const projects = arr(data.projects);
  const config = {
    gated: data.config?.gated !== false,
    siteUrl: (data.config?.siteUrl || 'https://hectormurlopez.com').replace(/\/$/, ''),
  };

  validate(projects);

  console.log(`Building ${projects.length} project${projects.length === 1 ? '' : 's'}${config.gated ? ' (gated — noindex)' : ''}`);

  await mkdir(OUT_DIR, { recursive: true });

  // Drop directories for projects that no longer exist, so a renamed slug
  // doesn't leave a stale page live.
  if (existsSync(OUT_DIR)) {
    const slugs = new Set(projects.map((p) => p.slug));
    for (const entry of await readdir(OUT_DIR, { withFileTypes: true })) {
      if (entry.isDirectory() && !slugs.has(entry.name)) {
        await rm(path.join(OUT_DIR, entry.name), { recursive: true, force: true });
        console.log(`  removed stale /projects/${entry.name}`);
      }
    }
  }

  await writeFile(path.join(OUT_DIR, 'index.html'), indexPage(projects, config));
  console.log('  projects/index.html');

  for (const [i, project] of projects.entries()) {
    const dir = path.join(OUT_DIR, project.slug);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'index.html'), detailPage(project, i, projects, config));
    console.log(`  projects/${project.slug}/`);
  }

  await injectHomepage(projects);
  await writeSitemap(projects, config);

  console.log('Done.');
}

build().catch((err) => {
  console.error('Build failed:', err.message);
  process.exit(1);
});
