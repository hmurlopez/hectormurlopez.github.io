#!/usr/bin/env node
/**
 * Fetch the latest Substack essays and write posts.json.
 *
 * Zero dependencies — runs on Node 20+ (global fetch). Invoked by
 * .github/workflows/substack-sync.yml on a daily schedule, or manually:
 *
 *   node scripts/fetch-substack.mjs
 *
 * Fails loudly (exit 1, file untouched) only when EVERY source fails, so
 * a bad run can never clobber good committed data.
 *
 * Why multiple sources: Substack sits behind Cloudflare, which 403s
 * GitHub-runner IPs even with a browser User-Agent (it fingerprints the
 * TLS stack, not just headers — confirmed in live runs). So we try the
 * feed directly, then through independent public read-through services.
 * The feed is public content, so proxying it leaks nothing.
 */

import { writeFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';

const FEED_URL = 'https://hectormurlopez.substack.com/feed';
const OUT_FILE = new URL('../posts.json', import.meta.url);
const MAX_POSTS = 5;
const EXCERPT_LENGTH = 200;
const RETRY_DELAY_MS = 2000;

const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
  Accept: 'application/rss+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
  'Accept-Language': 'en-US,en;q=0.9',
};

const SOURCES = [
  { name: 'substack-direct', url: FEED_URL, headers: BROWSER_HEADERS, parse: 'xml', retries: 0 },
  {
    name: 'allorigins-proxy',
    url: `https://api.allorigins.win/raw?url=${encodeURIComponent(FEED_URL)}`,
    parse: 'xml',
    retries: 2, // free service, 500s are often transient
  },
  {
    name: 'codetabs-proxy',
    url: `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(FEED_URL)}`,
    parse: 'xml',
    retries: 1,
  },
  {
    name: 'rss2json',
    url: `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(FEED_URL)}`,
    parse: 'rss2json',
    retries: 1,
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
  return decodeEntities(unwrapCdata(String(value)))
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

function buildPost(title, url, dateValue, description) {
  if (!title || !url) throw new Error('item missing title or link');
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) throw new Error(`unparseable date: ${dateValue}`);
  return {
    title,
    url,
    date: parsed.toISOString().slice(0, 10),
    excerpt: excerptOf(description),
  };
}

// Raw RSS XML → posts
function parseRssXml(text) {
  const itemBlocks = [...text.matchAll(/<item>([\s\S]*?)<\/item>/g)].map((m) => m[1]);
  if (itemBlocks.length === 0) throw new Error('no <item> entries found');
  return itemBlocks.slice(0, MAX_POSTS).map((block) =>
    buildPost(
      cleanText(tagContent(block, 'title')),
      cleanText(tagContent(block, 'link')),
      cleanText(tagContent(block, 'pubDate')),
      cleanText(tagContent(block, 'description'))
    )
  );
}

// rss2json.com response (already JSON) → posts
function parseRss2Json(text) {
  const data = JSON.parse(text);
  if (data.status !== 'ok' || !Array.isArray(data.items) || data.items.length === 0) {
    throw new Error(`rss2json status=${data.status ?? 'unknown'}`);
  }
  return data.items.slice(0, MAX_POSTS).map((item) =>
    buildPost(
      cleanText(item.title ?? ''),
      cleanText(item.link ?? ''),
      item.pubDate ?? '',
      cleanText(item.description ?? item.content ?? '')
    )
  );
}

async function fetchText(source) {
  for (let attempt = 0; attempt <= source.retries; attempt++) {
    if (attempt > 0) await delay(RETRY_DELAY_MS);
    try {
      const res = await fetch(source.url, { headers: source.headers ?? {} });
      if (!res.ok) {
        console.error(`fetch-substack: ${source.name} returned HTTP ${res.status} (attempt ${attempt + 1})`);
        continue;
      }
      return await res.text();
    } catch (err) {
      console.error(`fetch-substack: ${source.name} failed: ${err.message} (attempt ${attempt + 1})`);
    }
  }
  return null;
}

let posts = null;
for (const source of SOURCES) {
  const text = await fetchText(source);
  if (text === null) continue;
  try {
    posts = source.parse === 'rss2json' ? parseRss2Json(text) : parseRssXml(text);
    console.log(`fetch-substack: fetched ${posts.length} posts via ${source.name}`);
    break;
  } catch (err) {
    console.error(`fetch-substack: ${source.name} parse failed: ${err.message}`);
    posts = null;
  }
}
if (posts === null) fail('all feed sources failed');

// No generated-at timestamp on purpose: the workflow commits only when the
// content changed, and a timestamp would make every run dirty.
await writeFile(OUT_FILE, `${JSON.stringify({ posts }, null, 2)}\n`);
console.log(`fetch-substack: wrote ${posts.length} posts`);
