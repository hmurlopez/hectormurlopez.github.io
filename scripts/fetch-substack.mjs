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

// Substack sits behind Cloudflare, which tends to 403 non-browser
// user-agents coming from cloud-runner IPs — send a browser UA.
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

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

const res = await fetch(FEED_URL, {
  headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml' },
}).catch((err) => fail(`network error: ${err.message}`));

if (!res.ok) fail(`feed returned HTTP ${res.status}`);

const xml = await res.text();
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
