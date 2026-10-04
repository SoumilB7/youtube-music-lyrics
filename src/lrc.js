// Turning lyrics text into timed lines: [{ t: seconds, text }].
(function (root) {
  'use strict';

  const TIME_TAG = /\[(\d{1,3}):(\d{1,2}(?:[.:]\d{1,3})?)\]/g;

  // Parses LRC ("[01:23.45] line"). Supports multiple timestamps per line,
  // the [offset:] header, and strips enhanced word-level <mm:ss.xx> tags.
  function parseLRC(lrc) {
    let offset = 0;
    const lines = [];
    for (const raw of String(lrc || '').split(/\r?\n/)) {
      const off = raw.match(/^\s*\[offset:\s*([+-]?\d+)\s*\]/i);
      if (off) {
        offset = Number(off[1]) / 1000;
        continue;
      }
      const tags = [...raw.matchAll(TIME_TAG)];
      if (!tags.length) continue;
      const text = raw
        .replace(/\[[^\]]*\]/g, '')
        .replace(/<\d+:\d+(?:[.:]\d+)?>/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      for (const m of tags) {
        const t = Number(m[1]) * 60 + parseFloat(m[2].replace(':', '.'));
        lines.push({ t: Math.max(0, t - offset), text });
      }
    }
    lines.sort((a, b) => a.t - b.t);
    return withIntro(collapseGaps(lines));
  }

  // Plain (untimed) lyrics -> lines; blank lines are kept as stanza gaps.
  function plainToLines(plain) {
    return collapseGaps(
      String(plain || '')
        .split(/\r?\n/)
        .map((text) => ({ t: 0, text: text.replace(/\s+/g, ' ').trim() }))
    );
  }

  // Spreads untimed lines over the track so the highlight lands in the right
  // vicinity: skip a typical intro and outro, then give each line time in
  // proportion to its length, with stanza breaks counting as short pauses.
  function estimateTimings(lines, duration) {
    const total = Number.isFinite(duration) && duration > 0 ? duration : 240;
    const start = clamp(total * 0.07, 5, 25);
    const end = total - clamp(total * 0.06, 5, 20);
    const trimmed = trimGaps(lines);
    const weights = trimmed.map((l) => (l.text ? 1 + l.text.length / 30 : 1.5));
    const sum = weights.reduce((a, b) => a + b, 0) || 1;
    let t = start;
    const out = trimmed.map((l, i) => {
      const line = { t, text: l.text };
      t += ((end - start) * weights[i]) / sum;
      return line;
    });
    return withIntro(out);
  }

  function collapseGaps(lines) {
    const out = [];
    for (const l of lines) {
      if (!l.text && out.length && !out[out.length - 1].text) continue;
      out.push(l);
    }
    return out;
  }

  function trimGaps(lines) {
    let a = 0;
    let b = lines.length;
    while (a < b && !lines[a].text) a++;
    while (b > a && !lines[b - 1].text) b--;
    return lines.slice(a, b);
  }

  // A "♪" placeholder before the first line so the panel has something
  // to highlight during the intro.
  function withIntro(lines) {
    if (lines.length && lines[0].t > 3 && lines[0].text) {
      return [{ t: 0, text: '' }, ...lines];
    }
    return lines;
  }

  function clamp(v, lo, hi) {
    return Math.min(hi, Math.max(lo, v));
  }

  // Index of the line playing at time t (last line with line.t <= t), or -1.
  function lineIndexAt(lines, t) {
    let lo = 0;
    let hi = lines.length - 1;
    let ans = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (lines[mid].t <= t) {
        ans = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    return ans;
  }

  const api = { parseLRC, plainToLines, estimateTimings, lineIndexAt };
  root.Lyricly = Object.assign(root.Lyricly || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
