// Bengali (Bangla script) romanisation for Lyricly. Loads after translit.js and registers itself.
//
// Bangla is laid out like Devanagari, but it is read differently from Hindi,
// so it has its own small pipeline:
//   - The inherent vowel is "o": মন → "mon", জল → "jol", কথা → "kotha".
//   - It is usually silent at the end of a word, but kept after a cluster
//     (স্বপ্ন → "shopno", জন্য → "jonno"), after হ (দেহ → "deho"), and in a few
//     verb/pronoun endings (কত → "koto", যাব → "jabo", দেখেছ → "dekhechho").
//   - Inside a word it is kept (জীবনে → "jibone", নীরবে → "nirobe") except
//     before common verb/suffix syllables, where it is dropped (করতে → "korte",
//     আমরা → "amra", একলা → "ekla").
//   - Vowel length isn't marked in casual spelling: আমি → "ami", নীল → "nil".
//   - য is "j" (যদি → "jodi"), য় is "y", ব is "b", শ/ষ are "sh", স is "s".
// Assamese uses the same block; its ৰ and ৱ are read as "r" and "w".
(function (root) {
  'use strict';

  const L = root.Lyricly;

  const VIRAMA = '্';
  const NUKTA = '়';
  const ANUSVARA = 'ং';
  const CHANDRABINDU = 'ঁ';
  const VISARGA = 'ঃ';
  const KHANDA_TA = 'ৎ';
  const ZWJ = '\u200D';
  const ZWNJ = '\u200C';

  const CONSONANTS = {
    'ক': 'k', 'খ': 'kh', 'গ': 'g', 'ঘ': 'gh', 'ঙ': 'ng',
    'চ': 'ch', 'ছ': 'chh', 'জ': 'j', 'ঝ': 'jh', 'ঞ': 'n',
    'ট': 't', 'ঠ': 'th', 'ড': 'd', 'ঢ': 'dh', 'ণ': 'n',
    'ত': 't', 'থ': 'th', 'দ': 'd', 'ধ': 'dh', 'ন': 'n',
    'প': 'p', 'ফ': 'ph', 'ব': 'b', 'ভ': 'bh', 'ম': 'm',
    'য': 'j', 'র': 'r', 'ল': 'l', 'শ': 'sh', 'ষ': 'sh', 'স': 's', 'হ': 'h',
    'ৰ': 'r', 'ৱ': 'w', // Assamese
  };

  // ড় ঢ় য় don't survive NFC: they are stored as ড/ঢ/য + nukta.
  // বাড়ি → "bari", আষাঢ় → "asharh", হয় → "hoy".
  const NUKTA_CONSONANTS = { 'ড': 'r', 'ঢ': 'rh', 'য': 'y' };

  const VOWELS = {
    'অ': 'o', 'আ': 'a', 'ই': 'i', 'ঈ': 'i', 'উ': 'u', 'ঊ': 'u',
    'ঋ': 'ri', 'ৠ': 'ri', 'ঌ': 'li', 'ৡ': 'li', 'এ': 'e', 'ঐ': 'oi', 'ও': 'o', 'ঔ': 'ou',
  };

  const MATRAS = {
    'া': 'a', 'ি': 'i', 'ী': 'i', 'ু': 'u', 'ূ': 'u', 'ৃ': 'ri', 'ৄ': 'ri',
    'ৢ': 'li', 'ৣ': 'li', 'ে': 'e', 'ৈ': 'oi', 'ো': 'o', 'ৌ': 'ou',
  };

  // Words people spell by convention rather than by rule.
  const COMMON = L.indic.normalizeKeys({
    // Final o that the spelling doesn't show.
    'কেন': 'keno', 'যেন': 'jeno', 'ভাল': 'bhalo', 'বড়': 'boro', 'ছোট': 'chhoto',
    'ছিল': 'chhilo', 'হল': 'holo', 'গেল': 'gelo', 'এল': 'elo', 'দিল': 'dilo',
    'নিল': 'nilo', 'পেল': 'pelo', 'বলল': 'bollo', 'করল': 'korlo', 'চলল': 'chollo',
    // Noun + -e that looks like a verb in -te.
    'জগতে': 'jogote', 'জগত': 'jogot', 'আজব': 'ajob',
    // Future -bo after a bare consonant (but সব → "sob").
    'কব': 'kobo', 'হব': 'hobo',
  });

  // Words starting with these stems are compounds, so the stem's o drops:
  // একদিন → "ekdin", আজকে → "ajke", সবকিছু → "sobkichhu".
  const STEMS = ['এক', 'আজ', 'সব'];

  // Signs of a Sanskrit-style (tatsama) word, which keeps every medial o:
  // জীবনে → "jibone", চরণতলে → "choronotole", বজ্রানলে → "bojranole".
  const TATSAMA = /[ীূৃৄণষঈঊঋঃ্]/;

  // ব written under these is "w" (বিশ্বাস → "biswas", জ্বালা → "jwala");
  // under ম র ল ন ব it is a plain "b" (অম্বর → "ombor", সর্ব → "sorbo").
  const BA_PHALA_HOSTS = new Set([...'কখগঘচজটডতথদধশষসহ']);

  const isV = (p) => !!p && p.type === 'V';
  const isC = (p) => !!p && p.type === 'C';

  // Word → list of sounds: { type: 'C' | 'V' | 'N', r, ch, ... }.
  function toSounds(word) {
    const chars = [...word].filter((c) => c !== ZWJ && c !== ZWNJ);
    const out = [];
    let joined = false; // the previous consonant ended in a virama
    for (let i = 0; i < chars.length; i++) {
      const c = chars[i];
      if (CONSONANTS[c] !== undefined) {
        let r = CONSONANTS[c];
        let ch = c;
        if (chars[i + 1] === NUKTA) {
          r = NUKTA_CONSONANTS[c] || r;
          ch = c + NUKTA;
          i++;
        }
        out.push({ type: 'C', r, ch, joined });
        joined = false;
        const next = chars[i + 1];
        if (next === VIRAMA) {
          joined = CONSONANTS[chars[i + 2]] !== undefined;
          i++;
        } else if (MATRAS[next] !== undefined) {
          out.push({ type: 'V', r: MATRAS[next], ch: next });
          i++;
        } else {
          out.push({ type: 'V', r: 'o', inherent: true });
        }
        continue;
      }
      joined = false;
      if (VOWELS[c] !== undefined) {
        out.push({ type: 'V', r: VOWELS[c], ch: c, independent: true });
      } else if (c === KHANDA_TA) {
        // ৎ is a t with no vowel: জগৎ → "jogot", হঠাৎ → "hothat".
        out.push({ type: 'C', r: 't', ch: c });
      } else if (c === VISARGA) {
        out.push({ type: 'C', r: 'h', ch: c });
      } else if (c === ANUSVARA || c === CHANDRABINDU) {
        out.push({ type: 'N', ch: c });
      }
      // Avagraha, stray signs and nuktas are dropped.
    }
    return joinClusters(out);
  }

  // Bangla reads several conjuncts differently from their letters.
  function joinClusters(s) {
    for (let i = 0; i < s.length; i++) {
      const p = s[i];
      if (!isC(p) || !p.joined) continue;
      const prev = s[i - 1];
      const initial = !s[i - 2]; // the cluster opens the word
      if (prev.ch === 'ক' && p.ch === 'ষ') {
        // ক্ষ is "kh", doubled inside a word: ক্ষমা → "khoma", রক্ষা → "rokkha".
        s.splice(i - 1, 2, { type: 'C', r: initial ? 'kh' : 'kkh', ch: 'ক্ষ', joined: prev.joined });
        i--;
      } else if (prev.ch === 'জ' && p.ch === 'ঞ') {
        // জ্ঞ is "gy" at the start, "gg" inside: জ্ঞান → "gyan", বিজ্ঞান → "biggan".
        s.splice(i - 1, 2, { type: 'C', r: initial ? 'gy' : 'gg', ch: 'জ্ঞ', joined: prev.joined });
        i--;
      } else if (p.ch === 'য' && prev.ch !== 'র') {
        // য-ফলা glides at the start (ব্যথা → "byatha"); inside a word it doubles
        // the consonant, keeping the y only before া: বিদ্যা → "biddya",
        // জন্য → "jonno", সত্যি → "sotti". After reph it is a real "j": সূর্য → "surjo".
        const next = s[i + 1];
        p.r = initial || (next && next.ch === 'া') ? 'y' : '';
        if (!initial && !prev.joined && prev.ch !== 'হ') prev.r = double(prev.r);
        // At the start its inherent vowel is an open "a": ব্যস্ত → "byasto".
        if (initial && next && next.inherent) next.r = 'a';
      } else if (p.ch === 'ব' && BA_PHALA_HOSTS.has(prev.ch)) {
        // স্ব/শ্ব at the start of a word is just "sh": স্বপ্ন → "shopno", স্বামী → "shami".
        if (initial && (prev.ch === 'স' || prev.ch === 'শ')) {
          prev.r = 'sh';
          p.r = '';
        } else {
          p.r = 'w';
        }
      }
    }
    return s;
  }

  // Double a consonant's sound: d → dd, th → tth, chh → cchh.
  const double = (r) => (r ? r[0] + r : r);

  // Index of the stem-final o in a compound like একদিন, or -1.
  function stemBreak(word, s) {
    const stem = STEMS.find((st) => word.startsWith(st));
    if (!stem) return -1;
    // The o after the stem's last consonant.
    let consonants = [...stem].filter((c) => CONSONANTS[c] !== undefined).length;
    const i = s.findIndex((p) => isC(p) && --consonants === 0) + 1;
    if (!s[i] || !s[i].inherent) return -1;
    // Only when more of the word follows: আজব is "ajob", not "ajbo".
    return isC(s[i + 1]) && s[i + 2] && !(s[i + 2].inherent && i + 3 === s.length) ? i : -1;
  }

  // Should the medial o at s[i] (in V C _ C V) be dropped? Only before syllables
  // that start common verb endings and suffixes:
  //   -te/-to (করতে "korte", হয়ত "hoyto"), -la/-le/-lam (একলা "ekla", করলাম "korlam"),
  //   -chhi/-chhe (করছি "korchhi"), -bo/-be (করবে "korbe", দেখব "dekhbo"),
  //   -ta/-ti/-tu (একটু "ektu"), -ra (আমরা "amra").
  function dropsMedial(s, i) {
    const c = s[i + 1];
    const v = s[i + 2];
    const last = i + 3 === s.length;
    // Before the genitive -er the consonant belongs to the stem: পাগলের → "pagoler".
    const genitive = v.ch === 'ে' && i + 5 === s.length && s[i + 3].ch === 'র' && s[i + 4].inherent;
    if (v.inherent) {
      // Final -bo/-to verbs: করব → "korbo", বলত → "bolto" (but ভারত → "bharot").
      if (!last) return false;
      return c.ch === 'ব' || (c.ch === 'ত' && s[i - 2].inherent);
    }
    if (genitive) return false;
    if (c.ch === 'র') return v.ch === 'া';
    return c.ch === 'ত' || c.ch === 'ল' || c.ch === 'ছ' || c.ch === 'ব' || c.ch === 'ট';
  }

  // য় closes its syllable before another one: আয়রে → "ayre",
  // হৃদয়মাঝে → "hridoymajhe" (but নয়নে → "noyone", নয়ন → "noyon").
  const afterGlide = (s, i) => s[i - 1].ch === 'য' + NUKTA && !s[i + 2].inherent && s[i + 1].ch !== 'ন';

  function dropSilentVowels(word, s) {
    const tatsama = TATSAMA.test(word);
    const brk = stemBreak(word, s);
    if (brk > 0) s.splice(brk, 1);

    // Medial o, right to left: V C [o] C V.
    for (let i = s.length - 2; i >= 2; i--) {
      const p = s[i];
      if (p.inherent && isC(s[i - 1]) && isV(s[i - 2]) && isC(s[i + 1]) && isV(s[i + 2])
        && ((!tatsama && dropsMedial(s, i)) || afterGlide(s, i))) {
        s.splice(i, 1);
      }
    }

    // The emphatic -i and "also" -o join the last consonant: তোমারই → "tomari",
    // আজও → "ajo" (but বই → "boi").
    const n0 = s.length;
    if (n0 > 3 && s[n0 - 2].inherent && /^[ইও]$/.test(s[n0 - 1].ch) && s.filter(isV).length > 2) {
      s.splice(n0 - 2, 1);
    }

    // Final o.
    const n = s.length;
    const last = s[n - 1];
    if (last && last.inherent && s.filter(isV).length > 1 && !keepsFinal(s)) s.pop();
    return s;
  }

  function keepsFinal(s) {
    const n = s.length;
    const c = s[n - 2];
    const before = s[n - 3];
    // After a cluster or ং: সত্য → "sotto", বন্ধ → "bondho", দুঃখ → "dukkho", অংশ → "ongsho".
    if (isC(before) || (before && before.ch === ANUSVARA)) return true;
    // After হ: দেহ → "deho", স্নেহ → "sneho", কেহ → "keho".
    if (c.ch === 'হ') return true;
    if (!isV(before)) return false;
    const twoSyllables = s.filter(isV).length === 2;
    // কত → "koto", যত → "joto", এত → "eto", যেত → "jeto" (but রাত → "rat", শীত → "shit").
    if (c.ch === 'ত') return twoSyllables && (before.inherent || /^[ইএওিেো]$/.test(before.ch));
    // Future -bo: যাব → "jabo", দেব → "debo", করিব → "koribo" (but সব → "sob").
    if (c.ch === 'ব') return /^[েিো]$/.test(before.ch) || (before.ch === 'া' && twoSyllables);
    // Past -chho: দেখেছ → "dekhechho", গেছ → "gechho".
    if (c.ch === 'ছ') return before.ch === 'ে';
    // প্রিয় → "priyo", তৃতীয় → "tritiyo" (but হয় → "hoy", যায় → "jay").
    if (c.ch === 'য' + NUKTA) return before.ch === 'ি' || before.ch === 'ী';
    return false;
  }

  function render(s) {
    let out = '';
    for (let i = 0; i < s.length; i++) {
      const p = s[i];
      const next = s[i + 1];
      if (p.type === 'N') {
        if (p.ch === ANUSVARA) out += 'ng'; // বাংলা → "bangla", রং → "rong"
        // ঁ is an "n" before a stop (চাঁদ → "chand", বাঁশি → "banshi"), silent
        // elsewhere (ছুঁয়ে → "chhuye", মাঁ → "ma").
        else if (isC(next) && !/^(y|r|l|h|w)$/.test(next.r)) out += 'n';
      } else if (p.ch === VISARGA) {
        // ঃ doubles the next consonant: দুঃখ → "dukkho"; "h" at the end.
        out += isC(next) ? next.r[0] || '' : 'h';
      } else if (p.ch === 'ঙ' && isC(next) && /^(k|g)/.test(next.r)) {
        out += 'n'; // সঙ্গে → "shonge", অঙ্ক → "onko"
      } else {
        out += p.r;
      }
    }
    return out
      .replace(/chchh/g, 'cch') // ইচ্ছে → "icche"
      .replace(/^(bhalob[ae])s/, '$1sh'); // ভালোবাসি → "bhalobashi"
  }

  function romaniseWord(word) {
    // ভালবাসা is said (and usually romanised) with the o of ভালো.
    const key = word.normalize('NFC').replace(/^ভাল(?=ব[ােি])/, 'ভালো');
    if (COMMON[key]) return COMMON[key];
    const s = toSounds(key);
    if (!s.length) return '';
    return render(dropSilentVowels(key, s));
  }

  L.registerScript({
    code: 'bn',
    name: 'Bengali',
    symbol: 'অ',
    test: /[ঀ-৿]/,
    // A run of letters/signs (not digits or the shared danda), starting with a letter.
    words: /[ঀ-ৣৰৱৼ৾][ঀ-ৣৰৱৼ৾\u200C\u200D]*/g,
    word: romaniseWord,
    digits: '০১২৩৪৫৬৭৮৯',
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { romaniseWord };
})(globalThis);
