// Saved data that must survive every update: settings and per-song timing
// fixes. Everything that reads or writes saved timing goes through here.
//
// Rules for future versions, so nothing saved is ever lost:
//   - Never rename or delete a stored key or field without a migration.
//   - When a stored format changes, bump SCHEMA, add a step to migrate(),
//     and keep normalizeTiming() able to read every older format.
//   - Add a test in tests/store.test.js for the old format.
(function (root) {
  'use strict';

  const SCHEMA = 2;
  const TIMING_PREFIX = 'offset:';
  const SETTINGS = {
    visible: 'boolean', mode: 'string', fontSize: 'number', layout: 'string', autoOpenLyrics: 'boolean',
  };

  // Any saved timing, in any format Lyricly has used, as
  // { points, title, artist, savedAt }, or null if it holds no fix.
  function normalizeTiming(v) {
    if (!v || typeof v !== 'object') return null;
    let points = null;
    if (Array.isArray(v.points)) {
      points = v.points
        .filter((p) => Number.isFinite(p?.at) && Number.isFinite(p?.offset))
        .map(({ at, offset }) => ({ at, offset }));
    } else if (typeof v.offset === 'number') {
      points = v.offset ? [{ at: 0, offset: v.offset }] : []; // first format: one offset
    }
    if (!points || !points.length) return null;
    return {
      points,
      title: String(v.title || ''),
      artist: String(v.artist || ''),
      savedAt: Number(v.savedAt) || 0,
    };
  }

  const newest = (a, b) => (!a ? b : !b ? a : b.savedAt > a.savedAt ? b : a);

  // Each save goes to sync storage (follows the user's Chrome profile) and to
  // local storage (no size limit, survives sync quota errors).
  async function put(key, value) {
    await chrome.storage.local.set({ [key]: value });
    try {
      await chrome.storage.sync.set({ [key]: value });
    } catch (err) {
      console.warn('[Lyricly] Chrome sync storage is full; this save is kept on this device only.', err);
    }
  }

  async function getTiming(key) {
    const [s, l] = await Promise.all([chrome.storage.sync.get(key), chrome.storage.local.get(key)]);
    return newest(normalizeTiming(s[key]), normalizeTiming(l[key]));
  }

  async function setTiming(key, { points, title, artist }) {
    await put(key, { points, title, artist, savedAt: Date.now() });
  }

  async function removeTiming(key) {
    await Promise.all([chrome.storage.local.remove(key), chrome.storage.sync.remove(key).catch(() => {})]);
  }

  async function allTimings() {
    const [s, l] = await Promise.all([chrome.storage.sync.get(null), chrome.storage.local.get(null)]);
    const out = {};
    for (const area of [s, l]) {
      for (const [k, v] of Object.entries(area)) {
        if (!k.startsWith(TIMING_PREFIX)) continue;
        const t = normalizeTiming(v);
        if (t) out[k] = newest(out[k], t);
      }
    }
    return out;
  }

  // Runs on install and on every update (from the service worker).
  async function migrate() {
    const { schema = 1 } = await chrome.storage.local.get('schema');
    if (schema < 2) {
      // 1 → 2: timing saves move to the { points } format and get a local
      // backup copy; the first lyrics cache ("lrc:" keys) is dropped.
      for (const [k, v] of Object.entries(await allTimings())) await put(k, v);
      const stale = Object.keys(await chrome.storage.local.get(null)).filter((k) => k.startsWith('lrc:'));
      if (stale.length) await chrome.storage.local.remove(stale);
    }
    if (schema !== SCHEMA) await chrome.storage.local.set({ schema: SCHEMA });
  }

  // ---- Backup files (moving between installs, browsers or computers) ----

  async function exportData() {
    const settings = await chrome.storage.sync.get(Object.keys(SETTINGS));
    return {
      app: 'lyricly',
      schema: SCHEMA,
      exportedAt: new Date().toISOString(),
      settings,
      timings: await allTimings(),
    };
  }

  // Merges a backup into what's saved. Where both have a fix for the same
  // song, the newer one wins. Returns how many song fixes were added or updated.
  async function importData(data) {
    if (!data || data.app !== 'lyricly' || typeof data.timings !== 'object') {
      throw new Error("This isn't a Lyricly backup file.");
    }
    const current = await allTimings();
    let count = 0;
    for (const [k, v] of Object.entries(data.timings || {})) {
      if (!k.startsWith(TIMING_PREFIX)) continue;
      const t = normalizeTiming(v);
      if (!t || (current[k] && current[k].savedAt >= t.savedAt)) continue;
      await put(k, t);
      count++;
    }
    const settings = {};
    for (const [k, type] of Object.entries(SETTINGS)) {
      if (typeof data.settings?.[k] === type) settings[k] = data.settings[k];
    }
    if (Object.keys(settings).length) await chrome.storage.sync.set(settings);
    return count;
  }

  const api = {
    SCHEMA, TIMING_PREFIX,
    normalizeTiming, getTiming, setTiming, removeTiming, allTimings, migrate, exportData, importData,
  };
  root.Lyricly = Object.assign(root.Lyricly || {}, { store: api });
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
