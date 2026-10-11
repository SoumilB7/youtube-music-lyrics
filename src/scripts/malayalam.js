// Malayalam romanisation for Lyricly. Loads after translit.js and registers itself.
//
// Malayalam keeps every inherent "a" (മനസ്സ് is "manassu", not "mansu"), so
// there is no schwa deletion: each consonant is read with its vowel sign, its
// inherent "a", or nothing when a chandrakkala (്) joins it to the next one.
// The output follows the casual spelling of lyric sites: "Ente khalbile",
// "Malare", "kaattu", "mazha", "njan".
(function (root) {
  'use strict';
  const L = root.Lyricly;

  const VIRAMA = '്'; // chandrakkala
  const ANUSVARA = 'ം';
  const VISARGA = 'ഃ';
  const DOT_REPH = 'ൎ';
  const ZWJ = '\u200D';
  const ZWNJ = '\u200C';

  const CONSONANTS = {
    'ക': 'k', 'ഖ': 'kh', 'ഗ': 'g', 'ഘ': 'gh', 'ങ': 'ng',
    'ച': 'ch', 'ഛ': 'chh', 'ജ': 'j', 'ഝ': 'jh', 'ഞ': 'nj',
    'ട': 't', 'ഠ': 'th', 'ഡ': 'd', 'ഢ': 'dh', 'ണ': 'n',
    'ത': 'th', 'ഥ': 'th', 'ദ': 'd', 'ധ': 'dh', 'ന': 'n',
    'പ': 'p', 'ഫ': 'ph', 'ബ': 'b', 'ഭ': 'bh', 'മ': 'm',
    'യ': 'y', 'ര': 'r', 'ല': 'l', 'വ': 'v',
    'ശ': 'sh', 'ഷ': 'sh', 'സ': 's', 'ഹ': 'h',
    'ള': 'l', 'ഴ': 'zh', 'റ': 'r', 'ഩ': 'n', 'ഺ': 't',
  };

  // Chillu letters: consonants that never carry a vowel (അവൻ "avan", കടൽ "kadal").
  const CHILLUS = {
    'ൺ': 'n', 'ൻ': 'n', 'ർ': 'r', 'ൽ': 'l', 'ൾ': 'l', 'ൿ': 'k', 'ൔ': 'm', 'ൕ': 'y', 'ൖ': 'zh',
  };
  // Old-style chillus are written consonant + ് + ZWJ (ന്\u200D for ൻ).
  const CHILLU_OF = { 'ണ': 'ൺ', 'ന': 'ൻ', 'ര': 'ർ', 'ല': 'ൽ', 'ള': 'ൾ', 'ക': 'ൿ', 'മ': 'ൔ', 'യ': 'ൕ', 'ഴ': 'ൖ' };

  const VOWELS = {
    'അ': 'a', 'ആ': 'aa', 'ഇ': 'i', 'ഈ': 'ee', 'ഉ': 'u', 'ഊ': 'oo', 'ഋ': 'ri', 'ൠ': 'ri',
    'ഌ': 'li', 'ൡ': 'li', 'എ': 'e', 'ഏ': 'e', 'ഐ': 'ai', 'ഒ': 'o', 'ഓ': 'o', 'ഔ': 'au',
  };

  // Vowel signs. എ/ഏ and ഒ/ഓ are both written e/o, as lyric sites do (താനേ "thaane").
  const SIGNS = {
    'ാ': 'aa', 'ി': 'i', 'ീ': 'ee', 'ു': 'u', 'ൂ': 'oo', 'ൃ': 'ru', 'ൄ': 'ru', 'ൢ': 'li', 'ൣ': 'li',
    'െ': 'e', 'േ': 'e', 'ൈ': 'ai', 'ൊ': 'o', 'ോ': 'o', 'ൌ': 'au', 'ൗ': 'au',
  };

  // Words whose everyday spelling doesn't follow the rules.
  const COMMON = {
    'ഞാൻ': 'njan', // not "njaan"
  };

  const VELARS = new Set(['k', 'kh', 'g', 'gh']);
  const END_SHORT = { aa: 'a', ee: 'i', oo: 'u' };

  // Break a word into units:
  //   C  consonant, with v = vowel sign / 'a' (inherent) / '' (chandrakkala)
  //   V  independent vowel, K chillu, M anusvara, H visarga, R dot reph.
  function parse(word) {
    const chars = [...word];
    const units = [];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (CONSONANTS[c] !== undefined) {
        const u = { t: 'C', ch: c, v: 'a' };
        const next = chars[i + 1];
        if (next === VIRAMA || next === '഻' || next === '഼') {
          i++;
          if (chars[i + 1] === ZWJ && CHILLU_OF[c]) {
            // ന്\u200D → ൻ
            i++;
            units.push({ t: 'K', ch: CHILLU_OF[c] });
            continue;
          }
          if (chars[i + 1] === ZWNJ) i++;
          u.v = '';
        } else if (SIGNS[next] !== undefined) {
          u.v = SIGNS[next];
          i++;
          // Old samvruthokaram spelling ു് (കാറ്റു്): the extra ് is silent.
          if (chars[i + 1] === VIRAMA) i++;
        }
        units.push(u);
      } else if (CHILLUS[c] !== undefined) {
        // ൻ്റ, a common way to type ന്റ: the ് between them is silent.
        if (c === 'ൻ' && chars[i + 1] === VIRAMA && chars[i + 2] === 'റ') i++;
        units.push({ t: 'K', ch: c });
      } else if (VOWELS[c] !== undefined) {
        units.push({ t: 'V', r: VOWELS[c] });
      } else if (SIGNS[c] !== undefined) {
        // A stray sign (ൗ on its own, or a sign after a vowel) still sounds.
        units.push({ t: 'V', r: SIGNS[c] });
      } else if (c === ANUSVARA || c === 'ഀ' || c === 'ഁ') {
        units.push({ t: 'M' });
      } else if (c === VISARGA) {
        units.push({ t: 'H' });
      } else if (c === DOT_REPH) {
        units.push({ t: 'R' });
      }
      // ZWJ/ZWNJ elsewhere, avagraha and other marks are dropped.
    }
    return units;
  }

  // Does unit u end in a vowel sound?
  const voweled = (u) => !!u && ((u.t === 'C' && u.v !== '') || u.t === 'V');
  const isNasal = (u) => !!u && ((u.t === 'C' && u.v === '' && (u.ch === 'ണ' || u.ch === 'ന')) || (u.t === 'K' && (u.ch === 'ൺ' || u.ch === 'ൻ')));

  // Roman letters for consonant i, whose vowel (already worked out) is v.
  function consonant(units, i, v) {
    const u = units[i];
    const prev = units[i - 1];
    const next = units[i + 1];
    const joined = u.v === '' && next && next.t === 'C'; // ് followed by a consonant
    const r = CONSONANTS[u.ch];

    // ന്റ / ൻറ → "nt" (എന്റെ "ente"); റ്റ → "tt" (കാറ്റ് "kaattu").
    if (u.ch === 'റ') {
      if (prev && ((prev.t === 'C' && prev.v === '' && (prev.ch === 'ന' || prev.ch === 'റ')) || (prev.t === 'K' && prev.ch === 'ൻ'))) return 't';
      if (joined && next.ch === 'റ') return 't';
    }
    // Doubled consonants: ക്ക "kk", ല്ല "ll", but a digraph is written once:
    // ത്ത "th" (മുത്തേ "muthe"), ങ്ങ "ng", ഞ്ഞ "nj", ച്ച "ch".
    if (joined && next.ch === u.ch) return r.length > 1 ? '' : r;
    // ങ്ക "nk", ഞ്ച "nch": the nasal before another consonant is just "n".
    if (joined && (u.ch === 'ങ' || u.ch === 'ഞ')) return 'n';
    // ട is voiced between vowels and after n: വീട് "veedu", ഉണ്ട് "undu".
    if (u.ch === 'ട' && v !== '' && (voweled(prev) || isNasal(prev))) return 'd';
    // വ after a consonant is "w": സ്വപ്നം "swapnam".
    if (u.ch === 'വ' && prev && prev.t === 'C' && prev.v === '') return 'w';
    return r;
  }

  // The vowel after consonant i ('' for a silent chandrakkala).
  function vowelOf(units, i) {
    const u = units[i];
    if (u.v !== '') return u.v;
    if (i + 1 < units.length) return '';
    // Word-final chandrakkala is a short "u" (samvruthokaram): കാറ്റ് "kaattu".
    // Two exceptions:
    //  - യ് stays "y": ആയ് "aay" (lyricists write ആയി when they mean "aayi").
    //  - Text typed before atomic chillus often writes ന് ര് ല് ള് after a
    //    vowel for ൻ ർ ൽ ൾ (തെന്നല് "thennal", ഞാന് "njan"); a doubled
    //    letter (നിന്ന് "ninnu") still gets the "u".
    if (u.ch === 'യ') return '';
    if ('നരലള'.includes(u.ch) && voweled(units[i - 1])) return '';
    return 'u';
  }

  function render(units) {
    let out = '';
    const vowels = units.filter((u) => voweled(u)).length;
    for (let i = 0; i < units.length; i++) {
      const u = units[i];
      const next = units[i + 1];
      const last = i + 1 === units.length;
      if (u.t === 'C') {
        let v = vowelOf(units, i);
        // A long vowel at the end of a longer word is written short:
        // വന്നൂ "vannu", കാണാ "kaana" (but നീ stays "nee").
        if (last && vowels > 1 && END_SHORT[v]) v = END_SHORT[v];
        out += consonant(units, i, v) + v;
      } else if (u.t === 'V') {
        out += last && vowels > 1 && END_SHORT[u.r] ? END_SHORT[u.r] : u.r;
      } else if (u.t === 'K') {
        out += CHILLUS[u.ch];
      } else if (u.t === 'M') {
        // ം is "m" (മനം "manam", അംശം "amsham"), "n" before k/g (സംഗീതം "sangeetham").
        out += next && next.t === 'C' && VELARS.has(CONSONANTS[next.ch]) ? 'n' : 'm';
      } else if (u.t === 'H') {
        out += 'h';
      } else if (u.t === 'R') {
        out += 'r';
      }
    }
    return out;
  }

  // Spelling used to look a word up in COMMON: old chillus (ന്\u200D, or a bare
  // final ന്) made atomic, so ഞാന്\u200D and ഞാന് match ഞാൻ.
  const lookupKey = (w) => w
    .replace(/([ണനരലളകമയഴ])്\u200D/g, (_, c) => CHILLU_OF[c])
    .replace(/ന്$/, 'ൻ');

  function romaniseWord(word) {
    const key = word.normalize('NFC');
    const common = COMMON[lookupKey(key)];
    if (common) return common;
    return render(parse(key));
  }

  L.registerScript({
    code: 'ml', name: 'Malayalam', symbol: 'അ',
    test: /[ഀ-ൿ]/,
    // A run starting with a Malayalam letter or sign (not a digit, fraction or
    // number sign); joiners only count inside a word, so emoji ZWJs are left alone.
    words: /[ഀ-ൎൔ-ൗൟ-ൣൺ-ൿ][ഀ-ൎൔ-ൗൟ-ൣൺ-ൿ\u200C\u200D]*/g,
    word: romaniseWord,
    digits: '൦൧൨൩൪൫൬൭൮൯',
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = { romaniseWord };
})(globalThis);
