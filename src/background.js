// Service worker: finds lyrics on LRCLIB (https://lrclib.net) and caches them.
// Lives here rather than in the content script so requests aren't subject to
// the page's CORS rules.

const LRCLIB = 'https://lrclib.net/api';
const HEADERS = {
  'Lrclib-Client': `Lyricly/${chrome.runtime.getManifest().version} (https://github.com/SoumilB7/youtube-music-lyrics)`,
};
const HIT_TTL = 30 * 24 * 3600 * 1000;
const MISS_TTL = 12 * 3600 * 1000;
const DEVANAGARI = /[ऀ-ॿ]/;

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === 'lyricly:find') {
    findLyrics(msg.track).then(sendResponse, (err) => sendResponse({ found: false, error: String(err) }));
    return true; // async response
  }
  return false;
});

async function findLyrics(track) {
  const { title, artist, duration } = track;
  const key = `lrc2:${norm(title)}|${norm(artist)}|${Math.round(duration || 0)}`;

  const cached = (await chrome.storage.local.get(key))[key];
  if (cached && Date.now() - cached.at < (cached.result.found ? HIT_TTL : MISS_TTL)) {
    return cached.result;
  }

  const queries = [
    artist && { track_name: title, artist_name: artist },
    artist && { q: `${title} ${artist}` },
    { q: title },
  ].filter(Boolean);

  const seen = new Map();
  let best = null;
  for (const params of queries) {
    let results;
    try {
      results = await search(params);
    } catch (err) {
      console.warn('[Lyricly] LRCLIB search failed', params, err);
      continue;
    }
    for (const r of results) seen.set(r.id, r);
    best = pickBest([...seen.values()], track);
    // A synced match with the right length is as good as it gets.
    if (best && best.syncedLyrics && best.diff <= 3) break;
  }

  const result = best
    ? {
        found: true,
        synced: !!best.syncedLyrics,
        syncedLyrics: best.syncedLyrics || '',
        plainLyrics: best.plainLyrics || '',
        match: { track: best.trackName, artist: best.artistName, duration: best.duration },
        durationDiff: best.diff,
      }
    : { found: false };

  await chrome.storage.local.set({ [key]: { at: Date.now(), result } });
  return result;
}

async function search(params) {
  const url = `${LRCLIB}/search?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

function pickBest(candidates, { title, artist, duration }) {
  const nTitle = norm(title);
  const nArtist = norm(artist);
  let best = null;
  for (const c of candidates) {
    if (c.instrumental || !(c.syncedLyrics || c.plainLyrics)) continue;

    const ct = norm(c.trackName);
    if (!ct || !(ct.includes(nTitle) || nTitle.includes(ct))) continue;

    const diff = duration ? Math.abs((c.duration || 0) - duration) : 0;
    let score = 0;
    if (c.syncedLyrics) score += 100;
    if (diff <= 3) score += 60;
    else if (diff <= 8) score += 40;
    else if (diff <= 20) score += 10;
    else score -= 80; // probably a different version/edit of the song
    if (nArtist && norm(c.artistName).includes(nArtist)) score += 30;
    // Prefer original-script lyrics: they romanise consistently here (many
    // Latin uploads are poor machine output like "kee", "haea") and they make
    // the Both and original-script modes work.
    if (DEVANAGARI.test(c.syncedLyrics || c.plainLyrics)) score += 5;
    score -= diff * 0.5;

    if (!best || score > best.score) best = { ...c, diff, score };
  }
  return best;
}

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, '');
}
