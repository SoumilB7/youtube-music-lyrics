// Lyrics panel for music.youtube.com: watches the player bar for track
// changes, loads lyrics, and highlights the line at the current playback time.
(() => {
  'use strict';

  const {
    readTrack, getVideo, isPlayerPageOpen, cleanTitle, fetchYTMLyrics,
    sideTabs, lyricsTab, isTabSelected, unlockLyricsTab, selectLyricsTab, sideContentRect,
    parseLRC, plainToLines, estimateTimings, lineIndexAt, offsetAt, playbackTimeFor, nudgePoints,
    transliterateLine, hasDevanagari, store,
  } = globalThis.Lyricly;

  // Show a line slightly before it's sung so you can read along.
  const LEAD = 0.3;
  const DEFAULTS = { visible: true, mode: 'roman', fontSize: 28, layout: 'panel', autoOpenLyrics: true };

  const ICON_LYRICS = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h11M4 11h8M4 16h6"/><path d="M19 4v10.5"/><circle cx="16.5" cy="16.5" r="2.5"/></svg>';
  const ICON_CLOSE = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const ICON_EXPAND = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M10 20H4v-6M20 4l-7 7M4 20l7-7"/></svg>';
  const ICON_APPROX = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>';
  const ICON_SAVE = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M6 3.5h12v17l-6-4.2-6 4.2z"/></svg>';
  const ICON_SAVED = '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M6 3.5h12v17l-6-4.2-6 4.2z"/></svg>';
  const ICON_RESET = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12a8 8 0 1 0 2.4-5.7"/><path d="M4 4v4.5h4.5"/></svg>';
  const ICON_SHRINK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14h6v6M20 10h-6V4M10 14l-7 7M14 10l7-7"/></svg>';

  let settings = { ...DEFAULTS };
  let track = null;
  let lyrics = null; // { lines: [{t, text, roman}], synced, source, note }
  // Timing correction for the current song: sync points [{ at, offset }]
  // (see nudgePoints in lrc.js). Offset + = lyrics earlier.
  let points = [];
  let savedPoints = null; // what's saved for this song, if anything
  let loadToken = 0;
  let needsLoad = false;
  let activeIndex = -1;
  let userScrollUntil = 0;
  let raf = 0;
  let pageOpen = false; // the song's player page is expanded
  let onLyricsTab = false; // ...and its Lyrics tab is showing

  // Lyricly lives in the player page's Lyrics tab. `wantLyrics` is whether
  // that tab should be showing: set by auto-open or by clicking the tab, and
  // cleared when you pick another tab. It lets us put the tab back if YT
  // switches away on its own (e.g. a new song YT has no lyrics for).
  let wantLyrics = false;
  let selectAttempts = 0;
  let lastAttempt = 0;

  const isShown = () => settings.visible && pageOpen && onLyricsTab;

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
        <div class="meta">
          <div class="row"><div class="t"></div><span class="approx" role="img" hidden>${ICON_APPROX}</span></div>
          <div class="a"></div>
        </div>
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
            <input class="offset" id="lyricly-offset" type="text" inputmode="decimal" value="0.0s"
              aria-label="Timing correction in seconds" title="Click to type an exact value">
            <button data-act="earlier" title="Lyrics are late: show them 0.5s sooner">+</button>
            <button data-act="reset" class="reset" title="Reset timing for this song" hidden>${ICON_RESET}</button>
            <button data-act="save" class="save" disabled>${ICON_SAVE}</button>
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
  const approxEl = $('.approx');
  const saveBtn = $('[data-act="save"]');
  const resetBtn = $('[data-act="reset"]');

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
      case 'save': return toggleSavedTiming();
      case 'reset': return setPoints([]);
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

  // Keep scrolling inside the panel from also scrolling the page behind it.
  // The lyrics list handles its own edges via overscroll-behavior; the header,
  // footer and full-screen backdrop shouldn't scroll anything.
  panel.addEventListener('wheel', (e) => {
    if (!scroller.contains(e.target)) e.preventDefault();
  }, { passive: false });

  new ResizeObserver(() => {
    scroller.style.setProperty('--half', `${Math.round(scroller.clientHeight / 2)}px`);
    centerActive(false);
  }).observe(scroller);

  document.addEventListener('keydown', (e) => {
    const t = e.composedPath()[0];
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.altKey && e.code === 'KeyL' && pageOpen) {
      e.preventDefault();
      e.stopPropagation();
      if (onLyricsTab) {
        setVisible(!settings.visible);
      } else {
        // From another tab, Alt+L jumps to the lyrics.
        wantLyrics = true;
        selectAttempts = 0;
        setVisible(true);
      }
    } else if (e.key === 'Escape' && isShown() && settings.layout === 'full') {
      saveSettings({ layout: 'panel' });
    }
  }, true);

  // Settings changed from the toolbar popup (or another tab).
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    let changed = false;
    for (const [k, { newValue }] of Object.entries(changes)) {
      if (k in DEFAULTS && newValue !== undefined && settings[k] !== newValue) {
        settings[k] = newValue;
        changed = true;
      }
    }
    if (!changed) return;
    applySettings();
    renderLines();
    onShownChange();
  });

  // Remember which side-panel tab the user picks themselves.
  document.addEventListener('click', (e) => {
    if (!e.isTrusted) return;
    const tab = e.composedPath().find((el) => el.tagName === 'TP-YT-PAPER-TAB');
    if (!tab || !sideTabs().includes(tab)) return;
    wantLyrics = tab === lyricsTab();
    selectAttempts = 0;
  }, true);

  function applySettings() {
    panel.hidden = !isShown();
    fab.hidden = settings.visible || !pageOpen || !onLyricsTab;
    panel.classList.toggle('full', settings.layout === 'full');
    fitPanel();
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
    onShownChange();
  }

  function onShownChange() {
    if (!isShown()) return;
    if (needsLoad) load();
    startLoop();
  }

  function checkPage() {
    const open = isPlayerPageOpen();
    if (open !== pageOpen) {
      pageOpen = open;
      wantLyrics = open && settings.autoOpenLyrics;
      selectAttempts = 0;
    }

    let lyricsActive = false;
    if (pageOpen) {
      const tab = unlockLyricsTab();
      if (!tab) {
        // Can't find YT's tabs at all: fall back to covering the side panel.
        lyricsActive = true;
      } else if (isTabSelected(tab)) {
        lyricsActive = true;
        wantLyrics = true;
        selectAttempts = 0;
      } else if (wantLyrics) {
        if (selectAttempts < 3 && Date.now() - lastAttempt > 1200) {
          selectAttempts++;
          lastAttempt = Date.now();
          selectLyricsTab();
        }
        // If YT won't select the tab (no lyrics of its own), show anyway.
        lyricsActive = selectAttempts >= 3 && Date.now() - lastAttempt > 1200;
      }
    }

    if (lyricsActive !== onLyricsTab) {
      onLyricsTab = lyricsActive;
      applySettings();
      onShownChange();
    }
    fitPanel();
  }

  // In panel layout, fill the side panel's content area under the tab row
  // (so Up next / Comments / Related stay clickable), at any window size.
  // Falls back to the stylesheet's fixed sizing if it can't be found.
  let fitted = '';
  function fitPanel() {
    let box = '';
    const r = (isShown() || !fab.hidden) && settings.layout !== 'full' ? sideContentRect() : null;
    if (r) {
      const top = Math.max(r.top, 64);
      const bottom = Math.min(r.bottom, innerHeight - 76);
      if (r.width >= 280 && bottom - top >= 200) {
        box = `${Math.round(top)},${Math.round(r.left)},${Math.round(r.width)},${Math.round(bottom - top)}`;
      }
    }
    if (box === fitted) return;
    fitted = box;
    const [top, left, width, height] = box ? box.split(',').map(Number) : [];
    panel.classList.toggle('docked', !!box);
    Object.assign(panel.style, box
      ? { top: `${top}px`, left: `${left}px`, width: `${width}px`, height: `${height}px`, right: 'auto', bottom: 'auto' }
      : { top: '', left: '', width: '', height: '', right: '', bottom: '' });
    // The "show lyrics" button sits in the corner of the same area.
    Object.assign(fab.style, box
      ? { top: `${top + height - 62}px`, left: `${left + width - 62}px`, right: 'auto', bottom: 'auto' }
      : { top: '', left: '', right: '', bottom: '' });
  }
  addEventListener('resize', fitPanel);

  function nudge(delta) {
    const v = getVideo();
    const first = lyrics?.lines.find((l) => l.text);
    setPoints(nudgePoints(points, v ? v.currentTime : 0, delta, first ? first.t : null));
  }

  function setPoints(next) {
    points = next;
    updateTimingUI();
    tick(true);
  }

  // ---- Per-song saved timing ----
  // Saved under the YouTube video id (see store.js, which keeps saves safe
  // across updates), so a fix for a favourite song is applied next time.

  const fmtOffset = (v) => `${v > 0 ? '+' : ''}${v.toFixed(1)}s`;
  const timingKey = (t) => `${store.TIMING_PREFIX}${t.videoId || t.key}`;
  const samePoints = (a, b) => !!b && JSON.stringify(a) === JSON.stringify(b);

  async function restoreSavedTiming(t) {
    try {
      const saved = await store.getTiming(timingKey(t));
      if (track?.key !== t.key) return;
      savedPoints = saved ? saved.points : null;
      if (savedPoints) points = savedPoints.map((p) => ({ ...p }));
    } catch (err) {
      console.warn('[Lyricly] could not read saved timing', err);
    }
    updateTimingUI();
  }

  async function toggleSavedTiming() {
    if (!track) return;
    const key = timingKey(track);
    try {
      if (!points.length || samePoints(points, savedPoints)) {
        await store.removeTiming(key);
        savedPoints = null;
      } else {
        const copy = points.map((p) => ({ ...p }));
        await store.setTiming(key, { points: copy, title: track.title, artist: track.artists });
        savedPoints = copy;
      }
    } catch (err) {
      console.warn('[Lyricly] could not save timing', err);
    }
    updateTimingUI();
  }

  function describePoints(p) {
    return p.length > 1 ? `stretched across ${p.length} sync points` : fmtOffset(p[0].offset);
  }

  // The offset label follows playback (it changes along a stretch).
  let shownOffset = '';
  function updateOffsetLabel(force) {
    if (shadow.activeElement === offsetEl) return; // don't overwrite while typing
    const v = getVideo();
    const text = fmtOffset(offsetAt(points, v ? v.currentTime : 0));
    if (force || text !== shownOffset) offsetEl.value = shownOffset = text;
  }

  // Typing an exact value: "-8.3", "+2", "1,5s" and "−0.7" all work. It's
  // applied like a −/+ press of the difference, so the shift/stretch rules
  // stay the same.
  function parseOffset(text) {
    if (!String(text).trim()) return null;
    const v = Number(String(text).trim().replace(/^\u2212/, '-').replace(',', '.').replace(/\s*s$/i, ''));
    return Number.isFinite(v) ? Math.max(-600, Math.min(600, v)) : null;
  }

  let cancelEdit = false;
  function applyTypedOffset() {
    const value = cancelEdit ? null : parseOffset(offsetEl.value);
    cancelEdit = false;
    const v = getVideo();
    const now = v ? v.currentTime : 0;
    if (value !== null) {
      const delta = Math.round((value - offsetAt(points, now)) * 10) / 10;
      if (delta) {
        const first = lyrics?.lines.find((l) => l.text);
        points = nudgePoints(points, now, delta, first ? first.t : null);
        tick(true);
      }
    }
    updateTimingUI();
    updateOffsetLabel(true);
  }

  offsetEl.addEventListener('focus', () => {
    offsetEl.value = offsetEl.value.replace(/s$/, '');
    offsetEl.select();
  });
  offsetEl.addEventListener('blur', applyTypedOffset);
  offsetEl.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') offsetEl.blur();
    if (e.key === 'Escape') {
      cancelEdit = true;
      offsetEl.blur();
    }
  });
  // Keep YouTube Music's keyboard shortcuts (space, arrows, digits) from
  // firing while typing a value.
  for (const ev of ['keydown', 'keypress', 'keyup']) {
    offsetEl.addEventListener(ev, (e) => e.stopPropagation());
  }

  // A faint dot beside each line where you made a timing fix.
  const fmtTime = (sec) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
  function markFixes() {
    const fixes = new Map();
    if (lyrics) {
      for (const p of points) {
        if (p.offset === 0) continue; // the automatic start pin isn't a fix you made
        let i = lineIndexAt(lyrics.lines, p.at + offsetAt(points, p.at) + LEAD);
        // A fix made before the first lyric (e.g. during a video's intro) or in
        // a ♪ break belongs to the line that's sung next.
        if (i < 0 || !lyrics.lines[i].text) {
          const next = lyrics.lines.findIndex((l, k) => k > i && l.text);
          if (next >= 0) i = next;
        }
        if (i >= 0) fixes.set(i, p);
      }
    }
    for (const el of linesEl.children) {
      const p = fixes.get(Number(el.dataset.i));
      el.classList.toggle('fix', !!p);
      if (p) el.title = `Timing fix at ${fmtTime(p.at)}: ${fmtOffset(p.offset)}`;
      else el.removeAttribute('title');
    }
  }

  function updateTimingUI() {
    markFixes();
    updateOffsetLabel();
    const stretched = points.length > 1;
    offsetEl.classList.toggle('stretched', stretched);
    offsetEl.title = stretched
      ? `Timing is stretched across ${points.length} sync points, so lyrics speed up or slow down to fit. This is the correction right now.`
      : '';
    resetBtn.hidden = !points.length;

    const saved = samePoints(points, savedPoints);
    const dirty = !samePoints(points, savedPoints ?? []);
    saveBtn.disabled = !saved && !dirty;
    saveBtn.classList.toggle('saved', saved);
    saveBtn.classList.toggle('dirty', dirty);
    saveBtn.innerHTML = saved ? ICON_SAVED : ICON_SAVE;
    saveBtn.title = saved
      ? `Timing (${describePoints(points)}) is saved for this song. Click to forget it.`
      : dirty && !points.length
        ? 'Remove the saved timing for this song'
        : dirty && savedPoints
          ? 'Update the saved timing for this song'
          : dirty
            ? 'Save this timing for this song'
            : 'Adjust timing with − / +, then save it for this song';
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
    markFixes();
    tick(true);
  }

  // -------------------------------------------------------------- sync ----

  function startLoop() {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  function frame() {
    raf = 0;
    if (!isShown()) return;
    tick(false);
    raf = requestAnimationFrame(frame);
  }

  function tick(force) {
    if (!lyrics?.lines.length) return;
    const v = getVideo();
    if (!v) return;
    const now = v.currentTime;
    if (points.length > 1) updateOffsetLabel();
    const idx = lineIndexAt(lyrics.lines, now + offsetAt(points, now) + LEAD);
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
    v.currentTime = playbackTimeFor(points, line.t - LEAD + 0.05);
    userScrollUntil = 0;
  }

  // ------------------------------------------------------------ loading ----

  function checkTrack() {
    const t = readTrack();
    if (!t) return;
    if (t.key !== track?.key) {
      track = t;
      lyrics = null;
      points = [];
      savedPoints = null;
      updateTimingUI();
      selectAttempts = 0;
      updateMeta();
      if (isShown()) load();
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
    setApprox('');
    showStatus('Finding lyrics…');

    // The duration in the player bar lags the title by a moment on track change.
    if (!skipWait) await sleep(800);
    if (my !== loadToken) return;
    const t = readTrack() || track;
    if (!t || t.key !== track?.key) return;
    track = t;
    await restoreSavedTiming(t);
    if (my !== loadToken) return;

    let built = null;
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'lyricly:find',
        track: { title: cleanTitle(t.title), artist: t.artist, album: t.album, duration: t.duration },
      });
      if (my !== loadToken) return;
      if (res?.found && res.synced) {
        built = { lines: parseLRC(res.syncedLyrics), synced: true, source: 'LRCLIB' };
        if (res.durationDiff > 8) {
          const longer = res.match.duration > t.duration;
          built.approx = `These lyrics are timed for a version ${Math.round(res.durationDiff)}s ${longer ? 'longer' : 'shorter'} than this one, so lines may drift. Use − / + to line them up.`;
        }
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
    setApprox(built.synced
      ? built.approx || ''
      : 'Approximate timing: these lyrics have no timestamps, so lines are spread across the song. Use − / + to line them up.');
    // Credit the source; LRCLIB links to its site.
    sourceEl.textContent = '';
    if (built.source === 'LRCLIB') {
      const a = document.createElement('a');
      a.href = 'https://lrclib.net';
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = 'LRCLIB';
      a.title = 'Lyrics from LRCLIB, a free, open-source lyrics database';
      sourceEl.append(a);
    } else {
      sourceEl.append(built.source);
    }
    for (const part of [built.synced ? 'synced' : 'timing estimated', romanised && 'auto-romanised']) {
      if (part) sourceEl.append(` · ${part}`);
    }
    renderLines();
  }

  // Clock badge beside the title when the timing can't be trusted exactly.
  function setApprox(reason) {
    approxEl.hidden = !reason;
    approxEl.title = reason;
    approxEl.setAttribute('aria-label', reason);
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
    checkPage();
    setInterval(checkTrack, 1000);
    setInterval(checkPage, 250);
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
  background: #0e0e0e; border: 1px solid rgba(255,255,255,.08); overscroll-behavior: contain;
  box-shadow: 0 24px 64px rgba(0,0,0,.55);
}
.panel.docked:not(.full) { border-radius: 0 0 12px 12px; border-top: 0; box-shadow: none; }
.panel.full { top: 0; left: 0; right: 0; bottom: 72px; width: auto; border-radius: 0; border: 0; background: #060606; }
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
.meta .row { display: flex; align-items: center; gap: 6px; min-width: 0; }
.meta .t, .meta .a { white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.approx {
  flex: none; display: inline-grid; place-items: center; width: 22px; height: 22px;
  border-radius: 50%; color: #ffb547; background: rgba(255,181,71,.16); cursor: help;
}
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
.sync button.save:disabled { opacity: .35; cursor: default; }
.sync button.save.dirty { background: rgba(255,59,92,.22); }
.sync button.save.saved { color: #ff3b5c; }
.sync .offset.stretched { color: #ffb547; }
.sync .offset {
  width: 52px; height: 24px; padding: 0 2px; border: 0; border-radius: 6px; background: transparent;
  font: inherit; font-size: 12px; text-align: center; font-variant-numeric: tabular-nums;
  color: rgba(255,255,255,.75); cursor: text;
}
.sync .offset:hover { background: rgba(255,255,255,.08); }
.sync .offset:focus { outline: none; background: rgba(255,255,255,.14); color: #fff; }

.scroller {
  --half: 40%;
  flex: 1; overflow-y: auto; overscroll-behavior: contain; position: relative; padding: 0 24px;
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
.line { position: relative; }
.line.fix::before {
  content: ""; position: absolute; left: -13px; top: .14em;
  width: 4px; height: 1em; border-radius: 2px; background: #ffb547; opacity: .5;
}
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
footer a { color: inherit; text-decoration: none; }
footer a:hover { color: #fff; text-decoration: underline; }
.link { background: none; border: 0; padding: 0; color: #fff; text-decoration: underline; cursor: pointer; font-size: 11px; }
`;
  }
})();
