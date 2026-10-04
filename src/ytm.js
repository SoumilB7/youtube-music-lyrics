// Everything that touches YouTube Music itself: reading the current track
// from the player bar, and fetching YT Music's own (untimed) lyrics as a
// fallback when LRCLIB has nothing.
(function (root) {
  'use strict';

  function getVideo() {
    return document.querySelector('#movie_player video') || document.querySelector('video');
  }

  function parseClock(s) {
    const parts = String(s).trim().split(':').map(Number);
    if (!parts.length || parts.some((n) => !Number.isFinite(n))) return NaN;
    return parts.reduce((acc, n) => acc * 60 + n, 0);
  }

  function readTrack() {
    const bar = document.querySelector('ytmusic-player-bar');
    if (!bar) return null;
    const title = bar.querySelector('.title')?.textContent?.trim();
    if (!title) return null;

    // Byline looks like "Artist & Artist • Album • 2022" for songs and
    // "Artist • 12M views • 50K likes" for videos.
    const byline = bar.querySelector('.byline')?.textContent?.replace(/\s+/g, ' ').trim() || '';
    const parts = byline.split('•').map((s) => s.trim()).filter(Boolean);
    const artists = parts[0] || '';
    const artist = artists.split(/\s*(?:,|&| x | feat\.? | ft\.? )\s*/i)[0] || artists;
    const album = parts.length >= 3 && /^\d{4}$/.test(parts[parts.length - 1]) ? parts[1] : '';

    const timeInfo = bar.querySelector('.time-info')?.textContent || '';
    let duration = parseClock(timeInfo.split('/')[1] || '');
    const video = getVideo();
    if (!(duration > 0) && video && Number.isFinite(video.duration)) duration = video.duration;

    const art = (bar.querySelector('img.image') || bar.querySelector('img'))?.src || '';

    return {
      key: `${title}|${artists}`,
      videoId: new URLSearchParams(location.search).get('v') || '',
      title,
      artist,
      artists,
      album,
      duration: duration > 0 ? duration : 0,
      art: art.replace(/=w\d+-h\d+/, '=w544-h544'),
    };
  }

  // True when the full "now playing" page is expanded (not home/browse with
  // just the bottom player bar). YT Music reflects this on the app layout;
  // the geometry check is a fallback in case those attributes change.
  function isPlayerPageOpen() {
    const layout = document.querySelector('ytmusic-app-layout');
    if (layout) {
      if (layout.hasAttribute('player-page-open') || layout.hasAttribute('player-page-open_')) return true;
      const state = layout.getAttribute('player-ui-state') || layout.getAttribute('player-ui-state_');
      if (state) return /PLAYER_PAGE_OPEN|FULLSCREEN/.test(state);
    }
    const page = document.querySelector('ytmusic-player-page');
    if (!page) return false;
    const r = page.getBoundingClientRect();
    return r.height > 0 && r.top < innerHeight / 2 && getComputedStyle(page).visibility !== 'hidden';
  }

  // Bounding box of the player page's right-hand column (Up next / Lyrics /
  // Related tabs), or null if it isn't rendered.
  function sidePanelRect() {
    const el = document.querySelector('ytmusic-player-page #side-panel, ytmusic-player-page .side-panel');
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r : null;
  }

  // Strips the noise YouTube titles carry so search engines can match:
  // "Kesariya (From \"Brahmastra\")", "Song | Movie | Actor", "(Official Video)".
  function cleanTitle(title) {
    return String(title)
      .replace(/\s*[(\[][^)\]]*\b(from|official|video|lyric|lyrical|audio|full song|remaster(ed)?|feat\.?|ft\.?|hd|4k)\b[^)\]]*[)\]]/gi, '')
      .replace(/\s+(feat\.?|ft\.?)\s+.*$/i, '')
      .split(/\s+[|]\s+/)[0]
      .replace(/\s+-\s+from\s+.*$/i, '')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  // ---- YouTube Music internal API (same-origin, uses the user's session) ----

  let cachedVersion = '';
  function clientVersion() {
    if (cachedVersion) return cachedVersion;
    for (const s of document.scripts) {
      const m = s.textContent && s.textContent.match(/"INNERTUBE_CLIENT_VERSION":"([\d.]+)"/);
      if (m) return (cachedVersion = m[1]);
    }
    return (cachedVersion = '1.20250101.01.00');
  }

  async function authHeader() {
    const m = document.cookie.match(/(?:^|;\s*)(?:SAPISID|__Secure-3PAPISID)=([^;]+)/);
    if (!m) return null;
    const ts = Math.floor(Date.now() / 1000);
    const data = new TextEncoder().encode(`${ts} ${m[1]} ${location.origin}`);
    const digest = await crypto.subtle.digest('SHA-1', data);
    const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
    return `SAPISIDHASH ${ts}_${hex}`;
  }

  async function innertube(endpoint, body) {
    const version = clientVersion();
    const headers = {
      'Content-Type': 'application/json',
      'X-Origin': location.origin,
      'X-Goog-AuthUser': '0',
      'X-Youtube-Client-Name': '67',
      'X-Youtube-Client-Version': version,
    };
    const auth = await authHeader();
    if (auth) headers.Authorization = auth;
    const res = await fetch(`${location.origin}/youtubei/v1/${endpoint}?prettyPrint=false`, {
      method: 'POST',
      credentials: 'include',
      headers,
      body: JSON.stringify({
        context: { client: { clientName: 'WEB_REMIX', clientVersion: version, hl: 'en' } },
        ...body,
      }),
    });
    if (!res.ok) throw new Error(`innertube ${endpoint}: HTTP ${res.status}`);
    return res.json();
  }

  // Depth-first search for the first value matching `pick` in a JSON tree.
  function find(node, pick) {
    if (!node || typeof node !== 'object') return undefined;
    const hit = pick(node);
    if (hit !== undefined) return hit;
    for (const v of Object.values(node)) {
      const r = find(v, pick);
      if (r !== undefined) return r;
    }
    return undefined;
  }

  const runsText = (t) => (t && t.runs ? t.runs.map((r) => r.text).join('') : (t && t.simpleText) || '');

  async function fetchYTMLyrics(videoId) {
    const next = await innertube('next', { videoId });
    const browseId = find(next, (n) =>
      typeof n.browseId === 'string' && n.browseId.startsWith('MPLYt') ? n.browseId : undefined
    );
    if (!browseId) return null;

    const page = await innertube('browse', { browseId });
    const shelf = find(page, (n) => n.musicDescriptionShelfRenderer);
    const text = shelf && runsText(shelf.description);
    if (!text) return null;
    const footer = shelf && runsText(shelf.footer);
    return {
      text,
      source: footer ? footer.replace(/^Source:\s*/i, '') + ' via YouTube Music' : 'YouTube Music',
    };
  }

  const api = { getVideo, readTrack, isPlayerPageOpen, sidePanelRect, cleanTitle, fetchYTMLyrics };
  root.Lyricly = Object.assign(root.Lyricly || {}, api);
})(globalThis);
