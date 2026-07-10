#!/usr/bin/env node
/**
 * Fetch the latest Substack essays and write posts.json.
 *
 * Zero dependencies — runs on Node 20+ (global fetch). Invoked by
 * .github/workflows/substack-sync.yml on a daily schedule, or manually:
 *
 *   node scripts/fetch-substack.mjs
 *
 * Fails loudly (exit 1, file untouched) on any fetch/parse problem so a
 * bad run can never clobber good committed data.
 */

import { writeFile } from 'node:fs/promises';

const FEED_URL = 'https://hectormurlopez.substack.com/feed';
const OUT_FILE = new URL('../posts.json', import.meta.url);
const MAX_POSTS = 5;
const EXCERPT_LENGTH = 200;

// Substack sits behind Cloudflare, which 403s GitHub-runner IPs even with
// a browser User-Agent (it fingerprints the TLS stack, not just headers).
// So we try the feed directly first, then fall back to a public
// read-through proxy. The feed is public content, so proxying it leaks
// nothing — and the script still fails loudly if every source fails.
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
  'Accept-Language': 'en-US,en;q=0.9',
};

const SOURCES = [
  { name: 'substack-direct', url: FEED_URL, headers: BROWSER_HEADERS },
  {
    name: 'allorigins-proxy',
    url: `https://api.allorigins.win/raw?url=${encodeURIComponent(FEED_URL)}`,
    headers: {},
  },
];

function fail(message) {
  console.error(`fetch-substack: ${message}`);
  process.exit(1);
}

function unwrapCdata(value) {
  const m = value.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return m ? m[1] : value;
}

function decodeEntities(value) {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

function cleanText(value) {
  return decodeEntities(unwrapCdata(value))
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/ ([.,;:!?…])/g, '$1')
    .trim();
}

function excerptOf(text) {
  if (text.length <= EXCERPT_LENGTH) return text;
  const cut = text.slice(0, EXCERPT_LENGTH);
  const lastSpace = cut.lastIndexOf(' ');
  return `${cut.slice(0, lastSpace > 100 ? lastSpace : EXCERPT_LENGTH).trimEnd()}…`;
}

function tagContent(block, tag) {
  const m = block.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i'));
  return m ? m[1] : '';
}

let xml = null;
for (const source of SOURCES) {
  try {
    const res = await fetch(source.url, { headers: source.headers });
    if (!res.ok) {
      console.error(`fetch-substack: ${source.name} returned HTTP ${res.status}`);
      continue;
    }
    const text = await res.text();
    if (!text.includes('<item>')) {
      console.error(`fetch-substack: ${source.name} response has no feed items`);
      continue;
    }
    console.log(`fetch-substack: fetched feed via ${source.name}`);
    xml = text;
    break;
  } catch (err) {
    console.error(`fetch-substack: ${source.name} failed: ${err.message}`);
  }
}
if (xml === null) fail('all feed sources failed');
const itemBlocks = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);

if (itemBlocks.length === 0) fail('no <item> entries found in feed');

const posts = itemBlocks.slice(0, MAX_POSTS).map((block) => {
  const title = cleanText(tagContent(block, 'title'));
  const url = cleanText(tagContent(block, 'link'));
  const pubDate = cleanText(tagContent(block, 'pubDate'));
  const description = cleanText(tagContent(block, 'description'));

  if (!title || !url) fail(`item missing title or link: ${block.slice(0, 120)}`);

  const parsed = new Date(pubDate);
  if (Number.isNaN(parsed.getTime())) fail(`unparseable pubDate: ${pubDate}`);

  return {
    title,
    url,
    date: parsed.toISOString().slice(0, 10),
    excerpt: excerptOf(description),
  };
});

// No generated-at timestamp on purpose: the workflow commits only when the
// content changed, and a timestamp would make every run dirty.
await writeFile(OUT_FILE, `${JSON.stringify({ posts }, null, 2)}\n`);
console.log(`fetch-substack: wrote ${posts.length} posts`);
