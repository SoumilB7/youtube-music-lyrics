// Korean (Hangul) romanisation for Lyricly, Revised Romanization. Loads after translit.js and registers itself.
//
// Per word:
//   1. Split each precomposed syllable (U+AC00-U+D7A3) into initial, vowel
//      and final jamo arithmetically: 19 initials x 21 vowels x 28 finals.
//   2. Walk the syllable boundaries and apply the sound changes that make a
//      romanisation readable as sung: liaison (사랑을 → "sarangeul"),
//      ㅎ-aspiration (좋다 → "jota"), nasalisation (합니다 → "hamnida"),
//      ㄹ-assimilation (신라 → "silla").
//   3. Render with the Revised Romanization tables: ㄱㄷㅂ are g/d/b before a
//      vowel and k/t/p at the end of a syllable.
// Loose jamo (ㅋㅋ, ㅠㅠ) are romanised one by one; Hanja is left alone.
(function (root) {
  'use strict';

  const L = root.Lyricly;

  const INITIALS = 'ㄱㄲㄴㄷㄸㄹㅁㅂㅃㅅㅆㅇㅈㅉㅊㅋㅌㅍㅎ';
  const VOWELS = 'ㅏㅐㅑㅒㅓㅔㅕㅖㅗㅘㅙㅚㅛㅜㅝㅞㅟㅠㅡㅢㅣ';
  const FINALS = ['', ...'ㄱㄲㄳㄴㄵㄶㄷㄹㄺㄻㄼㄽㄾㄿㅀㅁㅂㅄㅅㅆㅇㅈㅊㅋㅌㅍㅎ'];

  const ONSET = {
    'ㄱ': 'g', 'ㄲ': 'kk', 'ㄴ': 'n', 'ㄷ': 'd', 'ㄸ': 'tt', 'ㄹ': 'r', 'ㅁ': 'm',
    'ㅂ': 'b', 'ㅃ': 'pp', 'ㅅ': 's', 'ㅆ': 'ss', 'ㅇ': '', 'ㅈ': 'j', 'ㅉ': 'jj',
    'ㅊ': 'ch', 'ㅋ': 'k', 'ㅌ': 't', 'ㅍ': 'p', 'ㅎ': 'h',
  };

  const VOWEL = {
    'ㅏ': 'a', 'ㅐ': 'ae', 'ㅑ': 'ya', 'ㅒ': 'yae', 'ㅓ': 'eo', 'ㅔ': 'e', 'ㅕ': 'yeo',
    'ㅖ': 'ye', 'ㅗ': 'o', 'ㅘ': 'wa', 'ㅙ': 'wae', 'ㅚ': 'oe', 'ㅛ': 'yo', 'ㅜ': 'u',
    'ㅝ': 'wo', 'ㅞ': 'we', 'ㅟ': 'wi', 'ㅠ': 'yu', 'ㅡ': 'eu', 'ㅢ': 'ui', 'ㅣ': 'i',
    'ㆍ': 'a', 'ㆎ': 'ae', // archaic arae-a, still seen in stylised titles
  };

  // A final can only sound as one of seven consonants: 꽃 → "kkot", 밖 → "bak".
  const NEUTRAL = {
    'ㄱ': 'ㄱ', 'ㄲ': 'ㄱ', 'ㅋ': 'ㄱ',
    'ㄷ': 'ㄷ', 'ㅅ': 'ㄷ', 'ㅆ': 'ㄷ', 'ㅈ': 'ㄷ', 'ㅊ': 'ㄷ', 'ㅌ': 'ㄷ', 'ㅎ': 'ㄷ',
    'ㅂ': 'ㅂ', 'ㅍ': 'ㅂ',
    'ㄴ': 'ㄴ', 'ㄹ': 'ㄹ', 'ㅁ': 'ㅁ', 'ㅇ': 'ㅇ',
  };
  const CODA = { 'ㄱ': 'k', 'ㄷ': 't', 'ㅂ': 'p', 'ㄴ': 'n', 'ㄹ': 'l', 'ㅁ': 'm', 'ㅇ': 'ng' };

  // Double finals: both halves surface before a vowel (없어 → "eopseo"),
  // only the kept one before a consonant or at the end (닭 → "dak", 여덟 → "yeodeol").
  const CLUSTER = {
    'ㄳ': ['ㄱ', 'ㅅ', 'ㄱ'], 'ㄵ': ['ㄴ', 'ㅈ', 'ㄴ'], 'ㄶ': ['ㄴ', 'ㅎ', 'ㄴ'],
    'ㄺ': ['ㄹ', 'ㄱ', 'ㄱ'], 'ㄻ': ['ㄹ', 'ㅁ', 'ㅁ'], 'ㄼ': ['ㄹ', 'ㅂ', 'ㄹ'],
    'ㄽ': ['ㄹ', 'ㅅ', 'ㄹ'], 'ㄾ': ['ㄹ', 'ㅌ', 'ㄹ'], 'ㄿ': ['ㄹ', 'ㅍ', 'ㅂ'],
    'ㅀ': ['ㄹ', 'ㅎ', 'ㄹ'], 'ㅄ': ['ㅂ', 'ㅅ', 'ㅂ'],
  };

  // ㅎ next to a plain stop makes it aspirated: 축하 → "chuka", 좋다 → "jota".
  const ASPIRATED = {
    'ㄱ': 'ㅋ', 'ㄲ': 'ㅋ', 'ㅋ': 'ㅋ', 'ㄷ': 'ㅌ', 'ㅅ': 'ㅌ', 'ㅆ': 'ㅌ', 'ㅌ': 'ㅌ',
    'ㅈ': 'ㅊ', 'ㅊ': 'ㅊ', 'ㅂ': 'ㅍ', 'ㅍ': 'ㅍ',
  };

  // Nasalisation of a neutralised final before ㄴ/ㅁ: 국물 → "gungmul",
  // 있는 → "inneun", 합니다 → "hamnida".
  const NASAL = { 'ㄱ': 'ㅇ', 'ㄷ': 'ㄴ', 'ㅂ': 'ㅁ' };

  // ---- Decomposition ----

  const SBASE = 0xac00;
  const SLAST = 0xd7a3;

  function decompose(ch) {
    const n = ch.codePointAt(0) - SBASE;
    return { on: INITIALS[Math.floor(n / 588)], v: VOWELS[Math.floor(n / 28) % 21], co: FINALS[n % 28] };
  }

  // Conjoining jamo (U+1100-U+11FF) left over after NFC → compatibility jamo.
  function compatJamo(ch) {
    const cp = ch.codePointAt(0);
    if (cp >= 0x1100 && cp <= 0x1112) return INITIALS[cp - 0x1100];
    if (cp >= 0x1161 && cp <= 0x1175) return VOWELS[cp - 0x1161];
    if (cp >= 0x11a8 && cp <= 0x11c2) return FINALS[cp - 0x11a7];
    return ch;
  }

  // ---- Sound changes at one syllable boundary (prev final, next initial) ----

  function joinSyllables(a, b) {
    const c = a.co;
    if (!c) return;
    const [keep, second] = CLUSTER[c] || [c];
    const last = second || c;

    // Liaison: a final moves into a following empty ㅇ.
    // 있어 → "isseo", 없어 → "eopseo", 좋아 → "joa" (ㅎ goes silent), 사랑을 keeps its ng.
    if (b.on === 'ㅇ') {
      if (c === 'ㅇ') return;
      if (last === 'ㅎ') {
        // ㄶ/ㅀ lose the ㅎ and the other half moves on: 싫어 → "sireo", 많아 → "mana".
        a.co = '';
        if (second) b.on = keep;
        return;
      }
      a.co = second ? keep : '';
      b.on = last;
      // Palatalisation: 같이 → "gachi", 굳이 → "guji".
      if (b.v === 'ㅣ' && (b.on === 'ㄷ' || b.on === 'ㅌ')) b.on = b.on === 'ㄷ' ? 'ㅈ' : 'ㅊ';
      return;
    }

    // ㅎ final before a consonant: 좋다 → "jota", 않고 → "anko", 좋습니다 → "josseumnida".
    if (last === 'ㅎ') {
      a.co = second ? keep : '';
      if (ASPIRATED[b.on] && b.on !== 'ㅅ') b.on = ASPIRATED[b.on];
      else if (b.on === 'ㅅ') b.on = 'ㅆ';
      else if (b.on === 'ㄴ' && !a.co) a.co = 'ㄴ'; // 좋네 → "jonne"
    } else if (b.on === 'ㅎ' && ASPIRATED[last]) {
      // Stop final before ㅎ: 축하 → "chuka", 밝히다 → "balkida", 닫히다 → "dachida".
      a.co = second ? keep : '';
      b.on = ASPIRATED[last];
      if (b.on === 'ㅌ' && b.v === 'ㅣ') b.on = 'ㅊ';
    } else {
      // Double final before a consonant keeps one half; ㄺ keeps ㄹ before ㄱ (맑게 → "malkke").
      a.co = second ? (c === 'ㄺ' && b.on === 'ㄱ' ? 'ㄹ' : CLUSTER[c][2]) : c;
    }

    if (!a.co) return;
    a.co = NEUTRAL[a.co];

    // ㄹ after any final but ㄴ/ㄹ is said as ㄴ: 심리 → "simni", 국립 → "gungnip".
    if (b.on === 'ㄹ' && a.co !== 'ㄴ' && a.co !== 'ㄹ') b.on = 'ㄴ';
    // ㄴ next to ㄹ becomes ㄹ: 신라 → "silla", 설날 → "seollal".
    if (a.co === 'ㄴ' && b.on === 'ㄹ') a.co = 'ㄹ';
    if (a.co === 'ㄹ' && b.on === 'ㄴ') b.on = 'ㄹ';
    if ((b.on === 'ㄴ' || b.on === 'ㅁ') && NASAL[a.co]) a.co = NASAL[a.co];
  }

  // ---- Rendering ----

  function renderSyllables(syl) {
    for (let i = 0; i + 1 < syl.length; i++) joinSyllables(syl[i], syl[i + 1]);
    let out = '';
    syl.forEach((s, i) => {
      // ㄹ after a ㄹ final is "l": 몰라 → "molla", not "molra".
      const prevL = i > 0 && syl[i - 1].co === 'ㄹ';
      out += (s.on === 'ㄹ' && prevL ? 'l' : ONSET[s.on]) + VOWEL[s.v];
      if (s.co) {
        const [, , kept] = CLUSTER[s.co] || [null, null, s.co];
        out += CODA[NEUTRAL[kept]];
      }
    });
    return out;
  }

  // A loose jamo on its own: ㅋㅋ → "kk", ㅠㅠ → "yuyu", ㅇㅇ → "ngng".
  function renderJamo(j) {
    if (VOWEL[j]) return VOWEL[j];
    if (j === 'ㅇ') return 'ng';
    if (j === 'ㄹ') return 'l';
    if (CLUSTER[j]) return CLUSTER[j].slice(0, 2).map(renderJamo).join('');
    return ONSET[j] !== undefined ? ONSET[j] : ''; // archaic jamo: drop
  }

  function romaniseWord(word) {
    let out = '';
    let run = [];
    const flush = () => {
      if (run.length) out += renderSyllables(run);
      run = [];
    };
    for (const ch of word.normalize('NFC')) {
      const cp = ch.codePointAt(0);
      if (cp >= SBASE && cp <= SLAST) {
        run.push(decompose(ch));
      } else {
        flush();
        out += renderJamo(compatJamo(ch));
      }
    }
    flush();
    return out;
  }

  L.registerScript({
    code: 'ko', name: 'Korean', symbol: '한',
    test: /[가-힣ᄀ-ᇿㄱ-ㆎ]/,
    words: /[가-힣ᄀ-ᇿㄱ-ㆎ]+/g,
    word: romaniseWord,
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { romaniseWord };
})(globalThis);
