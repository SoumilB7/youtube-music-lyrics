// Devanagari (Hindi) -> casual Roman ("Hinglish") transliteration.
//
// Pipeline per word:
//   1. Look up a small dictionary of very common words whose everyday Roman
//      spelling doesn't follow the rules (hai, mein, nahi, kyun ...).
//   2. Break the word into phonemes. Every consonant without a vowel sign or
//      virama carries an implicit "a" (the schwa).
//   3. Hindi drops most of those schwas when spoken (कमल is "kamal", not
//      "kamala"; धड़कन is "dhadkan"). We apply the standard schwa-deletion
//      rules: drop the word-final schwa, then scan right-to-left dropping any
//      schwa in a V C _ C V context.
//   4. Render with casual spelling: long vowels are aa/ee/oo mid-word but
//      shortened at the end (tera, teri, tu), nasal endings become
//      -ein/-ain/-on, etc.
(function (root) {
  'use strict';

  const VIRAMA = '्';
  const NUKTA = '़';
  const ANUSVARA = 'ं';
  const CHANDRABINDU = 'ँ';
  const VISARGA = 'ः';
  const ZWJ = '‍';
  const ZWNJ = '‌';

  const CONSONANTS = {
    'क': 'k', 'ख': 'kh', 'ग': 'g', 'घ': 'gh', 'ङ': 'n',
    'च': 'ch', 'छ': 'chh', 'ज': 'j', 'झ': 'jh', 'ञ': 'n',
    'ट': 't', 'ठ': 'th', 'ड': 'd', 'ढ': 'dh', 'ण': 'n',
    'त': 't', 'थ': 'th', 'द': 'd', 'ध': 'dh', 'न': 'n',
    'प': 'p', 'फ': 'ph', 'ब': 'b', 'भ': 'bh', 'म': 'm',
    'य': 'y', 'र': 'r', 'ल': 'l', 'ळ': 'l', 'व': 'v',
    'श': 'sh', 'ष': 'sh', 'स': 's', 'ह': 'h',
    // Precomposed letters that survive NFC (the क़ ख़ ग़ ज़ ड़ ढ़ फ़ य़ series
    // is decomposed by NFC and handled through NUKTA_CONSONANTS instead).
    'ऩ': 'n', 'ऱ': 'r', 'ऴ': 'l',
  };

  // Consonant + nukta (mostly Urdu/Persian sounds).
  const NUKTA_CONSONANTS = {
    'क': 'q', 'ख': 'kh', 'ग': 'gh', 'ज': 'z', 'ड': 'd', 'ढ': 'dh', 'फ': 'f', 'य': 'y',
  };

  const VOWELS = {
    'अ': 'a', 'आ': 'aa', 'इ': 'i', 'ई': 'ee', 'उ': 'u', 'ऊ': 'oo',
    'ऋ': 'ri', 'ॠ': 'ri', 'ऌ': 'li', 'ए': 'e', 'ऐ': 'ai', 'ओ': 'o', 'औ': 'au',
    'ऍ': 'e', 'ऑ': 'o', 'ऎ': 'e', 'ऒ': 'o',
  };

  const MATRAS = {
    'ा': 'aa', 'ि': 'i', 'ी': 'ee', 'ु': 'u', 'ू': 'oo', 'ृ': 'ri', 'ॄ': 'ri',
    'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au', 'ॅ': 'e', 'ॉ': 'o', 'ॆ': 'e', 'ॊ': 'o',
  };

  const LABIALS = new Set(['p', 'ph', 'b', 'bh', 'm', 'f']);

  // Words people spell by convention rather than by rule. Keys are NFC.
  const COMMON = {
    'है': 'hai', 'हैं': 'hain', 'मैं': 'main', 'में': 'mein', 'में': 'mein',
    'नहीं': 'nahi', 'नही': 'nahi', 'यह': 'yeh', 'वह': 'woh', 'वो': 'wo', 'ये': 'ye',
    'क्यों': 'kyun', 'क्यूँ': 'kyun', 'क्यूं': 'kyun', 'क्यो': 'kyo',
    'यूँ': 'yun', 'यूं': 'yun', 'हूँ': 'hoon', 'हूं': 'hoon', 'हुँ': 'hun',
    'माँ': 'maa', 'मां': 'maa', 'भाई': 'bhai', 'कोई': 'koi', 'तू': 'tu', 'तूने': 'tune',
    'वाह': 'waah', 'अब': 'ab', 'और': 'aur', 'पहले': 'pehle', 'कह': 'keh', 'रह': 'reh',
    'जो': 'jo', 'तो': 'toh', 'सब': 'sab', 'हम': 'hum',
    // Compounds where the schwa rule can't see the morpheme boundary.
    'हमसफ़र': 'humsafar', 'हमदम': 'humdum', 'केसरिया': 'kesariya',
    // English loanwords.
    'लव': 'love',
  };

  const DEVANAGARI_RE = /[ऀ-ॿ]/;
  // A "word" is a run of Devanagari letters/signs (not danda or digits).
  const WORD_RE = /[ऀ-ॣ॰-ॿ‌‍]+/g;

  function hasDevanagari(text) {
    return DEVANAGARI_RE.test(text);
  }

  function toPhonemes(word) {
    const chars = [...word];
    const ph = [];
    let hasNukta = false;
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (c === ZWJ || c === ZWNJ) continue;

      if (CONSONANTS[c] !== undefined) {
        let r = CONSONANTS[c];
        if (chars[i + 1] === NUKTA) {
          r = NUKTA_CONSONANTS[c] || r;
          hasNukta = true;
          i++;
        }
        const prev = ph[ph.length - 1];
        // ज्ञ is pronounced "gy" (gyaan), not "jn".
        if (c === 'ञ' && prev && prev.type === 'C' && prev.ch === 'ज') {
          prev.r = 'g';
          r = 'y';
        }
        ph.push({ type: 'C', r, ch: c });

        while (chars[i + 1] === ZWJ || chars[i + 1] === ZWNJ) i++;
        const next = chars[i + 1];
        if (next === VIRAMA) {
          i++;
        } else if (MATRAS[next] !== undefined) {
          ph.push({ type: 'V', r: MATRAS[next] });
          i++;
        } else {
          ph.push({ type: 'V', r: 'a', schwa: true });
        }
      } else if (VOWELS[c] !== undefined) {
        ph.push({ type: 'V', r: VOWELS[c], independent: true });
      } else if (c === ANUSVARA || c === CHANDRABINDU) {
        ph.push({ type: 'N' });
      } else if (c === VISARGA) {
        ph.push({ type: 'C', r: 'h', ch: c });
      } else if (c === 'ॐ') {
        ph.push({ type: 'V', r: 'o', independent: true }, { type: 'C', r: 'm', ch: 'म' });
      }
      // Anything else (avagraha, stray signs) is dropped.
    }
    return { ph, hasNukta };
  }

  const isV = (p) => !!p && p.type === 'V';
  const isC = (p) => !!p && p.type === 'C';

  function deleteSchwas(ph, hasNukta) {
    const vowels = ph.filter(isV).length;
    const last = ph.length - 1;

    // Word-final schwa: dropped unless the word is a single syllable (न -> "na")
    // or it ends in a Sanskrit-style r/y/v cluster (मित्र -> "mitra", सत्य -> "satya").
    // Urdu words (with nukta letters) drop it even then: ज़िक्र -> "zikr".
    if (vowels > 1 && ph[last] && ph[last].schwa) {
      const c1 = ph[last - 1];
      const c0 = ph[last - 2];
      const keep = !hasNukta && isC(c0) && isC(c1) && (c1.ch === 'र' || c1.ch === 'य' || c1.ch === 'व');
      if (!keep) ph.splice(last, 1);
    }

    // Medial schwas, right to left: V C [a] C V -> V C C V.
    for (let i = ph.length - 2; i >= 2; i--) {
      if (ph[i].schwa && isC(ph[i - 1]) && isV(ph[i - 2]) && isC(ph[i + 1]) && isV(ph[i + 2])) {
        ph.splice(i, 1);
      }
    }
    return ph;
  }

  const NASAL_ENDINGS = {
    a: 'an', aa: 'aan', i: 'in', ee: 'in', u: 'un', oo: 'oon',
    e: 'ein', ai: 'ain', o: 'on', au: 'aun', ri: 'rin',
  };
  const PLAIN_ENDINGS = { aa: 'a', ee: 'i', oo: 'u' };

  function render(ph) {
    let out = '';
    const n = ph.length;
    for (let i = 0; i < n; i++) {
      const p = ph[i];
      const prev = ph[i - 1];
      const next = ph[i + 1];

      if (p.type === 'C') {
        let r = p.r;
        // व: "v" at the start or end of a word (vaada, gaanv), "w" between vowels (hawa).
        if (p.ch === 'व') r = i > 0 && isV(next) ? 'w' : 'v';
        out += r;
        continue;
      }

      if (p.type === 'N') {
        // Nasal before a consonant: m before p/b/m (ambar), n otherwise (rang).
        out += isC(next) && LABIALS.has(next.r) ? 'm' : 'n';
        continue;
      }

      // Vowel.
      let r = p.r;
      if (p.independent && (isV(prev) || (prev && prev.type === 'N'))) {
        // Vowel after vowel: गए -> "gaye", जाए -> "jaaye", कोई -> "koi".
        if (r === 'e') r = 'ye';
        else if (r === 'ee') r = 'i';
      }

      const nasalFinal = next && next.type === 'N' && i + 2 === n;
      const plainFinal = i + 1 === n;
      if (nasalFinal) {
        out += NASAL_ENDINGS[r] || r + 'n';
        i++; // the nasal is consumed
        continue;
      }
      if (plainFinal && n > 1) {
        r = PLAIN_ENDINGS[r] || r;
      }
      out += r;
    }

    return out
      .replace(/chchh/g, 'cch') // अच्छा -> "accha"
      .replace(/chh$/, 'ch'); // कुछ -> "kuch"
  }

  function transliterateWord(word) {
    const key = word.normalize('NFC');
    if (COMMON[key]) return COMMON[key];
    const { ph, hasNukta } = toPhonemes(key);
    if (!ph.length) return '';
    return render(deleteSchwas(ph, hasNukta));
  }

  const DIGITS = '०१२३४५६७८९';

  function transliterateLine(text) {
    if (!hasDevanagari(text)) return text;
    let out = text
      .normalize('NFC')
      .replace(WORD_RE, transliterateWord)
      .replace(/[०-९]/g, (d) => String(DIGITS.indexOf(d)))
      .replace(/\s*[।॥]+\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    // Capitalise the first letter, like hand-romanised lyrics, when the line
    // started in Devanagari (leave lines that open in English alone).
    if (/^[^\p{L}]*[ऀ-ॿ]/u.test(text)) {
      out = out.replace(/^([^a-z]*)([a-z])/, (_, pre, ch) => pre + ch.toUpperCase());
    }
    return out;
  }

  const api = { transliterateLine, transliterateWord, hasDevanagari };
  root.Lyricly = Object.assign(root.Lyricly || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
