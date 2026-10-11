// Telugu romanisation for Lyricly. Loads after translit.js and registers itself.
//
// Telugu words keep every inherent "a" (ప్రేమ -> "prema", మనసు -> "manasu"),
// so unlike Hindi there is no schwa deletion: a consonant is bare only when it
// carries a virama (్). Spelling follows casual lyric-site usage: long vowels
// doubled (నా -> "naa", నీ -> "nee"), short and long e/o both "e"/"o"
// (కావాలే -> "kaavaale"), త -> "th" (జతగా -> "jathagaa"), doubled consonants
// kept (నువ్వు -> "nuvvu"), final ం -> "m" (ఇంకేం -> "inkem").
(function (root) {
  'use strict';
  const L = root.Lyricly;

  const VIRAMA = '్';
  const NUKTA = '఼';
  const ANUSVARA = new Set(['ం', 'ఄ']);
  const VISARGA = 'ః';

  const CONSONANTS = {
    'క': 'k', 'ఖ': 'kh', 'గ': 'g', 'ఘ': 'gh', 'ఙ': 'n',
    'చ': 'ch', 'ఛ': 'chh', 'జ': 'j', 'ఝ': 'jh', 'ఞ': 'n',
    'ట': 't', 'ఠ': 'th', 'డ': 'd', 'ఢ': 'dh', 'ణ': 'n',
    'త': 'th', 'థ': 'th', 'ద': 'd', 'ధ': 'dh', 'న': 'n',
    'ప': 'p', 'ఫ': 'ph', 'బ': 'b', 'భ': 'bh', 'మ': 'm',
    'య': 'y', 'ర': 'r', 'ఱ': 'r', 'ల': 'l', 'ళ': 'l', 'ఴ': 'l', 'వ': 'v',
    'శ': 'sh', 'ష': 'sh', 'స': 's', 'హ': 'h',
    // Old ts/dz/rr letters, still seen in some texts.
    'ౘ': 'ts', 'ౙ': 'dz', 'ౚ': 'r',
  };

  // Consonant + nukta, for Urdu/English loans: ఫ఼ -> "f", జ఼ -> "z".
  const NUKTA_CONSONANTS = { 'ఫ': 'f', 'జ': 'z' };

  const VOWELS = {
    'అ': 'a', 'ఆ': 'aa', 'ఇ': 'i', 'ఈ': 'ee', 'ఉ': 'u', 'ఊ': 'oo',
    'ఋ': 'ru', 'ౠ': 'ru', 'ఌ': 'lu', 'ౡ': 'lu',
    'ఎ': 'e', 'ఏ': 'e', 'ఐ': 'ai', 'ఒ': 'o', 'ఓ': 'o', 'ఔ': 'au',
  };

  const SIGNS = {
    'ా': 'aa', 'ి': 'i', 'ీ': 'ee', 'ు': 'u', 'ూ': 'oo', 'ృ': 'ru', 'ౄ': 'ru',
    'ౢ': 'lu', 'ౣ': 'lu',
    'ె': 'e', 'ే': 'e', 'ై': 'ai', 'ొ': 'o', 'ో': 'o', 'ౌ': 'au',
  };

  // A nasal before these is "m" (అంబరం -> "ambaram", సంసారం -> "samsaaram",
  // సింహం -> "simham"); before the rest it is "n" (అందం -> "andam", మంచి -> "manchi").
  const M_BEFORE = /^(p|ph|f|b|bh|m|y|r|l|v|sh|s|h)$/;

  // Words people spell by convention rather than by rule.
  const COMMON = {
    'కృష్ణ': 'krishna', 'కృష్ణా': 'krishnaa',
  };

  // Telugu letters -> list of { c: roman consonant } / { v: roman vowel } / { n: true }.
  function toUnits(word) {
    const chars = [...word];
    const units = [];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (CONSONANTS[c] !== undefined) {
        let r = CONSONANTS[c];
        if (chars[i + 1] === NUKTA) {
          r = NUKTA_CONSONANTS[c] || r;
          i++;
        }
        const prev = units[units.length - 1];
        // జ్ఞ is said "gn": విజ్ఞానం -> "vignaanam".
        if (c === 'ఞ' && prev && prev.ch === 'జ' && prev.bare) prev.c = 'g';
        const unit = { c: r, ch: c };
        units.push(unit);
        while (chars[i + 1] === '\u200C' || chars[i + 1] === '\u200D') i++;
        const next = chars[i + 1];
        if (next === VIRAMA) {
          unit.bare = true;
          i++;
        } else if (SIGNS[next] !== undefined) {
          units.push({ v: SIGNS[next] });
          i++;
        } else {
          units.push({ v: 'a' });
        }
      } else if (VOWELS[c] !== undefined) {
        units.push({ v: VOWELS[c] });
      } else if (ANUSVARA.has(c)) {
        units.push({ n: true });
      } else if (c === VISARGA) {
        units.push({ c: 'h' });
      } else if (c === 'ౝ') {
        units.push({ c: 'n', bare: true }); // nakaara pollu: a dead final n
      }
      // Arasunna (ఁ), avagraha, length marks and stray signs are dropped.
    }
    return units;
  }

  function render(units) {
    let out = '';
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const next = units[i + 1];
      if (u.n) {
        out += next && next.c && !M_BEFORE.test(next.c) ? 'n' : 'm';
      } else if (u.c) {
        // A doubled digraph is written with its first letter doubled:
        // పచ్చ -> "paccha". A doubled త is a plain "tt": కొత్త -> "kotta".
        const doubled = u.bare && next && next.c === u.c && u.c.length > 1;
        if (doubled && u.ch === 'త' && next.ch === 'త') {
          out += 'tt';
          i++;
          continue;
        }
        out += doubled ? u.c[0] : u.c;
      } else {
        out += u.v;
      }
    }
    return out;
  }

  function romaniseWord(word) {
    const key = word.normalize('NFC');
    if (COMMON[key]) return COMMON[key];
    const units = toUnits(key);
    // A final long ee/oo is written short after the first syllable:
    // మళ్లీ -> "malli", హోలీ -> "holi" (but నీ -> "nee"). Final aa stays (జతగా -> "jathagaa").
    const last = units[units.length - 1];
    if (last && (last.v === 'ee' || last.v === 'oo') && units.filter((u) => u.v).length > 1) {
      last.v = last.v[0] === 'e' ? 'i' : 'u';
    }
    return render(units);
  }

  L.registerScript({
    code: 'te', name: 'Telugu', symbol: 'అ',
    test: /[ఀ-౿]/,
    // Letters, vowel signs, virama and nasal signs (not digits or fractions).
    words: /[ఀ-ౣ\u200C\u200D]+/g,
    word: romaniseWord,
    digits: '౦౧౨౩౪౫౬౭౮౯',
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { romaniseWord };
})(globalThis);
