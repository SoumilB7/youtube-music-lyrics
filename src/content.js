// Lyrics panel for music.youtube.com: watches the player bar for track
// changes, loads lyrics, and highlights the line at the current playback time.
(() => {
  'use strict';

  const {
    readTrack, getVideo, cleanTitle, fetchYTMLyrics,
    parseLRC, plainToLines, estimateTimings, lineIndexAt,
    transliterateLine, hasDevanagari,
  } = globalThis.Lyricly;

  // Show a line slightly before it's sung so you can read along.
  const LEAD = 0.3;
  const DEFAULTS = { visible: true, mode: 'roman', fontSize: 28, layout: 'panel' };

  const ICON_LYRICS = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h11M4 11h8M4 16h6"/><path d="M19 4v10.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>';
  const ICON_CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_EXPAND = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
  const ICON_SHRINK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/></svg>';

  let settings = { ...DEFAULTS };
  let track = null;
  let lyrics = null; // { lines: [{t, text, roman}], synced, source, note }
  let offset = 0; // per-track sync nudge, seconds (+ = lyrics earlier)
  let loadToken = 0;
  let needsLoad = false;
  let activeIndex = -1;
  let userScrollUntil = 0;
  let raf = 0;

  // ---------------------------------------------------------------- UI ----

  const host = document.createElement('div');
  host.id = 'lyricly-root';
  const shadow = host.attachShadow({ mode: 'open' });
  shadow.innerHTML = `
    <style>${CSS()}</style>
    <button class="fab" title="Lyrics (Alt+L)" aria-label="Show lyrics">${ICON_LYRICS}</button>
    <section class="panel" hidden>
      <div class="bg"></div>
      <header>
        <div class="meta"><div class="t"></div><div class="a"></div></div>
        <div class="controls">
          <div class="seg" role="group" aria-label="Script">
            <button data-mode="roman" title="Romanised (Hinglish)">Aa</button>
            <button data-mode="both" title="Romanised + original">Both</button>
            <button data-mode="original" title="Original script">अ</button>
          </div>
          <button data-act="smaller" title="Smaller text">A−</button>
          <button data-act="bigger" title="Larger text">A+</button>
          <div class="sync" title="Nudge timing if lyrics run early/late">
            <button data-act="later" title="Lyrics are early: delay them 0.5s">−</button>
            <span class="offset">0.0s</span>
            <button data-act="earlier" title="Lyrics are late: show them 0.5s sooner">+</button>
          </div>
          <button data-act="layout" class="icon" title="Full screen"></button>
          <button data-act="close" class="icon" title="Hide (Alt+L)">${ICON_CLOSE}</button>
        </div>
      </header>
      <div class="scroller"><div class="spacer"></div><div class="lines"></div><div class="spacer"></div></div>
      <footer><span class="source"></span><button data-act="retry" class="link" hidden>Retry</button></footer>
    </section>`;

  const $ = (sel) => shadow.querySelector(sel);
  const fab = $('.fab');
  const panel = $('.panel');
  const bg = $('.bg');
  const scroller = $('.scroller');
  const linesEl = $('.lines');
  const sourceEl = $('.source');
  const offsetEl = $('.offset');
  const retryBtn = $('[data-act="retry"]');

  fab.addEventListener('click', () => setVisible(true));

  shadow.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (btn?.dataset.mode) {
      saveSettings({ mode: btn.dataset.mode });
      renderLines();
      return;
    }
    switch (btn?.dataset.act) {
      case 'smaller': return saveSettings({ fontSize: Math.max(16, settings.fontSize - 2) });
      case 'bigger': return saveSettings({ fontSize: Math.min(64, settings.fontSize + 2) });
      case 'earlier': return nudge(+0.5);
      case 'later': return nudge(-0.5);
      case 'layout': return saveSettings({ layout: settings.layout === 'full' ? 'panel' : 'full' });
      case 'close': return setVisible(false);
      case 'retry': return load(true);
    }
    const line = e.target.closest('.line');
    if (line && lyrics) seekTo(lyrics.lines[Number(line.dataset.i)]);
  });

  // Pause auto-follow for a few seconds when the user scrolls manually.
  for (const ev of ['wheel', 'touchmove']) {
    scroller.addEventListener(ev, () => (userScrollUntil = Date.now() + 4000), { passive: true });
  }

  new ResizeObserver(() => {
    scroller.style.setProperty('--half', `${Math.round(scroller.clientHeight / 2)}px`);
    centerActive(false);
  }).observe(scroller);

  document.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.altKey && e.code === 'KeyL') {
      e.preventDefault();
      e.stopPropagation();
      setVisible(!settings.visible);
    } else if (e.key === 'Escape' && settings.visible && settings.layout === 'full') {
      saveSettings({ layout: 'panel' });
    }
  }, true);

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg?.type === 'lyricly:toggle') setVisible(!settings.visible);
  });

  function applySettings() {
    panel.hidden = !settings.visible;
    fab.hidden = settings.visible;
    panel.classList.toggle('full', settings.layout === 'full');
    panel.style.setProperty('--fs', `${settings.fontSize}px`);
    $('[data-act="layout"]').innerHTML = settings.layout === 'full' ? ICON_SHRINK : ICON_EXPAND;
    $('[data-act="layout"]').title = settings.layout === 'full' ? 'Back to panel (Esc)' : 'Full screen';
    for (const b of shadow.querySelectorAll('[data-mode]')) {
      b.classList.toggle('on', b.dataset.mode === settings.mode);
    }
    requestAnimationFrame(() => centerActive(false));
  }

  function saveSettings(patch) {
    settings = { ...settings, ...patch };
    applySettings();
    chrome.storage.sync.set(settings).catch(() => {});
  }

  function setVisible(visible) {
    saveSettings({ visible });
    if (visible) {
      if (needsLoad) load();
      startLoop();
    }
  }

  function nudge(delta) {
    offset = Math.round((offset + delta) * 10) / 10;
    offsetEl.textContent = `${offset > 0 ? '+' : ''}${offset.toFixed(1)}s`;
    tick(true);
  }

  function showStatus(text) {
    linesEl.innerHTML = '';
    const div = document.createElement('div');
    div.className = 'status';
    div.textContent = text;
    linesEl.append(div);
    activeIndex = -1;
    scroller.scrollTop = 0;
  }

  function updateMeta() {
    $('.meta .t').textContent = track?.title || 'Lyricly';
    $('.meta .a').textContent = track?.artists || '';
    bg.style.backgroundImage = track?.art ? `url("${track.art}")` : '';
  }

  function renderLines() {
    if (!lyrics) return;
    linesEl.innerHTML = '';
    const frag = document.createDocumentFragment();
    lyrics.lines.forEach((ln, i) => {
      const div = document.createElement('div');
      div.className = 'line';
      div.dataset.i = String(i);
      if (!ln.text) {
        div.classList.add('gap');
        div.textContent = '♪';
      } else {
        const main = document.createElement('div');
        main.className = 'main';
        main.textContent = settings.mode !== 'original' && ln.roman ? ln.roman : ln.text;
        div.append(main);
        if (settings.mode === 'both' && ln.roman) {
          const sub = document.createElement('div');
          sub.className = 'sub';
          sub.textContent = ln.text;
          div.append(sub);
        }
      }
      frag.append(div);
    });
    linesEl.append(frag);
    activeIndex = -1;
    tick(true);
  }

  // -------------------------------------------------------------- sync ----

  function startLoop() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function frame() {
    raf = 0;
    if (!settings.visible) return;
    tick(false);
    raf = requestAnimationFrame(frame);
  }

  function tick(force) {
    if (!lyrics?.lines.length) return;
    const v = getVideo();
    if (!v) return;
    const idx = lineIndexAt(lyrics.lines, v.currentTime + offset + LEAD);
    if (idx === activeIndex && !force) return;
    activeIndex = idx;
    const children = linesEl.children;
    for (let i = 0; i < children.length; i++) {
      children[i].classList.toggle('active', i === idx);
      children[i].classList.toggle('past', i < idx);
    }
    centerActive(true);
  }

  function centerActive(smooth) {
    if (Date.now() < userScrollUntil) return;
    const el = linesEl.children[activeIndex];
    const top = el ? el.offsetTop - scroller.clientHeight / 2 + el.offsetHeight / 2 : 0;
    scroller.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
  }

  function seekTo(line) {
    const v = getVideo();
    if (!v || !line) return;
    v.currentTime = Math.max(0, line.t - offset - LEAD + 0.05);
    userScrollUntil = 0;
  }

  // ------------------------------------------------------------ loading ----

  function checkTrack() {
    const t = readTrack();
    if (!t) return;
    if (t.key !== track?.key) {
      track = t;
      lyrics = null;
      offset = 0;
      offsetEl.textContent = '0.0s';
      updateMeta();
      if (settings.visible) load();
      else needsLoad = true;
    } else if (t.art !== track.art) {
      track.art = t.art;
      updateMeta();
    }
  }

  async function load(skipWait) {
    const my = ++loadToken;
    needsLoad = false;
    sourceEl.textContent = '';
    retryBtn.hidden = true;
    showStatus('Finding lyrics…');

    // The duration in the player bar lags the title by a moment on track change.
    if (!skipWait) await sleep(800);
    if (my !== loadToken) return;
    const t = readTrack() || track;
    if (!t || t.key !== track?.key) return;
    track = t;

    let built = null;
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'lyricly:find',
        track: { title: cleanTitle(t.title), artist: t.artist, album: t.album, duration: t.duration },
      });
      if (my !== loadToken) return;
      if (res?.found && res.synced) {
        built = { lines: parseLRC(res.syncedLyrics), synced: true, source: 'LRCLIB' };
        if (res.durationDiff > 8) built.note = 'different version? use −/+ to adjust';
      } else if (res?.found) {
        built = { lines: estimateTimings(plainToLines(res.plainLyrics), t.duration), synced: false, source: 'LRCLIB' };
      }
    } catch (err) {
      console.warn('[Lyricly] lookup failed', err);
      if (String(err).includes('Extension context invalidated')) {
        showStatus('Lyricly was updated — reload this tab.');
        return;
      }
    }

    if (!built && t.videoId) {
      showStatus('Checking YouTube Music lyrics…');
      try {
        const ytm = await fetchYTMLyrics(t.videoId);
        if (my !== loadToken) return;
        if (ytm) {
          built = { lines: estimateTimings(plainToLines(ytm.text), t.duration), synced: false, source: ytm.source };
        }
      } catch (err) {
        console.warn('[Lyricly] YouTube Music lyrics failed', err);
      }
    }
    if (my !== loadToken) return;

    if (!built || !built.lines.some((l) => l.text)) {
      lyrics = null;
      showStatus('No lyrics found for this track.');
      retryBtn.hidden = false;
      return;
    }

    let romanised = false;
    for (const ln of built.lines) {
      ln.roman = hasDevanagari(ln.text) ? transliterateLine(ln.text) : '';
      if (ln.roman) romanised = true;
    }
    lyrics = built;
    sourceEl.textContent = [
      built.source,
      built.synced ? 'synced' : 'timing estimated',
      romanised && 'auto-romanised',
      built.note,
    ].filter(Boolean).join(' · ');
    renderLines();
  }

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  // -------------------------------------------------------------- boot ----

  chrome.storage.sync.get(DEFAULTS).then((stored) => {
    settings = { ...DEFAULTS, ...stored };
    document.documentElement.append(host);
    applySettings();
    updateMeta();
    showStatus('Play a song to see lyrics.');
    checkTrack();
    setInterval(checkTrack, 1000);
    if (settings.visible) startLoop();
  });

  // ------------------------------------------------------------ assets ----

  function CSS() {
    return `
:host { all: initial; }
* { box-sizing: border-box; }
[hidden] { display: none !important; }
button { font: inherit; color: inherit; }

.fab {
  position: fixed; right: 20px; bottom: 92px; z-index: 2147483000;
  width: 46px; height: 46px; border-radius: 50%; display: grid; place-items: center;
  border: 1px solid rgba(255,255,255,.14); background: rgba(28,28,28,.94); color: #fff;
  box-shadow: 0 8px 24px rgba(0,0,0,.45); cursor: pointer; transition: transform .15s, background .15s;
}
.fab:hover { background: #3a3a3a; transform: scale(1.06); }

.panel {
  --fs: 28px;
  position: fixed; z-index: 2147483000; top: 76px; right: 16px; bottom: 88px;
  width: clamp(320px, 34vw, 540px); display: flex; flex-direction: column;
  border-radius: 16px; overflow: hidden; color: #fff; isolation: isolate;
  font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Noto Sans", "Noto Sans Devanagari", sans-serif;
  background: rgba(14,14,14,.94); border: 1px solid rgba(255,255,255,.08);
  box-shadow: 0 24px 64px rgba(0,0,0,.55);
}
.panel.full { top: 0; left: 0; right: 0; bottom: 72px; width: auto; border-radius: 0; border: 0; background: rgba(6,6,6,.97); }
@media (max-width: 720px) { .panel:not(.full) { left: 8px; right: 8px; width: auto; } }

.bg {
  position: absolute; inset: -60px; z-index: -1; pointer-events: none;
  background-size: cover; background-position: center;
  filter: blur(48px) saturate(1.4); opacity: .32;
}
.panel.full .bg { opacity: .5; }

header {
  display: flex; align-items: center; gap: 8px 10px; flex-wrap: wrap;
  padding: 10px 12px; border-bottom: 1px solid rgba(255,255,255,.08);
}
.meta { flex: 1 1 140px; min-width: 0; }
.meta .t, .meta .a { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.meta .t { font-size: 14px; font-weight: 650; }
.meta .a { font-size: 12px; color: rgba(255,255,255,.6); margin-top: 2px; }
.panel.full header { padding: 14px max(16px, 4vw); }
.panel.full .meta .t { font-size: 18px; }
.panel.full .meta .a { font-size: 14px; }

.controls { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.controls button {
  min-width: 30px; height: 30px; padding: 0 8px; border-radius: 8px; border: 0;
  background: rgba(255,255,255,.08); font-size: 13px; font-weight: 600; cursor: pointer;
  display: inline-grid; place-items: center;
}
.controls button:hover { background: rgba(255,255,255,.16); }
.controls button.icon { padding: 0; width: 30px; }
.seg, .sync { display: inline-flex; gap: 2px; padding: 2px; border-radius: 10px; background: rgba(255,255,255,.05); align-items: center; }
.seg button, .sync button { height: 26px; background: transparent; }
.seg button.on { background: #fff; color: #000; }
.sync .offset { min-width: 42px; text-align: center; font-size: 12px; font-variant-numeric: tabular-nums; color: rgba(255,255,255,.75); }

.scroller {
  --half: 40%;
  flex: 1; overflow-y: auto; position: relative; padding: 0 24px;
  scrollbar-width: none;
  -webkit-mask-image: linear-gradient(transparent, #000 12%, #000 88%, transparent);
          mask-image: linear-gradient(transparent, #000 12%, #000 88%, transparent);
}
.scroller::-webkit-scrollbar { display: none; }
.panel.full .scroller { padding: 0 max(24px, 14vw); }
.spacer { height: var(--half); }

.line {
  font-size: var(--fs); font-weight: 750; line-height: 1.28; letter-spacing: -.01em;
  margin: 0 0 .55em; color: rgba(255,255,255,.36); cursor: pointer;
  transform-origin: left center; transition: color .3s, transform .3s, opacity .3s;
  overflow-wrap: anywhere;
}
.panel.full .line { font-size: calc(var(--fs) * 1.6); }
.line:hover { color: rgba(255,255,255,.6); }
.line.past { color: rgba(255,255,255,.22); }
.line.active { color: #fff; transform: scale(1.03); text-shadow: 0 0 24px rgba(255,255,255,.18); }
.line .sub { font-size: .6em; font-weight: 500; margin-top: .25em; opacity: .75; }
.line.gap { font-size: calc(var(--fs) * .8); }

.status { font-size: 16px; color: rgba(255,255,255,.6); text-align: center; }

footer {
  display: flex; align-items: center; gap: 10px; padding: 8px 14px;
  font-size: 11px; color: rgba(255,255,255,.5); border-top: 1px solid rgba(255,255,255,.08);
}
.panel.full footer { padding: 8px max(16px, 4vw); }
.link { background: none; border: 0; padding: 0; color: #fff; text-decoration: underline; cursor: pointer; font-size: 11px; }
`;
  }
})();
