// Odia romanisation for Lyricly. Loads after translit.js and registers itself.
//
// Odia is laid out like Devanagari, but it is read differently from Hindi, so
// it has its own small pipeline instead of the Hindi schwa rules:
//   - The inherent vowel is kept everywhere, including at the end of a word:
//     ମନ → "mana", ଜୀବନ → "jibana", ହଳଦୀ → "haladi", ରଙ୍ଗବତୀ → "rangabati".
//   - Vowel length isn't marked in casual spelling: ଆଜି → "aji", ରାତି → "rati".
//   - ଯ is "j" (ଯିବି → "jibi"), ୟ is "y", ବ is "b", ଶ/ଷ are "s" (ଭୁବନେଶ୍ୱର →
//     "bhubaneswara"), ୃ is "ru" (ହୃଦୟ → "hrudaya").
(function (root) {
  'use strict';

  const L = root.Lyricly;

  const VIRAMA = '୍';
  const NUKTA = '଼';
  const ANUSVARA = 'ଂ';
  const CHANDRABINDU = 'ଁ';
  const VISARGA = 'ଃ';

  const CONSONANTS = {
    'କ': 'k', 'ଖ': 'kh', 'ଗ': 'g', 'ଘ': 'gh', 'ଙ': 'n',
    'ଚ': 'ch', 'ଛ': 'chh', 'ଜ': 'j', 'ଝ': 'jh', 'ଞ': 'n',
    'ଟ': 't', 'ଠ': 'th', 'ଡ': 'd', 'ଢ': 'dh', 'ଣ': 'n',
    'ତ': 't', 'ଥ': 'th', 'ଦ': 'd', 'ଧ': 'dh', 'ନ': 'n',
    'ପ': 'p', 'ଫ': 'ph', 'ବ': 'b', 'ଭ': 'bh', 'ମ': 'm',
    'ଯ': 'j', 'ୟ': 'y', 'ର': 'r', 'ଲ': 'l', 'ଳ': 'l', 'ଵ': 'v', 'ୱ': 'w',
    'ଶ': 's', 'ଷ': 's', 'ସ': 's', 'ହ': 'h',
  };

  // ଡ଼ and ଢ଼ (stored as ଡ/ଢ + nukta after NFC) are flaps, but lyrics spell them
  // like the plain letters: ଚଢ଼େଇ → "chadhei", ବୁଢ଼ା → "budha".
  const NUKTA_CONSONANTS = { 'ଡ': 'd', 'ଢ': 'dh' };

  const VOWELS = {
    'ଅ': 'a', 'ଆ': 'a', 'ଇ': 'i', 'ଈ': 'i', 'ଉ': 'u', 'ଊ': 'u',
    'ଋ': 'ru', 'ୠ': 'ru', 'ଌ': 'li', 'ୡ': 'li', 'ଏ': 'e', 'ଐ': 'ai', 'ଓ': 'o', 'ଔ': 'au',
  };

  const MATRAS = {
    'ା': 'a', 'ି': 'i', 'ୀ': 'i', 'ୁ': 'u', 'ୂ': 'u', 'ୃ': 'ru', 'ୄ': 'ru',
    'ୢ': 'li', 'ୣ': 'li', 'େ': 'e', 'ୈ': 'ai', 'ୋ': 'o', 'ୌ': 'au',
  };

  const LABIALS = /^(p|ph|b|bh|m)/;

  // Words people spell by convention rather than by rule.
  const COMMON = L.indic.normalizeKeys({
    'ମୁଁ': 'mu', 'ମୁ': 'mu', 'ନାଁ': 'na', 'ହଁ': 'han', 'ହାଁ': 'han', 'ହୁଁ': 'hun',
    'ନାହିଁ': 'nahin', 'ନାଇଁ': 'nain', 'ଶ୍ରୀ': 'sri',
    // Hindi/Urdu loans keep their Hindi spelling.
    'ଦିଲ': 'dil', 'ଇଶ୍କ': 'ishq', 'ପ୍ୟାର': 'pyar',
  });

  // Spelling fixes applied to the word before reading it:
  //   ହ୍ନ is said (and written) "nh": ଜହ୍ନ → "janha", କହ୍ନେଇ → "kanhei".
  const preprocess = (word) => word.replace(/ହ୍ନ/g, 'ନ୍ହ');

  // Sound of the consonant at chars[i] and how many extra characters it used.
  function consonant(chars, i) {
    const c = chars[i];
    if (chars[i + 1] === NUKTA) return { r: NUKTA_CONSONANTS[c] || CONSONANTS[c], used: 1 };
    // ଯ written under another consonant (the y-phala) is "y": ବାକ୍ଯ → "bakya".
    if (c === 'ଯ' && chars[i - 1] === VIRAMA) return { r: 'y', used: 0 };
    // ଜ୍ଞ is "gy": ଜ୍ଞାନ → "gyana".
    if (c === 'ଞ' && chars[i - 1] === VIRAMA && chars[i - 2] === 'ଜ') return { r: 'y', used: 0 };
    if (c === 'ଜ' && chars[i + 1] === VIRAMA && chars[i + 2] === 'ଞ') return { r: 'g', used: 0 };
    // ଷ୍ଣ keeps its "sh": କୃଷ୍ଣ → "krushna", ତୃଷ୍ଣା → "trushna".
    if (c === 'ଷ' && chars[i + 1] === VIRAMA && chars[i + 2] === 'ଣ') return { r: 'sh', used: 0 };
    return { r: CONSONANTS[c], used: 0 };
  }

  // Word → list of sounds: { type: 'C' | 'V' | 'N', r }.
  function toSounds(word) {
    const chars = [...word].filter((c) => c !== '\u200C' && c !== '\u200D');
    const out = [];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (CONSONANTS[c] !== undefined) {
        const { r, used } = consonant(chars, i);
        i += used;
        out.push({ type: 'C', r });
        const next = chars[i + 1];
        if (next === VIRAMA) i++;
        else if (MATRAS[next] !== undefined) {
          out.push({ type: 'V', r: MATRAS[next] });
          i++;
        } else out.push({ type: 'V', r: 'a', inherent: true });
      } else if (VOWELS[c] !== undefined) {
        out.push({ type: 'V', r: VOWELS[c], independent: true });
      } else if (c === ANUSVARA || c === CHANDRABINDU) {
        out.push({ type: 'N' });
      } else if (c === VISARGA) {
        // ଦୁଃଖ → "dukha": silent before a consonant, "h" elsewhere.
        if (!(CONSONANTS[chars[i + 1]] !== undefined)) out.push({ type: 'C', r: 'h' });
      }
      // Avagraha, stray length marks and other signs are dropped.
    }
    return out;
  }

  function render(sounds) {
    let out = '';
    sounds.forEach((s, i) => {
      const prev = sounds[i - 1];
      const next = sounds[i + 1];
      if (s.type === 'N') {
        // ଅମ୍ବର-style nasal before p/b/m is "m" (ସମ୍ପର୍କ), otherwise "n": ପାଇଁ → "pain".
        out += next && next.type === 'C' && LABIALS.test(next.r) ? 'm' : 'n';
      } else if (s.type === 'V' && s.independent && s.r === 'e' && prev && prev.type === 'V' && /a$/.test(prev.r)) {
        // A y slips in between a and e: ପାଏ → "paye", ଯାଏ → "jaye".
        out += 'ye';
      } else {
        out += s.r;
      }
    });
    return out
      .replace(/chchh/g, 'cchh') // ଅଚ୍ଛା → "acchha"
      // Odia spelling doubles a consonant after reph, but it is said once:
      // ପୂର୍ଣ୍ଣ → "purna", ମୁହୂର୍ତ୍ତ → "muhurta", ଜନାର୍ଦ୍ଦନ → "janardana".
      .replace(/r([bcdgjklmnpstv])\1/g, 'r$1');
  }

  function romaniseWord(word) {
    const key = word.normalize('NFC');
    if (COMMON[key]) return COMMON[key];
    return render(toSounds(preprocess(key)));
  }

  L.registerScript({
    code: 'or',
    name: 'Odia',
    symbol: 'ଅ',
    test: /[଀-୿]/,
    // Letters, vowel signs, virama, nukta and nasal signs (not digits or ୰).
    words: /[ଁ-ୣୱ\u200C\u200D]+/g,
    word: romaniseWord,
    digits: '୦୧୨୩୪୫୬୭୮୯',
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { romaniseWord };
})(globalThis);
