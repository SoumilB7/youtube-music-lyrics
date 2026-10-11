// Kannada romanisation for Lyricly. Loads after translit.js and registers itself.
//
// Kannada words keep every inherent "a" (ಮನಸು -> "manasu", ಬೆಳಗೆದ್ದು ->
// "belageddu"), so unlike Hindi there is no schwa deletion: a consonant is
// bare only when it carries a virama (್). Spelling follows casual lyric-site
// usage: long vowels doubled (ನಾನು -> "naanu", ನೀನು -> "neenu"), short and long
// e/o both "e"/"o" (ಹೇಳು -> "helu"), ತ -> "th" (ಪ್ರೀತಿ -> "preethi"), doubled
// consonants kept (ಮುದ್ದು -> "muddu"), final ಂ -> "m".
(function (root) {
  'use strict';
  const L = root.Lyricly;

  const VIRAMA = '್';
  const NUKTA = '಼';
  const ANUSVARA = new Set(['ಂ', 'ೳ']);
  const VISARGA = new Set(['ಃ', 'ೱ', 'ೲ']); // ೱ ೲ: Vedic jihvamuliya/upadhmaniya

  const CONSONANTS = {
    'ಕ': 'k', 'ಖ': 'kh', 'ಗ': 'g', 'ಘ': 'gh', 'ಙ': 'n',
    'ಚ': 'ch', 'ಛ': 'chh', 'ಜ': 'j', 'ಝ': 'jh', 'ಞ': 'n',
    'ಟ': 't', 'ಠ': 'th', 'ಡ': 'd', 'ಢ': 'dh', 'ಣ': 'n',
    'ತ': 'th', 'ಥ': 'th', 'ದ': 'd', 'ಧ': 'dh', 'ನ': 'n',
    'ಪ': 'p', 'ಫ': 'ph', 'ಬ': 'b', 'ಭ': 'bh', 'ಮ': 'm',
    'ಯ': 'y', 'ರ': 'r', 'ಱ': 'r', 'ಲ': 'l', 'ಳ': 'l', 'ೞ': 'l', 'ವ': 'v',
    'ಶ': 'sh', 'ಷ': 'sh', 'ಸ': 's', 'ಹ': 'h',
  };

  // Consonant + nukta, for Urdu/English loans: ಫ಼ -> "f", ಜ಼ -> "z".
  const NUKTA_CONSONANTS = { 'ಫ': 'f', 'ಜ': 'z' };

  const VOWELS = {
    'ಅ': 'a', 'ಆ': 'aa', 'ಇ': 'i', 'ಈ': 'ee', 'ಉ': 'u', 'ಊ': 'oo',
    'ಋ': 'ru', 'ೠ': 'ru', 'ಌ': 'lu', 'ೡ': 'lu',
    'ಎ': 'e', 'ಏ': 'e', 'ಐ': 'ai', 'ಒ': 'o', 'ಓ': 'o', 'ಔ': 'au',
  };

  const SIGNS = {
    'ಾ': 'aa', 'ಿ': 'i', 'ೀ': 'ee', 'ು': 'u', 'ೂ': 'oo', 'ೃ': 'ru', 'ೄ': 'ru',
    'ೢ': 'lu', 'ೣ': 'lu',
    'ೆ': 'e', 'ೇ': 'e', 'ೈ': 'ai', 'ೊ': 'o', 'ೋ': 'o', 'ೌ': 'au',
  };

  // A nasal before these is "m" (ಅಂಬರ -> "ambara", ಸಂಸಾರ -> "samsaara",
  // ಸಿಂಹ -> "simha"); before the rest it is "n" (ಅಂದ -> "anda", ಮುಂದೆ -> "munde").
  const M_BEFORE = /^(p|ph|f|b|bh|m|y|r|l|v|sh|s|h)$/;

  // Words people spell by convention rather than by rule.
  const COMMON = {
    'ಕೃಷ್ಣ': 'krishna', 'ಕೃಷ್ಣಾ': 'krishnaa',
  };

  // Kannada letters -> list of { c: roman consonant } / { v: roman vowel } / { n: true }.
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
        // ಜ್ಞ is said "gn": ಜ್ಞಾನ -> "gnaana".
        if (c === 'ಞ' && prev && prev.ch === 'ಜ' && prev.bare) prev.c = 'g';
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
      } else if (VISARGA.has(c)) {
        units.push({ c: 'h' });
      } else if (c === 'ೝ') {
        units.push({ c: 'n', bare: true }); // nakaara pollu: a dead final n
      }
      // Candrabindu (ಁ ಀ), avagraha, length marks and stray signs are dropped.
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
        // ಹುಚ್ಚ -> "huccha". A doubled ತ is a plain "tt": ಮತ್ತೆ -> "matte", ಮುತ್ತು -> "muttu".
        const doubled = u.bare && next && next.c === u.c && u.c.length > 1;
        if (doubled && u.ch === 'ತ' && next.ch === 'ತ') {
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
    // ಹುಡುಗೀ -> "hudugi" (but ನೀ -> "nee"). Final aa stays (ಅಂದಾನೋ -> "andaano").
    const last = units[units.length - 1];
    if (last && (last.v === 'ee' || last.v === 'oo') && units.filter((u) => u.v).length > 1) {
      last.v = last.v[0] === 'e' ? 'i' : 'u';
    }
    return render(units);
  }

  L.registerScript({
    code: 'kn', name: 'Kannada', symbol: 'ಅ',
    test: /[ಀ-೿]/,
    // Letters, vowel signs, virama and nasal signs (not digits).
    words: /[ಀ-ೣೱ-ೳ\u200C\u200D]+/g,
    word: romaniseWord,
    digits: '೦೧೨೩೪೫೬೭೮೯',
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { romaniseWord };
})(globalThis);
