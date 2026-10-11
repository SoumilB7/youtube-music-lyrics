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
  const ZWJ = '\u200D';
  const ZWNJ = '\u200C';

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
    // These two come from Gurmukhi ਸ਼ and ਲ਼, which are stored as ਸ / ਲ + dot.
    'स': 'sh', 'ल': 'l',
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

  const normalizeKeys = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.normalize('NFC'), v]));

  // Words people spell by convention rather than by rule.
  const COMMON = normalizeKeys({
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
  });

  // Devanagari letters and signs; not the danda (। ॥), which Bengali and others share.
  const DEVANAGARI_RE = /[\u0900-\u0963\u0966-\u097F]/;
  // A "word" is a run of Devanagari letters/signs (not danda or digits).
  // Must start with a letter, so a joiner inside an emoji (👩\u200D❤️\u200D👨) isn't taken as a word.
  const WORD_RE = /[\u0900-\u0963\u0970-\u097F][\u0900-\u0963\u0970-\u097F\u200C\u200D]*/g;

  function hasDevanagari(text) {
    return DEVANAGARI_RE.test(text);
  }

  // ---- Punjabi (Gurmukhi) ----
  // Gurmukhi's Unicode block mirrors Devanagari's letter for letter
  // (U+0A15 ਕ ↔ U+0915 क, and so on), so a Gurmukhi word is mapped onto
  // Devanagari and romanised by the same rules, after a few Punjabi-only signs.
  const GURMUKHI_RE = /[\u0A00-\u0A7F]/;
  const GURMUKHI_WORD_RE = /[\u0A01-\u0A65\u0A70-\u0A7F][\u0A01-\u0A65\u0A70-\u0A7F\u200C\u200D]*/g;
  const TIPPI = '\u0A70'; // nasal sign, like anusvara
  const ADDAK = '\u0A71'; // doubles the next consonant

  const COMMON_PA = normalizeKeys({
    'ਨੂੰ': 'nu', 'ਤੂੰ': 'tu', 'ਮੈਨੂੰ': 'mainu', 'ਤੈਨੂੰ': 'tainu', 'ਸਾਨੂੰ': 'saanu',
    'ਤੁਹਾਨੂੰ': 'tuhanu', 'ਉਹਨੂੰ': 'ohnu', 'ਓਹਨੂੰ': 'ohnu',
    'ਵੇ': 've', 'ਨੀ': 'ni', 'ਇਹ': 'eh', 'ਉਹ': 'oh', 'ਓਹ': 'oh', 'ਜੀ': 'ji',
    'ਵਿੱਚ': 'vich', 'ਵਿਚ': 'vich', 'ਕਿਉਂ': 'kyun', 'ਤਾਂ': 'taan', 'ਹਾਏ': 'haaye',
  });

  function gurmukhiToDevanagari(word) {
    let out = '';
    for (const c of word) {
      // Casual spelling writes a doubled consonant once: ਨੱਚਣਾ → "nachna".
      if (c === ADDAK) continue;
      if (c === TIPPI) {
        out += ANUSVARA;
        continue;
      }
      const cp = c.codePointAt(0);
      // Other Punjabi-only signs (ੲ ੳ ੴ, ੑ ੵ) have no Devanagari twin and are dropped.
      if (cp >= 0x0a01 && cp <= 0x0a65) out += String.fromCodePoint(cp - 0x100);
    }
    return out;
  }

  function transliteratePunjabiWord(word) {
    const key = word.normalize('NFC');
    return COMMON_PA[key] || transliterateWord(gurmukhiToDevanagari(key));
  }

  // ---- Script registry ----
  // Every script Lyricly can romanise registers itself here; Hindi and Punjabi
  // are built in, the rest live in src/scripts/*.js. A script is
  //   { code, name, symbol, test: RegExp, words: RegExp (global), word(w) -> roman,
  //     digits?: '<0-9 in that script>' }
  // `symbol` is the letter shown on the panel's original-script button.
  const SCRIPTS = [];
  function registerScript(def) {
    if (!SCRIPTS.some((s) => s.code === def.code)) SCRIPTS.push(def);
  }
  const scriptFor = (ch) => SCRIPTS.find((s) => s.test.test(ch));

  function isRomanisable(text) {
    return SCRIPTS.some((s) => s.test.test(text));
  }

  // Code of the script of the first romanisable letter ('hi', 'pa', ...) or null.
  function scriptOf(text) {
    for (const ch of String(text)) {
      const s = /\p{L}|\p{M}/u.test(ch) && scriptFor(ch);
      if (s) return s.code;
    }
    return null;
  }

  const scriptInfo = (code) => {
    const s = SCRIPTS.find((x) => x.code === code);
    return s ? { code: s.code, name: s.name, symbol: s.symbol } : null;
  };

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
      let glide = '';
      // A long ee right before another vowel is said short: ਦੀਆਂ -> "diyaan", पीए -> "piye".
      if (!p.independent && r === 'ee' && isV(next) && next.independent) r = 'i';
      if (p.independent && (isV(prev) || (prev && prev.type === 'N'))) {
        // Vowel after vowel: गए -> "gaye", जाए -> "jaaye", कोई -> "koi".
        if (r === 'e') r = 'ye';
        else if (r === 'ee') r = 'i';
        // After i/ee a y slips in: ਸਾਰਿਆਂ -> "saariyaan", ਦੀਆਂ -> "deeyaan".
        else if (isV(prev) && (prev.r === 'i' || prev.r === 'ee') && /^(a|aa|o|oo|u|au)$/.test(r)) glide = 'y';
      }

      const nasalFinal = next && next.type === 'N' && i + 2 === n;
      const plainFinal = i + 1 === n;
      if (nasalFinal) {
        out += glide + (NASAL_ENDINGS[r] || r + 'n');
        i++; // the nasal is consumed
        continue;
      }
      if (plainFinal && n > 1) {
        r = PLAIN_ENDINGS[r] || r;
      }
      out += glide + r;
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
  const DIGITS_PA = '੦੧੨੩੪੫੬੭੮੯';

  function transliterateLine(text) {
    if (!isRomanisable(text)) return text;
    let out = text.normalize('NFC');
    for (const s of SCRIPTS) {
      if (!s.test.test(out)) continue;
      out = out.replace(s.words, (w) => s.word(w));
      if (s.digits) out = out.replace(new RegExp(`[${s.digits}]`, 'g'), (d) => String(s.digits.indexOf(d)));
    }
    out = out
      .replace(/\s*[।॥]+\s*/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    // Capitalise the first letter, like hand-romanised lyrics, when the line
    // started in a romanised script (leave lines that open in English alone).
    const first = String(text).match(/\p{L}/u);
    if (first && scriptFor(first[0])) {
      out = out.replace(/^([^a-z]*)([a-z])/, (_, pre, ch) => pre + ch.toUpperCase());
    }
    return out;
  }

  registerScript({
    code: 'hi', name: 'Hindi', symbol: 'अ', test: DEVANAGARI_RE, words: WORD_RE, word: transliterateWord, digits: DIGITS,
  });
  registerScript({
    code: 'pa', name: 'Punjabi', symbol: 'ਪ', test: GURMUKHI_RE, words: GURMUKHI_WORD_RE, word: transliteratePunjabiWord, digits: DIGITS_PA,
  });

  // Building blocks for scripts laid out like Devanagari (most Indian
  // scripts): map onto Devanagari, then reuse these. See src/scripts/.
  const indic = { toPhonemes, deleteSchwas, render, transliterateWord, normalizeKeys };

  const api = {
    transliterateLine, transliterateWord, hasDevanagari, isRomanisable, scriptOf, scriptInfo, registerScript, indic,
  };
  root.Lyricly = Object.assign(root.Lyricly || {}, api);
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
