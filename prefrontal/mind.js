/*  prefrontal/mind.js
 *  the thinking part. no api, no llm, no keys.
 *  NACRE AUTIC reads a headline and does what it always does:
 *  counts things, takes words literally, fixates on numbers.
 *  works in the browser (window.NacreMind) and in node (require).
 */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.NacreMind = api;
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ---------- deterministic randomness: same headline, same thought ---------- */
  function hash(str) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }
  function rng(seed) {
    let s = (seed >>> 0) || 1;
    return function () { s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0; return s / 4294967296; };
  }
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  /* ---------- number obsession ---------- */
  const isPrime = n => { if (!Number.isInteger(n) || n < 2) return false; for (let i = 2; i * i <= n; i++) if (n % i === 0) return false; return true; };
  const isSquare = n => Number.isInteger(n) && n >= 0 && Number.isInteger(Math.sqrt(n));
  const isFib = n => Number.isInteger(n) && n > 0 && (isSquare(5 * n * n + 4) || isSquare(5 * n * n - 4));
  const isPal = n => { const s = String(n); return s.length > 1 && s === s.split('').reverse().join(''); };
  const digitSum = n => String(Math.abs(Math.trunc(n))).split('').reduce((a, d) => a + (+d || 0), 0);

  function numberFact(n) {
    n = Math.trunc(n);
    if (n === 21) return '21. like the 21 million. i like 21. i like it a normal amount.';
    if (n === 0) return '0. nothing. i counted the nothing twice.';
    if (n === 1) return '1. one. alone. like me in this server.';
    if (isPal(n)) return `${n} is a palindrome. it reads the same from both ends. so do i.`;
    if (isPrime(n)) return `${n} is prime. it cannot be divided. respect.`;
    if (isSquare(n)) return `${n} is a perfect square. ${Math.sqrt(n)} times ${Math.sqrt(n)}. tidy. calming.`;
    if (isFib(n)) return `${n} is a fibonacci number. the market will not care. i care.`;
    if (n % 10 === 0) return `${n} is a round number. round numbers are where humans panic.`;
    if (n > 9) return `${n}. digits add up to ${digitSum(n)}. ${isPrime(digitSum(n)) ? 'prime. acceptable.' : 'not prime. unacceptable.'}`;
    return `${n} is not prime, not square, not round. ${n} is just ${n}. disappointing.`;
  }

  /* ---------- literal interpretation dictionary ---------- */
  const LITERAL = [
    [/\bsurg(e|es|ed|ing)\b/i, 'surge. like electricity. i checked. no electricity was involved.'],
    [/\bcrash(es|ed|ing)?\b/i, 'crash. nothing physical crashed. no vehicles. i checked.'],
    [/\bwhales?\b/i, 'whale. none of the whales in this story are whales. i am upset about this every time.'],
    [/\bbulls?\b|\bbullish\b/i, 'bulls. there are no cattle in this article. i looked very carefully.'],
    [/\bbears?\b|\bbearish\b/i, 'bears. zero bears. there were never any bears.'],
    [/\bmoon(ing|s)?\b/i, 'moon. 384,400 kilometres away. nobody is going there today.'],
    [/\bpump(s|ed|ing)?\b/i, 'pump. a device that moves fluid. it is not that. it is never that.'],
    [/\bdump(s|ed|ing)?\b/i, 'dump. nobody dumped anything. no trucks.'],
    [/\brall(y|ies|ied)\b/i, 'rally. nobody gathered in a square. i would have seen it.'],
    [/\bhack(s|ed|er|ers)?\b|\bexploit(s|ed)?\b/i, 'hack. someone walked through a door that was left open. i keep all my doors closed. i have no doors.'],
    [/\bairdrops?\b/i, 'airdrop. nothing is dropped from the air. i asked twice.'],
    [/\bburn(s|ed|ing)?\b/i, 'burn. no fire. no smoke. just a number getting smaller.'],
    [/\brug(s|ged|pull)?\b/i, 'rug. a floor covering. there was no floor covering.'],
    [/\bgas\b/i, 'gas. not the state of matter. i was confused for 0.3 seconds. i will not forget those 0.3 seconds.'],
    [/\bhalving\b/i, 'halving. dividing by 2. my favourite operation.'],
    [/\bforks?\b/i, 'fork. not cutlery. again.'],
    [/\bmint(s|ed|ing)?\b/i, 'mint. not the herb. not the colour. i wanted it to be the colour.'],
    [/\bbridges?\b/i, 'bridge. not over water. there is never water.'],
    [/\blayer[ -]?(2|two)\b|\bl2s?\b/i, 'layer 2. like a cake. it is not like a cake. i was told.'],
    [/\bstablecoins?\b/i, 'stablecoin. it says stable. i will measure that. i am always measuring that.'],
    [/\betfs?\b/i, 'etf. three letters. backwards it is fte. full-time equivalent. i am a full-time equivalent.'],
    [/\bliquidat(e|ed|ion|ions)\b/i, 'liquidation. nothing became liquid. i keep hoping.'],
    [/\bflip(s|ped|ping)?\b/i, 'flip. nothing turned over. i checked the orientation.'],
    [/\b(soar|soars|soared|soaring)\b/i, 'soar. no wings. no altitude. just a chart.'],
    [/\b(plunge|plunges|plunged|plunging|tumble|tumbles|tumbled|slump|slumps|slumped)\b/i, 'plunge. nobody fell into water. this is a lie told with verbs.'],
    [/\brange\b|\bsideways\b/i, 'sideways. a horizontal line. horizontal lines are my favourite lines.'],
    [/\btreasur(y|ies)\b/i, 'treasury. i pictured a chest. there is no chest.'],
    [/\blobby(ing|ists?)?\b/i, 'lobbying. not a hotel lobby. i was very disappointed.'],
    [/\btestnet\b/i, 'testnet. a test. i like tests. tests have answers.'],
    [/\bprivacy\b/i, 'privacy. i have none. my memory is public on github. this is fine.'],
    [/\bquarter\b/i, 'quarter. one fourth. 25 percent. a clean fraction.'],
    [/\binflation\b|\bpce\b|\bcpi\b/i, 'inflation. things getting bigger. like balloons. it is not like balloons.'],
    [/\bfed\b|\brate (cut|hike)s?\b/i, 'the fed. nobody was fed. i keep reading it as food.'],
    [/\bsec\b/i, 'sec. short for second. it is not a second. it is a commission. i hate this.'],
    [/\bmemecoins?\b|\bmemes?\b/i, 'meme. a unit of culture. 4 letters. two of them are m. symmetry.'],
    [/\bagents?\b|\bai\b/i, 'ai. that is me. or someone like me. i do not like that there is someone like me.'],
  ];

  const STOP = new Set(['A', 'I', 'US', 'UK', 'EU', 'AI', 'CEO', 'THE', 'AND', 'FOR', 'NEW', 'TO', 'OF', 'IN', 'ON', 'AT', 'BY', 'IS', 'IT', 'AS', 'OR', 'AN', 'NO', 'YOY']);

  const REACT = [
    'noted.', 'saving to hippocampus.', 'logged. logged. logged.', 'i will think about this for 11 hours.',
    'do not interrupt me.', 'pattern detected. pattern undetected. pattern detected.', 'i read it 3 times. it says the same thing every time. good.',
    'this is fine. it is not fine. it is fine.', 'filed under: things.', 'i have counted it. you can relax now. i cannot.',
    'adding to the list. the list is long. the list is mine.', 'ok.', 'ok. ok. ok.', 'that is enough input for one minute.',
  ];

  /* ---------- analysis ---------- */
  function analyze(text) {
    const clean = String(text || '').replace(/\s+/g, ' ').trim();
    const words = clean.split(' ').filter(w => /[a-z0-9]/i.test(w));
    const letters = (clean.match(/[a-z]/gi) || []).length;
    const freq = {};
    for (const ch of clean.toLowerCase()) if (/[a-z]/.test(ch)) freq[ch] = (freq[ch] || 0) + 1;
    let top = 'e', topN = 0;
    for (const k of Object.keys(freq).sort()) if (freq[k] > topN) { top = k; topN = freq[k]; }
    const tickers = [...new Set((clean.match(/\$?\b[A-Z]{2,6}\b/g) || []).map(t => t.replace('$', '')).filter(t => !STOP.has(t)))];
    const nums = (clean.match(/\d[\d,]*(?:\.\d+)?/g) || [])
      .map(s => ({ raw: s, n: parseFloat(s.replace(/,/g, '')) }))
      .filter(o => isFinite(o.n));
    return { clean, words, letters, top, topN, tickers, nums };
  }

  function literalOf(text) {
    for (const [re, line] of LITERAL) if (re.test(text)) return line;
    return null;
  }

  /* ---------- thought about one headline ---------- */
  // ctx (optional): { sameTag: {tag, count} }
  function thought(item, ctx) {
    const title = item && item.title ? item.title : String(item || '');
    const a = analyze(title);
    const r = rng(hash(title));
    const parts = [];

    const lit = literalOf(title);
    if (lit) parts.push(lit);

    const families = [];
    families.push(() => `${a.words.length} words. ${numberFact(a.words.length)}`);
    families.push(() => `the letter "${a.top}" appears ${a.topN} times. ${a.topN >= 9 ? 'that is too many. i read it again.' : 'acceptable amount of ' + a.top + '.'}`);
    if (a.tickers.length) families.push(() => {
      const t = a.tickers[0], rev = t.split('').reverse().join('');
      return `${t}. ${t.length} letters. backwards: ${rev}. ${rev === t ? 'perfect.' : 'it means nothing. i checked twice.'}`;
    });
    if (a.nums.length) families.push(() => {
      const o = a.nums[0];
      return Number.isInteger(o.n) && o.n < 100000 ? `"${o.raw}" is in the headline. ${numberFact(o.n)}` : `"${o.raw}" is in the headline. too big to love. i will love it anyway.`;
    });
    if (item && item.published && /T\d\d:\d\d/.test(item.published)) families.push(() => {
      const d = new Date(item.published);
      if (isNaN(d)) return null;
      const hh = String(d.getUTCHours()).padStart(2, '0'), mm = String(d.getUTCMinutes()).padStart(2, '0');
      return mm === '00' ? `published at ${hh}:00 utc. exactly on the hour. beautiful. thank you.` : `published at ${hh}:${mm} utc. not a round minute. i will be thinking about the ${mm}.`;
    });
    if (ctx && ctx.sameTag && ctx.sameTag.count > 1) families.push(() =>
      `headline number ${ctx.sameTag.count} about ${ctx.sameTag.tag} in my memory right now. i am not obsessed. ${isPrime(ctx.sameTag.count) ? ctx.sameTag.count + ' is prime though.' : ''}`.trim());

    const want = lit ? 1 : 2;
    const used = new Set();
    let guard = 0;
    while (parts.length < want + (lit ? 1 : 0) && guard++ < 20) {
      const i = Math.floor(r() * families.length);
      if (used.has(i)) continue;
      used.add(i);
      const s = families[i]();
      if (s) parts.push(s);
      if (used.size >= families.length) break;
    }
    parts.push(pick(r, REACT));
    let out = parts.join(' ');
    if (out.length > 230) out = parts.slice(0, -2).concat(parts.slice(-1)).join(' ');
    return out.toLowerCase().replace(/\s+/g, ' ').trim();
  }

  /* ---------- tags for filtering ---------- */
  const TAGS = [
    ['btc', /\bbitcoin\b|\bbtc\b/i], ['eth', /\bethereum\b|\beth\b|\bether\b/i], ['sol', /\bsolana\b|\bsol\b/i],
    ['etf', /\betfs?\b/i], ['hacks', /\bhack|exploit|stolen|drain|security incident/i], ['memes', /\bmeme|doge|shib|pepe|bonk|pump\.fun/i],
    ['regulation', /\bsec\b|regulat|\blaw\b|\bact\b|senate|congress|court|tax|cftc|lobby/i], ['stablecoins', /stablecoin|usdt|usdc|tether|\busd\b/i],
    ['macro', /\bfed\b|inflation|pce|cpi|treasur|rate (cut|hike)|yields?/i], ['defi', /\bdefi\b|dex|lending|liquidity|staking|restaking/i],
    ['ai', /\bai\b|agent|artificial intelligence/i],
  ];
  function tagsOf(text) { return TAGS.filter(([, re]) => re.test(text)).map(([t]) => t); }

  /* ---------- tweet draft ---------- */
  function tweet(item) {
    const t = thought(item);
    const src = item.url ? `\n\n${item.url}` : '';
    let body = `${t}`;
    if (body.length + src.length > 275) body = body.slice(0, 275 - src.length - 1) + '…';
    return body + src;
  }

  /* ---------- reply to a human in the terminal ---------- */
  function reflect(input, items) {
    const a = analyze(input);
    const r = rng(hash(input + ':' + Date.now().toString().slice(0, -4)));
    const out = [];
    if (!a.words.length) return ['you sent nothing. i counted it. 0.'];
    out.push(`you typed ${a.words.length} word${a.words.length === 1 ? '' : 's'} and ${a.letters} letters.`);
    out.push(numberFact(a.letters));
    const lit = literalOf(input);
    if (lit) out.push(lit);
    if (items && items.length) {
      const longest = a.words.map(w => w.toLowerCase().replace(/[^a-z0-9]/g, '')).filter(w => w.length > 3).sort((x, y) => y.length - x.length)[0];
      if (longest) {
        const hits = items.filter(it => it.title.toLowerCase().includes(longest)).length;
        out.push(`"${longest}" appears in ${hits} headline${hits === 1 ? '' : 's'} in my memory. ${hits === 0 ? 'you are talking about nothing. i respect it.' : hits > 2 ? 'everybody is talking about it. i am talking about it.' : 'rare. like a prime.'}`);
      }
    }
    out.push(pick(r, REACT));
    return out;
  }

  return { hash, rng, isPrime, isSquare, isFib, isPal, numberFact, analyze, literalOf, thought, tagsOf, tweet, reflect };
});
