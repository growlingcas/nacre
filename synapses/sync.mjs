// synapses/sync.mjs
// one heartbeat of NACRE AUTIC:
//   1. read every rss feed in sources.json (no api keys)
//   2. merge with what is already in memory, newest first
//   3. think one thought per headline (prefrontal/mind.js)
//   4. read prices + fear & greed (public endpoints, optional)
//   5. write hippocampus/feed.json, hippocampus/drafts.json,
//      hippocampus/archive/YYYY-MM-DD.json, amygdala/fear.json
//
// run locally:   node synapses/sync.mjs
// re-think only: node synapses/sync.mjs --offline
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mind = require(path.join(ROOT, 'prefrontal', 'mind.js'));
const OFFLINE = process.argv.includes('--offline');
const UA = 'NACRE-AUTIC/1.0 (+open source crypto news agent; rss reader)';

const readJSON = async (p, fallback) => { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return fallback; } };
const writeJSON = async (p, data) => { await fs.mkdir(path.dirname(p), { recursive: true }); await fs.writeFile(p, JSON.stringify(data, null, 2) + '\n'); };

function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}
const tag = (block, name) => { const m = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i')); return m ? decode(m[1]) : ''; };

function parseFeed(xml, source) {
  const out = [];
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || xml.match(/<entry[\s>][\s\S]*?<\/entry>/gi) || [];
  for (const b of blocks) {
    const title = tag(b, 'title');
    let url = tag(b, 'link');
    if (!url) { const m = b.match(/<link[^>]*href="([^"]+)"/i); if (m) url = m[1]; }
    if (!url) url = tag(b, 'guid');
    const dateRaw = tag(b, 'pubDate') || tag(b, 'published') || tag(b, 'updated') || tag(b, 'dc:date');
    const d = dateRaw ? new Date(dateRaw) : null;
    if (!title || !url || !/^https?:\/\//.test(url)) continue;
    out.push({ title, url: url.trim(), source, published: d && !isNaN(d) ? d.toISOString() : null });
  }
  return out;
}

async function get(url, as = 'text') {
  const res = await fetch(url, {
    headers: { 'user-agent': UA, accept: as === 'json' ? 'application/json' : 'application/rss+xml, application/xml, text/xml, */*' },
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return as === 'json' ? res.json() : res.text();
}

// two items are the same memory if their titles are the same (ignoring case and punctuation)
const keyOf = it => String(it.title || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const idOf = it => mind.hash(keyOf(it)).toString(36);

async function main() {
  const sources = await readJSON(path.join(ROOT, 'synapses', 'sources.json'), { rss: [], market: {}, keep: {} });
  const keep = Object.assign({ feed: 80, drafts: 12, fear_history: 500 }, sources.keep);
  const feedPath = path.join(ROOT, 'hippocampus', 'feed.json');
  const old = await readJSON(feedPath, { items: [] });
  const now = new Date().toISOString();

  const fresh = [], ok = [], failed = [];
  if (!OFFLINE) {
    const results = await Promise.allSettled(sources.rss.map(async s => ({ s, items: parseFeed(await get(s.url), s.name) })));
    results.forEach((r, i) => {
      const name = sources.rss[i].name;
      if (r.status === 'fulfilled' && r.value.items.length) { ok.push(name); fresh.push(...r.value.items); }
      else failed.push(`${name}: ${r.status === 'rejected' ? r.reason.message : 'empty feed'}`);
    });
  }

  // merge, dedupe, newest first. seed items are dropped once real items exist.
  const map = new Map();
  const oldItems = (old.items || []).filter(it => !(ok.length && it.seed));
  for (const it of [...fresh, ...oldItems]) { const k = keyOf(it); if (!map.has(k)) map.set(k, it); }
  const items = [...map.values()]
    .sort((a, b) => (b.published || b.date || '').localeCompare(a.published || a.date || ''))
    .slice(0, keep.feed);

  // think, oldest first so "headline number N about X" grows over time
  const tagCount = {};
  for (const it of [...items].reverse()) {
    it.id = it.id || idOf(it);
    it.tags = mind.tagsOf(it.title);
    const main = it.tags[0];
    if (main) tagCount[main] = (tagCount[main] || 0) + 1;
    it.thought = mind.thought(it, main ? { sameTag: { tag: main, count: tagCount[main] } } : null);
  }

  // market + amygdala (optional, keyless)
  let market = old.market || null, marketAt = old.market_at || null, fear = old.fear_greed || null;
  if (!OFFLINE && sources.market) {
    try {
      const p = await get(sources.market.prices, 'json');
      const m = {};
      for (const [id, k] of [['bitcoin', 'btc'], ['ethereum', 'eth'], ['solana', 'sol']])
        if (p[id] && typeof p[id].usd === 'number') m[k] = { usd: p[id].usd, change_24h: p[id].usd_24h_change ?? null };
      if (Object.keys(m).length) { market = m; marketAt = now; }
    } catch (e) { failed.push('prices: ' + e.message); }
    try {
      const f = await get(sources.market.fear_greed, 'json');
      const d = f && f.data && f.data[0];
      if (d) {
        fear = { value: +d.value, label: String(d.value_classification || '').toLowerCase(), at: now };
        const fp = path.join(ROOT, 'amygdala', 'fear.json');
        const hist = await readJSON(fp, { readings: [] });
        hist.readings = [fear, ...(hist.readings || [])].slice(0, keep.fear_history);
        await writeJSON(fp, hist);
      }
    } catch (e) { failed.push('fear_greed: ' + e.message); }
  }

  const realSync = ok.length > 0;
  const feed = {
    agent: 'NACRE AUTIC',
    synced_at: realSync ? now : (old.synced_at || null),
    last_attempt: OFFLINE ? (old.last_attempt || null) : now,
    seed: realSync ? false : !!old.seed,
    seeded_at: old.seeded_at || null,
    sources_ok: OFFLINE ? (old.sources_ok || []) : ok,
    sources_failed: OFFLINE ? (old.sources_failed || []) : failed,
    market, market_at: marketAt, fear_greed: fear,
    items,
  };
  await writeJSON(feedPath, feed);

  // drafts for the X account
  const drafts = items.slice(0, keep.drafts).map(it => ({ id: it.id, source: it.source, title: it.title, text: mind.tweet(it) }));
  await writeJSON(path.join(ROOT, 'hippocampus', 'drafts.json'), { generated_at: now, note: 'drafts only. a human or a bot posts them.', drafts });

  // archive: one file per day with everything seen that day
  if (realSync) {
    const day = now.slice(0, 10);
    const ap = path.join(ROOT, 'hippocampus', 'archive', `${day}.json`);
    const arch = await readJSON(ap, { day, items: [] });
    const seen = new Set(arch.items.map(keyOf));
    for (const it of fresh) if (!seen.has(keyOf(it))) { arch.items.push({ title: it.title, url: it.url, source: it.source, published: it.published }); seen.add(keyOf(it)); }
    await writeJSON(ap, arch);
  }

  console.log(`heartbeat ${now} | ok: ${ok.join(', ') || 'none'} | failed: ${failed.join(' / ') || 'none'} | items: ${items.length}`);
}

main().catch(e => { console.error(e); process.exit(1); });
