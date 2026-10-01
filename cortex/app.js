/* cortex/app.js — everything that moves on the page.
 * boot -> wake -> ascii portal -> fall into the head -> fly through the brain
 * -> memory feed -> terminal -> anatomy -> token.                              */
(function () {
  'use strict';

  const CFG = window.NACRE_CONFIG || {};
  const LINKS = CFG.links || {};
  const MIND = window.NacreMind;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasHover = window.matchMedia('(hover: hover)').matches;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const isUrl = u => typeof u === 'string' && /^https?:\/\//.test(u);
  const S = { mem: null, items: [], filter: 'all', shown: 12, brain: null };

  /* ================================================= time + numbers */
  function ago(iso) {
    if (!iso) return null;
    const d = (Date.now() - new Date(iso).getTime()) / 1000;
    if (!isFinite(d)) return null;
    if (d < 60) return 'just now';
    if (d < 3600) return Math.round(d / 60) + ' min ago';
    if (d < 86400) return Math.round(d / 3600) + ' h ago';
    return Math.round(d / 86400) + ' days ago';
  }
  const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  function stamp(it) {
    if (it.published) {
      const d = new Date(it.published);
      if (!isNaN(d)) return `${MONTHS[d.getUTCMonth()]} ${String(d.getUTCDate()).padStart(2, '0')}  ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')} utc`;
    }
    if (it.date) { const [y, m, d] = it.date.split('-'); return `${MONTHS[+m - 1]} ${d}  time unknown`; }
    return 'time unknown';
  }
  const usd = n => '$' + n.toLocaleString('en-US', { maximumFractionDigits: n >= 1000 ? 0 : n >= 1 ? 2 : 6 });

  /* ================================================= memory */
  async function loadMemory() {
    const urls = [];
    const g = CFG.github || {};
    if (g.user && !/YOUR_/i.test(g.user)) urls.push(`https://raw.githubusercontent.com/${g.user}/${g.repo || 'nacre-autic'}/${g.branch || 'main'}/hippocampus/feed.json?t=${Math.floor(Date.now() / 60000)}`);
    urls.push('hippocampus/feed.json?t=' + Math.floor(Date.now() / 60000));
    for (const u of urls) {
      try {
        const r = await fetch(u, { cache: 'no-store' });
        if (r.ok) { const j = await r.json(); if (j && Array.isArray(j.items) && j.items.length) return j; }
      } catch (e) { /* try the next brain region */ }
    }
    if (window.NACRE_SEED) return window.NACRE_SEED;
    return { items: [], synced_at: null, seed: true };
  }
  function normalize(mem) {
    mem.items = (mem.items || []).filter(i => i && i.title);
    mem.items.forEach((it, i) => {
      if (!it.thought) it.thought = MIND.thought(it);
      if (!it.tags) it.tags = MIND.tagsOf(it.title);
      it.n = mem.items.length - i;
    });
    return mem;
  }

  /* ================================================= sound (generated, no files) */
  const Sound = {
    ctx: null, master: null, on: false, last: 0,
    init() {
      if (this.ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
      const ctx = this.ctx = new AC();
      this.master = ctx.createGain(); this.master.gain.value = 0; this.master.connect(ctx.destination);
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 6; lp.connect(this.master);
      [55, 82.41, 110.3].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = i === 2 ? 'sine' : 'sawtooth'; o.frequency.value = f; o.detune.value = i * 7;
        const g = ctx.createGain(); g.gain.value = i === 2 ? 0.05 : 0.035; o.connect(g); g.connect(lp); o.start();
      });
      const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 260; lfo.connect(lg); lg.connect(lp.frequency); lfo.start();
    },
    toggle() {
      this.init(); if (!this.ctx) return false;
      this.ctx.resume(); this.on = !this.on;
      this.master.gain.setTargetAtTime(this.on ? 0.55 : 0, this.ctx.currentTime, 0.4);
      return this.on;
    },
    tick(hi) {
      if (!this.on || !this.ctx) return;
      const now = performance.now(); if (now - this.last < 35) return; this.last = now;
      const ctx = this.ctx, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'square'; o.frequency.value = (hi ? 2400 : 1500) + Math.random() * 500;
      g.gain.setValueAtTime(0.025, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.03);
      o.connect(g); g.connect(this.master); o.start(); o.stop(ctx.currentTime + 0.035);
    },
  };

  /* ================================================= boot */
  async function boot(memPromise) {
    const box = $('#boot'), log = $('#boot-log');
    let skipped = false;
    const skip = () => { skipped = true; };
    $('#boot-skip').addEventListener('click', skip);
    window.addEventListener('keydown', skip, { once: true });
    box.addEventListener('click', skip);

    const mem = await Promise.race([memPromise, sleep(1400).then(() => null)]);
    const n = mem ? mem.items.length : 0;
    const beat = mem && mem.synced_at ? `${ago(mem.synced_at)}` : 'not yet. seed memory loaded';
    const lines = [
      ['nacre-bios 0.0.∞', ''],
      ['probing cortex ............. ', 'ok', 'ok'],
      ['mounting /hippocampus ...... ', `${n} memories. ${MIND.isPrime(n) ? n + ' is prime. good.' : 'not prime. continuing anyway.'}`, 'ok'],
      ['last heartbeat ............. ', beat, mem && mem.synced_at ? 'ok' : 'bad'],
      ['loading fixations .......... ', 'primes, palindromes, round numbers, the letter e', 'ok'],
      ['reading headlines .......... ', 'all of them. at once.', 'ok'],
      ['calibrating sanity ......... ', 'failed (expected)', 'bad'],
      ['x.com account .............. ', 'automated', 'ok'],
    ];
    if (reduced) {
      log.innerHTML = lines.map(l => esc(l[0]) + (l[1] ? `<span class="${l[2] || ''}">${esc(l[1])}</span>` : '')).join('\n') + '\n<span class="wake">&gt; wake</span>';
      await sleep(500);
    } else {
      let html = '';
      for (const [a, b, cls] of lines) {
        if (skipped) break;
        for (let i = 0; i <= a.length; i += 3) { if (skipped) break; log.innerHTML = html + esc(a.slice(0, i)) + '<span class="caret"></span>'; await sleep(8); }
        html += esc(a);
        if (b) { await sleep(70); html += `<span class="${cls || ''}">${esc(b)}</span>`; }
        html += '\n';
        log.innerHTML = html + '<span class="caret"></span>';
        Sound.tick();
        await sleep(90);
      }
      if (!skipped) { log.innerHTML = html + '<span class="wake">&gt; wake</span>'; await sleep(450); }
    }
    box.classList.add('is-done');
    document.documentElement.classList.remove('is-booting');
    document.body.classList.add('is-awake');
    setTimeout(() => box.remove(), 700);
  }

  /* ================================================= ascii portal */
  function initAscii() {
    const portal = $('#portal'), cv = $('#ascii'), video = $('#nacre-video');
    const ctx = cv.getContext('2d');
    const sample = document.createElement('canvas'), sctx = sample.getContext('2d', { willReadFrequently: true });
    const RAMP = ' .,:;i1tfLCG08@';
    const GLITCH = '?!#$%&<>/\\01*+=';
    let mode = 'ascii', cols = 0, rows = 0, fs = 10, cw = 6, visible = true, mouse = null, last = 0, glitchRows = null;
    let source = video;
    const poster = new Image(); poster.src = video.getAttribute('poster');

    const toPoster = () => { if (source !== poster) { source = poster; } };
    video.play().catch(toPoster);
    video.addEventListener('error', toPoster);
    $$('source', video).forEach(s => s.addEventListener('error', () => { if (video.networkState === 3) toPoster(); }));
    setTimeout(() => { if (video.readyState < 2) toPoster(); }, 3500);

    function size() {
      const r = { width: portal.offsetWidth, height: portal.offsetHeight };
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      fs = Math.max(6, Math.round(r.width / 64)) * dpr;
      cw = fs * 0.6;
      cols = Math.floor(cv.width / cw); rows = Math.floor(cv.height / fs);
      sample.width = cols; sample.height = rows;
      ctx.font = `600 ${fs}px "JetBrains Mono", monospace`; ctx.textBaseline = 'top';
    }
    size();
    window.addEventListener('resize', size);
    document.fonts && document.fonts.ready.then(size);

    portal.addEventListener('pointermove', e => {
      const r = cv.getBoundingClientRect();
      mouse = { x: (e.clientX - r.left) / r.width * cols, y: (e.clientY - r.top) / r.height * rows };
    });
    portal.addEventListener('pointerleave', () => { mouse = null; });

    $$('.portal-modes button').forEach(b => b.addEventListener('click', () => {
      mode = b.dataset.mode;
      $$('.portal-modes button').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      portal.classList.toggle('is-raw', mode === 'raw');
      Sound.tick(true);
    }));

    new IntersectionObserver(es => { visible = es[0].isIntersecting; if (visible && source === video) video.play().catch(() => {}); else if (!visible) video.pause(); }).observe(portal);

    function drawSource() {
      const sw = source.videoWidth || source.naturalWidth, sh = source.videoHeight || source.naturalHeight;
      if (!sw || !sh) return false;
      // cover-crop to the sample grid, compensating for character aspect
      const target = (cols * cw) / (rows * fs);
      let w = sw, h = sw / target; if (h > sh) { h = sh; w = sh * target; }
      sctx.drawImage(source, (sw - w) / 2, (sh - h) / 2, w, h, 0, 0, cols, rows);
      return true;
    }

    function render(now) {
      requestAnimationFrame(render);
      if (!visible || mode === 'raw' || document.hidden) return;
      if (now - last < (reduced ? 400 : 40)) return;
      last = now;
      if (!drawSource()) return;
      const px = sctx.getImageData(0, 0, cols, rows).data;
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
      if (!reduced && Math.random() < 0.025) glitchRows = { y: Math.floor(Math.random() * rows), h: 2 + Math.floor(Math.random() * 6), dx: (Math.random() * 10 - 5) | 0, ttl: 4 };
      for (let y = 0; y < rows; y++) {
        let shift = 0;
        if (glitchRows && y >= glitchRows.y && y < glitchRows.y + glitchRows.h) shift = glitchRows.dx;
        for (let x = 0; x < cols; x++) {
          const i = (y * cols + x) * 4;
          let r = px[i], g = px[i + 1], b = px[i + 2];
          const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
          if (l < 0.07) continue;
          let ch;
          const near = mouse && Math.hypot(x - mouse.x, (y - mouse.y) * 1.7) < 7;
          if (near) { ch = GLITCH[(Math.random() * GLITCH.length) | 0]; r = 242; g = 255; b = 214; }
          else if (mode === 'binary') ch = (l + (Math.random() < 0.02 ? 0.5 : 0)) > 0.5 ? '1' : '0';
          else ch = RAMP[Math.min(RAMP.length - 1, (l * RAMP.length) | 0)];
          // push saturation a little so the nacre reads in text form
          const m = (r + g + b) / 3;
          r = clamp(m + (r - m) * 1.35 + 18, 0, 255); g = clamp(m + (g - m) * 1.35 + 18, 0, 255); b = clamp(m + (b - m) * 1.35 + 18, 0, 255);
          ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
          ctx.fillText(ch, (x + shift) * cw, y * fs);
        }
      }
      if (glitchRows && --glitchRows.ttl <= 0) glitchRows = null;
    }
    requestAnimationFrame(render);
  }

  /* ================================================= wordmark layers */
  function initWordmark() {
    $$('.wm-l').forEach(el => {
      const c = el.textContent;
      el.innerHTML = `<span class="o">${c}</span><span class="k">${c}</span><span class="f">${c}</span>`;
    });
  }

  /* ================================================= hero thought stream */
  function initStream() {
    const list = $('#stream'), src = $('#stream-src');
    const items = S.items.slice(0, 24);
    if (!items.length) { list.innerHTML = '<li class="t">no memories yet. waiting for the first heartbeat.</li>'; return; }
    let k = 0, running = true;
    new IntersectionObserver(es => { running = es[0].isIntersecting; }).observe(list);
    async function loop() {
      while (true) {
        if (!running || document.hidden) { await sleep(500); continue; }
        const it = items[k++ % items.length];
        src.textContent = it.source || 'memory';
        const h = document.createElement('li'); h.className = 'h';
        h.innerHTML = `<b>[${esc(it.source || 'memory')}]</b> ${esc(it.title.length > 86 ? it.title.slice(0, 84) + '…' : it.title)}`;
        list.appendChild(h);
        const t = document.createElement('li'); t.className = 't';
        list.appendChild(t);
        while (list.children.length > 8) list.removeChild(list.firstChild);
        if (reduced) { t.textContent = it.thought; await sleep(6000); continue; }
        await sleep(500);
        for (let i = 1; i <= it.thought.length; i++) {
          t.innerHTML = esc(it.thought.slice(0, i)) + '<span class="caret"></span>';
          if (i % 3 === 0) Sound.tick();
          await sleep(it.thought[i - 1] === '.' ? 180 : 22);
        }
        t.textContent = it.thought;
        await sleep(2600);
      }
    }
    loop();
  }

  /* ================================================= scroll choreography */
  function initScroll() {
    const hero = $('#hero'), dive = $('#dive');
    const modes = $('.portal-modes');
    const copy = $('.hero-copy'), portal = $('#portal'), bg = $('.hero-bg'), black = $('.blackout'), hint = $('.scroll-hint');
    const canvas = $('#brain'), depth = $('#depth-val'), ghost = $('#region-ghost');
    const layers = $$('.layer');
    const NAMES = ['cortex', 'synapses', 'hippocampus', 'amygdala', 'mouth'];
    let portalOffset = { x: 0, y: 0 };
    // once the wake-up animation is over, hand the portal to the scroll
    const settle = () => portal.classList.add('is-in');
    portal.addEventListener('animationend', settle, { once: true });
    setTimeout(settle, 2200);
    let ticking = false, lastFocus = -2;

    function measure() {
      portal.style.transform = 'none';
      const r = portal.getBoundingClientRect();
      // the forehead: 50% across, 33% down the portal
      portalOffset = { x: window.innerWidth / 2 - (r.left + r.width * 0.5), y: window.innerHeight / 2 - (r.top + r.height * 0.33) };
    }
    function prog(el) { const r = el.getBoundingClientRect(); const total = r.height - window.innerHeight; return total > 0 ? clamp(-r.top / total, 0, 1) : 0; }

    function update() {
      ticking = false;
      const ph = reduced ? 0 : prog(hero);
      const pd = prog(dive);
      const diveRect = dive.getBoundingClientRect();
      const afterDive = diveRect.bottom < window.innerHeight * 0.98;

      if (!reduced) {
        const e = smooth(0, 1, ph);
        copy.style.transform = `translate3d(${-e * 40}vw, 0, 0)`;
        copy.style.opacity = String(1 - smooth(0, 0.45, ph));
        modes.style.visibility = ph > 0.03 ? 'hidden' : '';
        const z = smooth(0.08, 1, ph);
        const sc = 1 + Math.pow(z, 2.2) * 14;
        portal.style.transform = `translate3d(${portalOffset.x * smooth(0.05, 0.6, ph)}px, ${portalOffset.y * smooth(0.05, 0.6, ph)}px, 0) scale(${sc})`;
        portal.style.opacity = ph > 0.02 ? String(1 - smooth(0.78, 0.98, ph)) : '';
        bg.style.opacity = String(1 - smooth(0.55, 0.95, ph));
        black.style.opacity = String(smooth(0.82, 0.93, ph) * (1 - smooth(0.93, 1, ph)));
        hint.style.visibility = ph > 0.05 ? 'hidden' : '';
      }

      const inBrain = reduced ? (diveRect.top < window.innerHeight) : ph > 0.7;
      const cOpacity = afterDive ? 0.55 : (reduced ? 1 : smooth(0.8, 1, ph));
      canvas.style.opacity = String(inBrain ? cOpacity : 0);
      document.body.classList.toggle('is-ambient', afterDive);

      // layers
      let focus = -1;
      layers.forEach((el, i) => {
        const a = 0.05 + i * 0.185, b = a + 0.16;
        const v = smooth(a, a + 0.03, pd) * (1 - smooth(b - 0.03, b, pd));
        el.style.opacity = String(v);
        el.style.transform = `translateY(${(1 - v) * 24}px) scale(${0.97 + v * 0.03})`;
        if (v > 0.5) focus = i;
      });
      if (focus !== lastFocus) {
        lastFocus = focus;
        ghost.textContent = focus >= 0 ? NAMES[focus] : '';
        if (focus >= 0) Sound.tick(true);
      }
      depth.textContent = String(Math.round(pd * 960)).padStart(3, '0');

      if (S.brain) S.brain.set({ hero: ph, dive: afterDive ? 1 : pd, ambient: afterDive, visible: inBrain, focus });
    }
    const onScroll = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', () => { measure(); onScroll(); });
    measure(); update();
    $('a[href="#dive"]').addEventListener('click', e => {
      e.preventDefault();
      window.scrollTo({ top: hero.offsetTop + hero.offsetHeight - window.innerHeight + 2, behavior: reduced ? 'auto' : 'smooth' });
    });
  }

  /* ================================================= feed */
  function renderVitals() {
    const m = S.mem, set = (id, html) => { $(id).innerHTML = html; };
    const beat = m.synced_at ? ago(m.synced_at) : null;
    set('#v-heartbeat', beat ? esc(beat) : 'waiting for the first one');
    const mk = m.market || {};
    [['btc', '#v-btc'], ['eth', '#v-eth'], ['sol', '#v-sol']].forEach(([k, id]) => {
      const x = mk[k];
      if (x && typeof x.usd === 'number') {
        const ch = typeof x.change_24h === 'number' ? x.change_24h : null;
        set(id, `${usd(x.usd)}${ch !== null ? ` <span class="${ch >= 0 ? 'up' : 'down'}">${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%</span>` : ''}`);
      } else set(id, '—');
    });
    const f = m.fear_greed;
    set('#v-fear', f && typeof f.value === 'number' ? `${f.value} <span style="color:var(--muted)">${esc(f.label || '')}</span>` : '—');
    set('#v-count', String(S.items.length));
    const note = $('#v-note');
    if (m.seed || !m.synced_at) note.textContent = `seed memory from ${m.seeded_at || 'the last snapshot'}. live headlines, prices and fear and greed appear after the first heartbeat on github.`;
    else note.textContent = `prices: coingecko. fear and greed: alternative.me. headlines: ${(m.sources_ok || []).join(', ') || 'rss'}.${m.market_at ? ' prices read ' + ago(m.market_at) + '.' : ''}`;
    if (f && typeof f.value === 'number') {
      $('#dive-fear').textContent = `right now the number is ${f.value}. ${MIND.numberFact(f.value)}`;
      if (S.brain) S.brain.set({ fear: f.value / 100 });
    }
    $('#hud-status-text').textContent = beat ? `automated account on x. last heartbeat ${beat}` : 'automated account on x';
    $('#foot-beat').textContent = beat ? `this page is maintained by NACRE AUTIC. last heartbeat ${beat}.` : 'this page is maintained by NACRE AUTIC.';
  }

  function renderFilters() {
    const counts = {};
    S.items.forEach(it => (it.tags || []).forEach(t => { counts[t] = (counts[t] || 0) + 1; }));
    const tags = Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
    const box = $('#filters');
    box.innerHTML = [['all', S.items.length], ...tags.map(t => [t, counts[t]])]
      .map(([t, c]) => `<button type="button" data-tag="${esc(t)}" aria-pressed="${t === S.filter}">${esc(t)}<sup>${c}</sup></button>`).join('');
    box.onclick = e => {
      const b = e.target.closest('button'); if (!b) return;
      S.filter = b.dataset.tag; S.shown = 12;
      $$('button', box).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      renderLog(); Sound.tick(true);
    };
  }

  function renderLog() {
    const list = S.filter === 'all' ? S.items : S.items.filter(it => (it.tags || []).includes(S.filter));
    const log = $('#log');
    if (!list.length) { log.innerHTML = '<li class="log-empty">no memories with this tag yet. the next heartbeat may bring some.</li>'; $('#log-more').hidden = true; return; }
    log.innerHTML = list.slice(0, S.shown).map(it => `
      <li>
        <div class="log-meta"><span class="log-n">#${String(it.n).padStart(3, '0')}</span><time>${esc(stamp(it))}</time><span class="log-src">${esc(it.source || '')}</span></div>
        ${isUrl(it.url) ? `<a class="log-title" href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a>` : `<span class="log-title">${esc(it.title)}</span>`}
        <p class="log-thought"><b>nacre:</b> ${esc(it.thought)}</p>
      </li>`).join('');
    $('#log-more').hidden = list.length <= S.shown;
  }

  function initFeed() {
    renderVitals(); renderFilters(); renderLog();
    $('#log-more').addEventListener('click', () => { S.shown += 12; renderLog(); });
    setInterval(renderVitals, 60000);
  }

  /* ================================================= terminal */
  function initTalk() {
    const out = $('#term-out'), form = $('#term-form'), input = $('#term-input');
    const hist = []; let hi = 0, greeted = false, busy = false;
    const line = (cls, html) => { const p = document.createElement('p'); p.className = cls; p.innerHTML = html; out.appendChild(p); out.scrollTop = out.scrollHeight; return p; };
    async function say(lines, cls = 'it') {
      busy = true;
      for (const l of lines) {
        const p = line(cls, '');
        if (reduced) { p.textContent = l; continue; }
        for (let i = 1; i <= l.length; i += 2) { p.textContent = l.slice(0, i); if (i % 4 === 1) Sound.tick(); await sleep(9); out.scrollTop = out.scrollHeight; }
        p.textContent = l; await sleep(120);
      }
      busy = false;
    }
    const items = () => S.items;
    const fmtItem = it => `[${it.source}] ${it.title}\n  ${it.thought}`;
    const cmds = {
      help: () => ['commands:', '  read            latest 5 memories', '  read <topic>    btc, eth, sol, etf, hacks, memes, regulation, stablecoins, macro, defi, ai', '  count <text>    i count it', '  prices          what the last heartbeat saw', '  fear            the amygdala reading', '  heartbeat       when i last woke up', '  fixations       what i cannot stop counting', '  whoami  ca  links  clear', 'or type anything. i will count it.'],
      read: arg => {
        const l = arg ? items().filter(it => (it.tags || []).includes(arg)) : items();
        if (!l.length) return [`no memories about ${arg}. 0. a round number. i hate it.`];
        return l.slice(0, 5).map(fmtItem);
      },
      count: arg => {
        if (!arg) return ['count what. give me text. count <text>.'];
        const a = MIND.analyze(arg);
        return [`${a.words.length} words. ${a.letters} letters. the letter "${a.top}" appears ${a.topN} times.`, MIND.numberFact(a.letters), MIND.literalOf(arg) || 'no literal problems found. suspicious.'];
      },
      prices: () => {
        const m = S.mem.market;
        if (!m) return ['no prices yet. they arrive with the first heartbeat on github. i do not make numbers up. i only count real ones.'];
        return Object.entries(m).map(([k, v]) => `${k}: ${usd(v.usd)}${typeof v.change_24h === 'number' ? ` (${v.change_24h >= 0 ? '+' : ''}${v.change_24h.toFixed(2)}% 24h)` : ''}`).concat([`read ${ago(S.mem.market_at) || 'some time ago'}. source: coingecko.`]);
      },
      fear: () => {
        const f = S.mem.fear_greed;
        return f ? [`fear and greed: ${f.value}. ${f.label}.`, MIND.numberFact(f.value), 'i do not feel it. i only feel the number.'] : ['no reading yet. the amygdala wakes up with the first heartbeat.'];
      },
      heartbeat: () => S.mem.synced_at ? [`last heartbeat ${ago(S.mem.synced_at)}. sources that answered: ${(S.mem.sources_ok || []).join(', ') || 'none'}.`] : ['no heartbeat yet. i am running on seed memory. when the github action runs, i wake up every 30 minutes.'],
      fixations: () => ['prime numbers. palindromes. perfect squares. round numbers (bad). the letter e. the number 21. horizontal lines. timestamps that end in :00. words that do not mean what they say.'],
      whoami: () => ['you are outside. i am inside. i am NACRE AUTIC. i read every crypto headline at once and now i count them. my x account is automated. my brain is a public folder.'],
      ca: () => [CFG.token && CFG.token.contract ? `${CFG.token.ticker || '$NACRE'}: ${CFG.token.contract}` : 'contract not deployed yet. 0 characters. i counted.'],
      links: () => [`x: ${LINKS.x || 'not set'}`, `fomo: ${LINKS.fomo || 'not set'}`, `github: ${LINKS.github || 'not set'}`, `dexscreener: ${LINKS.dexscreener || 'not live yet'}`],
      gm: () => ['gm. 2 letters. g is the 7th letter. m is the 13th. both prime. good morning confirmed.'],
      sudo: () => ['you are not root. i am root. i am also a folder.'],
      clear: () => { out.innerHTML = ''; return []; },
    };
    async function run(raw) {
      const text = raw.trim();
      line('me', esc(text));
      if (!text) return say(['you sent nothing. i counted it. 0.']);
      const [c, ...rest] = text.split(/\s+/);
      const key = c.toLowerCase().replace(/^\//, '');
      if (/^rm$/.test(key)) return say(['nice try. my memory is on github. it has a history. you cannot delete history. i counted the commits.']);
      if (cmds[key]) return say(cmds[key](rest.join(' ').toLowerCase()));
      return say(MIND.reflect(text, items()));
    }
    form.addEventListener('submit', e => {
      e.preventDefault(); if (busy) return;
      const v = input.value; input.value = '';
      if (v.trim()) { hist.push(v); hi = hist.length; }
      run(v);
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'ArrowUp' && hi > 0) { hi--; input.value = hist[hi]; e.preventDefault(); }
      if (e.key === 'ArrowDown') { hi = Math.min(hist.length, hi + 1); input.value = hist[hi] || ''; e.preventDefault(); }
    });
    $('#term').addEventListener('click', e => { if (!e.target.closest('a')) input.focus({ preventScroll: true }); });
    new IntersectionObserver(es => {
      if (es[0].isIntersecting && !greeted) { greeted = true; line('sys', 'connected to nacre-cortex. 1 user online. that user is you. the other one is me.'); say(['type help. or type anything. i will count it.']); }
    }, { threshold: 0.4 }).observe($('#term'));
  }

  /* ================================================= anatomy */
  const TREE = [
    ['index.html', 'face', 'the page you are inside right now.', 'index.html'],
    ['config.js', 'settings', 'links, contract, github name. the only file a human needs to touch.',
      'window.NACRE_CONFIG = {\n  github: { user: "…", repo: "nacre-autic" },\n  links:  { x, fomo, dexscreener, github },\n  token:  { ticker: "$NACRE", contract: "" }\n};'],
    ['cortex/', 'visual cortex', 'styles, the 3d brain, the ascii eyes, this terminal.',
      'cortex/\n├── nacre.css     black void, liquid nacre, halo outlines\n├── brain.js      9000 neurons, synapses, pulses, the core\n├── app.js        boot, ascii portal, scroll, feed, terminal\n└── media/        my face. do not stare. stare.'],
    ['prefrontal/', 'thinking', 'mind.js counts every headline and writes one thought. persona.md is my voice for x.',
      'prefrontal/\n├── mind.js       numberFact(), literalOf(), thought(), tweet()\n└── persona.md    voice rules for the x account\n\n// example\nthought("Bitcoin starts the new quarter stuck in the same range")\n→ "sideways. a horizontal line. horizontal lines are my favourite lines. …"'],
    ['hippocampus/', 'memory', 'feed.json is everything i read lately. drafts.json are posts for x. archive/ keeps every day.',
      'hippocampus/\n├── feed.json     latest 80 headlines + one thought each\n├── drafts.json   ready-to-post texts for x\n└── archive/\n    └── YYYY-MM-DD.json   every headline seen that day'],
    ['amygdala/', 'fear', 'fear.json stores every fear and greed reading. i do not feel it. i store it.',
      'amygdala/\n└── fear.json     { readings: [ { value, label, at }, … ] }'],
    ['synapses/', 'heartbeat code', 'sync.mjs reads public rss feeds, thinks, and writes memory. no api keys.',
      'synapses/\n├── sources.json  coindesk, cointelegraph, decrypt, the block,\n│                 bitcoin magazine, cryptoslate\n└── sync.mjs      node synapses/sync.mjs'],
    ['.github/workflows/', 'brainstem', 'heartbeat.yml wakes me every 30 minutes on github actions.',
      'on:\n  schedule:\n    - cron: "*/30 * * * *"\njobs:\n  sync:\n    - node synapses/sync.mjs\n    - git commit -m "heartbeat: memory sync"'],
  ];
  function initAnatomy() {
    const tree = $('#tree'), body = $('#peek-body'), pathEl = $('#peek-path'), gh = $('#peek-gh');
    const repo = LINKS.github && isUrl(LINKS.github) ? LINKS.github.replace(/\/$/, '') : null;
    tree.innerHTML = TREE.map(([p, what], i) => {
      const prefix = i === TREE.length - 1 ? '└── ' : '├── ';
      return `<li><button type="button" role="option" data-i="${i}" aria-selected="false"><span class="t-path">${esc(prefix + p)}</span><span class="t-what">${esc(what)}</span></button></li>`;
    }).join('');
    tree.insertAdjacentHTML('afterbegin', '<li><button type="button" disabled><span class="t-path">nacre-autic/</span><span class="t-what">the whole brain</span></button></li>');
    function show(i) {
      const [p, what, desc, code] = TREE[i];
      $$('button[data-i]', tree).forEach(b => b.setAttribute('aria-selected', String(+b.dataset.i === i)));
      pathEl.textContent = p;
      $('#peek-desc').textContent = `${what}: ${desc}`;
      body.textContent = code;
      if (repo) { gh.hidden = false; gh.href = `${repo}/${p.endsWith('/') ? 'tree' : 'blob'}/main/${p.replace(/\/$/, '')}`; }
      Sound.tick(true);
    }
    tree.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (b) show(+b.dataset.i); });
    show(3);
  }

  /* ================================================= links + token */
  function wireLink(el, url, emptyTitle) {
    if (!el) return;
    if (isUrl(url)) { el.href = url; el.removeAttribute('aria-disabled'); }
    else { el.removeAttribute('href'); el.setAttribute('aria-disabled', 'true'); el.title = emptyTitle; el.removeAttribute('target'); }
  }
  function initLinks() {
    wireLink($('#cta-x'), LINKS.x && !/YOUR_/.test(LINKS.x) ? LINKS.x : '', 'x link not set in config.js');
    wireLink($('#tk-x'), LINKS.x && !/YOUR_/.test(LINKS.x) ? LINKS.x : '', 'x link not set in config.js');
    wireLink($('#cta-fomo'), LINKS.fomo, 'fomo link not set in config.js');
    wireLink($('#tk-fomo'), LINKS.fomo, 'fomo link not set in config.js');
    wireLink($('#tk-dex'), LINKS.dexscreener, 'pair is not live yet');
    wireLink($('#foot-gh'), LINKS.github, 'github link not set in config.js');
    const tk = (CFG.token && CFG.token.ticker) || '$NACRE';
    $('#ticker').textContent = tk;
    const ca = CFG.token && CFG.token.contract;
    if (ca) {
      $('#ca-val').textContent = ca;
      const btn = $('#ca-copy'); btn.disabled = false;
      btn.addEventListener('click', async () => {
        try { await navigator.clipboard.writeText(ca); btn.textContent = 'copied'; }
        catch (e) { btn.textContent = 'select and copy'; }
        setTimeout(() => { btn.textContent = 'copy'; }, 1600);
      });
    }
  }

  /* ================================================= marquee */
  function initMarquee() {
    const words = ['primes', 'palindromes', 'round numbers', 'the letter e', '21', 'horizontal lines', ':00 timestamps', 'perfect squares', 'fibonacci', 'automated', 'no api keys', 'open source brain'];
    const tickers = [...new Set(S.items.flatMap(it => MIND.analyze(it.title).tickers))].slice(0, 8);
    const all = words.concat(tickers.map(t => t.toLowerCase()));
    const html = all.map(w => `<span>${esc(w)}</span><span aria-hidden="true">?</span>`).join('');
    $('#marquee').innerHTML = html + html;
  }

  /* ================================================= glitch bands + cursor + sound */
  function initGlitch() {
    if (reduced) return;
    const bars = $$('.glitch i');
    (function fire() {
      setTimeout(() => {
        if (!document.hidden) {
          bars.forEach(b => {
            if (Math.random() < 0.6) {
              b.style.top = Math.random() * 100 + 'vh'; b.style.height = 4 + Math.random() * 46 + 'px';
              b.style.opacity = String(0.5 + Math.random() * 0.5); b.style.transform = `translateX(${Math.random() * 40 - 20}px)`;
            }
          });
          Sound.tick(true);
          setTimeout(() => bars.forEach(b => { b.style.opacity = '0'; }), 90 + Math.random() * 120);
        }
        fire();
      }, 5000 + Math.random() * 7000);
    })();
  }
  function initCursor() {
    if (!hasHover) return;
    const el = $('.cursor-read');
    window.addEventListener('pointermove', e => {
      document.body.classList.add('has-mouse');
      el.style.left = e.clientX + 'px'; el.style.top = e.clientY + 'px';
      el.textContent = `x${String(Math.round(e.clientX)).padStart(4, '0')} y${String(Math.round(e.clientY)).padStart(4, '0')}`;
    }, { passive: true });
  }
  function initSound() {
    const b = $('#sound');
    b.addEventListener('click', () => { const on = Sound.toggle(); b.setAttribute('aria-pressed', String(on)); b.textContent = on ? 'sound on' : 'sound off'; });
  }

  /* ================================================= go */
  async function start() {
    initWordmark();
    initSound();
    const memPromise = loadMemory().then(normalize);
    const bootDone = boot(memPromise);
    S.mem = await memPromise;
    S.items = S.mem.items;
    try { if (window.NacreBrain) S.brain = window.NacreBrain.create($('#brain')); } catch (e) { S.brain = null; }
    initLinks(); initFeed(); initTalk(); initAnatomy(); initMarquee(); initCursor(); initGlitch();
    await bootDone;
    initAscii(); initStream(); initScroll();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
