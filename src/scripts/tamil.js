// Tamil romanisation for Lyricly. Loads after translit.js and registers itself.
//
// Tamil doesn't work like Hindi: a consonant without pulli (்) always keeps
// its "a" (கண் -> "kan", கண்ணா -> "kanna"), so there is no schwa deletion.
// The hard part is that one letter covers both the voiced and unvoiced sound
// (க is k or g, த is th or dh), and which one you hear depends on what comes
// right before it. Pipeline per word:
//   1. Split into phonemes: consonants (with a pulli flag) and vowels.
//   2. Pick each consonant's spelling from its left neighbour: word start,
//      vowel, the same letter (doubling), a nasal, or another consonant.
//   3. Shorten a final long aa/ee in longer words (கண்ணா -> "kanna").
(function (root) {
  'use strict';

  const L = root.Lyricly;

  const PULLI = '்';
  const AYTHAM = 'ஃ';
  const ZWJ = '\u200D';
  const ZWNJ = '\u200C';

  // Default spelling of each consonant; stops are refined in stopFor().
  const CONSONANTS = {
    'க': 'k', 'ங': 'ng', 'ச': 's', 'ஞ': 'nj', 'ட': 't', 'ண': 'n',
    'த': 'th', 'ந': 'n', 'ப': 'p', 'ம': 'm', 'ய': 'y', 'ர': 'r',
    'ல': 'l', 'வ': 'v', 'ழ': 'zh', 'ள': 'l', 'ற': 'r', 'ன': 'n',
    // Grantha letters for Sanskrit and English words: ஜாலி -> "jaali".
    'ஜ': 'j', 'ஶ': 'sh', 'ஷ': 'sh', 'ஸ': 's', 'ஹ': 'h',
  };

  const VOWELS = {
    'அ': 'a', 'ஆ': 'aa', 'இ': 'i', 'ஈ': 'ee', 'உ': 'u', 'ஊ': 'oo',
    'எ': 'e', 'ஏ': 'ae', 'ஐ': 'ai', 'ஒ': 'o', 'ஓ': 'o', 'ஔ': 'au',
  };

  // Long ே and ோ are written plainly e/o in lyrics: வா வா -> "vaa vaa", but
  // முன்பே -> "munbe" and போதும் -> "podhum".
  const VOWEL_SIGNS = {
    'ா': 'aa', 'ி': 'i', 'ீ': 'ee', 'ு': 'u', 'ூ': 'oo',
    'ெ': 'e', 'ே': 'e', 'ை': 'ai', 'ொ': 'o', 'ோ': 'o', 'ௌ': 'au',
  };

  const NASALS = new Set(['ங', 'ஞ', 'ண', 'ந', 'ம', 'ன']);
  const HARD = new Set(['க', 'ச', 'ட', 'த', 'ப', 'ற', 'ஜ', 'ஶ', 'ஷ', 'ஸ', 'ஹ']);
  const STOPS = new Set(['க', 'ச', 'ட', 'த', 'ப', 'ற']);

  // How each stop is spelled, by what comes right before it:
  //   start  word start              கண் "kan", சாமி "saami", தமிழ் "thamizh"
  //   vowel  between vowels          முகம் "mugam", பசி "pasi", காதல் "kaadhal"
  //   nasal  after ங் ஞ் ண் ந் ம் ன்   தங்கம் "thangam", நெஞ்சம் "nenjam", அன்பு "anbu"
  //   soft   after ய் ர் ல் ழ் ள் வ்   பெய்திடும் "peidhidum", சொல்கிறதே "solgiradhe"
  //   hard   after another stop      லட்சியம் "latchiyam", முயற்சி "muyarchi"
  //   double the second of a pair    அக்கா "akka", பச்சை "pachai", காற்று "kaatru"
  // ட starts only particles and loanwords (டி "di", டா "da"), so it's "d" there.
  const STOP_SPELLING = {
    'க': { start: 'k', vowel: 'g', nasal: 'g', soft: 'g', hard: 'k', double: 'k' },
    'ச': { start: 's', vowel: 's', nasal: 'j', soft: 's', hard: 'ch', double: 'ch' },
    'ட': { start: 'd', vowel: 'd', nasal: 'd', soft: 'd', hard: 't', double: 't' },
    'த': { start: 'th', vowel: 'dh', nasal: 'dh', soft: 'dh', hard: 'th', double: 'th' },
    'ப': { start: 'p', vowel: 'b', nasal: 'b', soft: 'p', hard: 'p', double: 'p' },
    'ற': { start: 'r', vowel: 'r', nasal: 'dr', soft: 'r', hard: 'r', double: 'r' },
  };

  // The first half of a doubled stop. ச்ச and த்த are written once
  // (பச்சை "pachai", சத்தம் "satham"); ற்ற is "tr" (காற்று "kaatru").
  const DOUBLE_FIRST = { 'க': 'k', 'ச': '', 'ட': 't', 'த': '', 'ப': 'p', 'ற': 't' };

  // Words whose everyday spelling doesn't follow the rules.
  const COMMON = Object.fromEntries(Object.entries({
    'ஏன்': 'yen', 'சின்ன': 'chinna', 'சென்னை': 'chennai', 'ஸ்ரீ': 'sri',
  }).map(([k, v]) => [k.normalize('NFC'), v]));

  const isV = (p) => !!p && p.type === 'V';
  const isC = (p) => !!p && p.type === 'C';

  function toPhonemes(word) {
    const chars = [...word].filter((c) => c !== ZWJ && c !== ZWNJ);
    const ph = [];
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (CONSONANTS[c] !== undefined) {
        const next = chars[i + 1];
        const pulli = next === PULLI;
        ph.push({ type: 'C', ch: c, pulli });
        if (pulli) {
          i++;
        } else if (VOWEL_SIGNS[next] !== undefined) {
          ph.push({ type: 'V', r: VOWEL_SIGNS[next] });
          i++;
        } else {
          // No pulli and no vowel sign: the consonant carries "a" (கண் -> "kan").
          ph.push({ type: 'V', r: 'a' });
        }
      } else if (VOWELS[c] !== undefined) {
        ph.push({ type: 'V', r: VOWELS[c], independent: true });
      } else if (c === AYTHAM) {
        ph.push({ type: 'A' });
      } else if (c === 'ௐ') {
        ph.push({ type: 'V', r: 'o' }, { type: 'C', ch: 'ம', pulli: true });
      }
      // Anything else (stray signs) is dropped.
    }
    return ph;
  }

  // The context a stop sees on its left (see STOP_SPELLING).
  function contextOf(prev, ch) {
    if (!prev) return 'start';
    if (isV(prev)) return 'vowel';
    if (prev.type === 'A') return 'hard';
    if (prev.ch === ch) return 'double';
    if (NASALS.has(prev.ch)) return 'nasal';
    return HARD.has(prev.ch) ? 'hard' : 'soft';
  }

  function renderConsonant(ph, i) {
    const p = ph[i];
    const prev = ph[i - 1];
    const next = ph[i + 1];
    const doubledNext = p.pulli && isC(next) && next.ch === p.ch;

    if (STOPS.has(p.ch)) {
      if (doubledNext) {
        // After another consonant a doubled stop is written once:
        // போர்க்களம் -> "porkalam", வாழ்க்கை -> "vaazhkai".
        return isC(prev) ? '' : DOUBLE_FIRST[p.ch];
      }
      // ஃப is an "f" (ஃபேன் -> "fan").
      if (p.ch === 'ப' && prev && prev.type === 'A') return 'f';
      // A stop with pulli, before another consonant or at the end of the word,
      // is unvoiced: லட்சியம் -> "latchiyam", போகக் கூடாது -> "pogak koodaadhu".
      if (p.pulli) return STOP_SPELLING[p.ch].hard;
      return STOP_SPELLING[p.ch][contextOf(prev, p.ch)];
    }

    // A nasal before its own stop is a plain "n": தங்கம் -> "thangam", நெஞ்சம் -> "nenjam".
    if (p.pulli && isC(next) && ((p.ch === 'ங' && next.ch === 'க') || (p.ch === 'ஞ' && next.ch === 'ச'))) return 'n';
    // ய் after a vowel makes a diphthong: தாய் -> "thaai", பெய்து -> "peidhu", நோய் -> "noi".
    if (p.ch === 'ய' && p.pulli && isV(prev) && /^(a|aa|e|ae|o)$/.test(prev.r)) return 'i';
    return CONSONANTS[p.ch];
  }

  function render(ph) {
    const vowels = ph.filter(isV).length;
    let out = '';
    for (let i = 0; i < ph.length; i++) {
      const p = ph[i];
      if (p.type === 'C') {
        out += renderConsonant(ph, i);
      } else if (p.type === 'A') {
        // Aytham before ப turns it into "f"; elsewhere it's a soft "h" (எஃகு -> "ehku").
        const next = ph[i + 1];
        out += isC(next) && next.ch === 'ப' ? '' : 'h';
      } else {
        let r = p.r;
        // A final long aa/ee is said short in longer words: கண்ணா -> "kanna",
        // தோழி -> "thozhi"; one-syllable words keep it: வா -> "vaa", நீ -> "nee".
        if (i === ph.length - 1 && vowels > 1) r = { aa: 'a', ee: 'i' }[r] || r;
        out += r;
      }
    }
    return out;
  }

  function romaniseWord(word) {
    const key = word.normalize('NFC');
    if (COMMON[key]) return COMMON[key];
    return render(toPhonemes(key));
  }

  L.registerScript({
    code: 'ta',
    name: 'Tamil',
    symbol: 'அ',
    test: /[஀-௿]/,
    // Letters, vowel signs, pulli and ௐ; not digits (௦-௯) or number signs.
    words: /[ஂ-ௗ\u200C\u200D]+/g,
    word: romaniseWord,
    digits: '௦௧௨௩௪௫௬௭௮௯',
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { romaniseWord };
})(globalThis);
