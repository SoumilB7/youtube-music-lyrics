// Gujarati romanisation for Lyricly. Loads after translit.js and registers itself.
//
// Gujarati's Unicode block mirrors Devanagari's letter for letter
// (U+0A95 ક ↔ U+0915 क, and so on) and its schwa deletion works like Hindi's
// (રમત → "ramat", મળવા → "malva"), so a word is mapped onto Devanagari and run
// through the Hindi phoneme and schwa rules. Only the final spelling differs:
// Gujarati lyrics are written with short vowels ("Mara ghat ma birajta",
// "Chogada tara") and without the trailing nasal (હું → "hu", માં → "ma").
(function (root) {
  'use strict';

  const L = root.Lyricly;
  const { toPhonemes, deleteSchwas, render, normalizeKeys } = L.indic;

  // Words people spell by convention rather than by rule.
  const COMMON = normalizeKeys({
    'છે': 'che', 'છો': 'cho', 'છું': 'chu', 'હું': 'hu', 'તું': 'tu', 'શું': 'shu',
    'કેમ': 'kem', 'અને': 'ane', 'ને': 'ne', 'નથી': 'nathi', 'નહીં': 'nahi', 'નઈ': 'nai',
    'મારું': 'maru', 'તારું': 'taru', 'મારુ': 'maru', 'તારુ': 'taru',
    // કહે- is said "keh-": કહેવું → "kehvu", કહેવાય → "kehvay".
    'કહેવું': 'kehvu', 'કહેવાય': 'kehvay', 'કહે': 'kahe',
    'વ્હાલ': 'vhal', 'વ્હાલમ': 'vhalam', 'વાલમ': 'valam',
    // Sanskrit and Urdu words with a conventional spelling.
    'કૃષ્ણ': 'krishna', 'ગઝલ': 'gazal',
  });

  // Gujarati sits 0x180 above Devanagari. Letters with no twin (ૹ, the
  // U+0AFA–0AFF Arabic-style signs) are dropped.
  function toDevanagari(word) {
    let out = '';
    for (const c of word) {
      const cp = c.codePointAt(0);
      if (cp >= 0x0a81 && cp <= 0x0ae3) out += String.fromCodePoint(cp - 0x180);
      else if (c === '\u200C' || c === '\u200D') out += c;
    }
    return out;
  }

  // The Hindi rule only drops a schwa after a plain vowel (V C a C V). After a
  // nasalised vowel it goes too: ચાંદની → "chandni", કંસની → "kansni".
  function deleteSchwasAfterNasal(ph) {
    for (let i = ph.length - 2; i >= 3; i--) {
      const p = ph[i];
      if (p.schwa && ph[i - 1].type === 'C' && ph[i - 2].type === 'N' && ph[i - 3].type === 'V'
        && ph[i + 1].type === 'C' && ph[i + 2] && ph[i + 2].type === 'V') {
        ph.splice(i, 1);
      }
    }
    return ph;
  }

  // Vowel signs are written short: મારા → "mara", ગીત → "git", ફૂલ → "ful".
  // Only a word-initial આ keeps its "aa", as in આવો → "aavo", આંખ → "aankh".
  const SHORT = { aa: 'a', ee: 'i', oo: 'u' };

  function shorten(ph) {
    ph.forEach((p, i) => {
      if (p.type !== 'V' || !SHORT[p.r]) return;
      if (p.independent && i === 0 && p.r === 'aa') return;
      p.r = SHORT[p.r];
    });
  }

  // Anusvara is spoken before a consonant (રંગ → "rang", અંબર → "ambar") but
  // casual spelling leaves it out after a vowel at the end or before another
  // vowel: હું → "hu", માં → "ma", કંઈ → "kai".
  function dropBareNasals(ph) {
    return ph.filter((p, i) => p.type !== 'N' || (ph[i + 1] && ph[i + 1].type === 'C'));
  }

  // Two consonants are said differently from Hindi:
  //  - ફ is "f": ફૂલ → "ful", વફાદાર → "vafadar".
  //  - વ stays "v" everywhere (આવો → "aavo", હવે → "have"); the Hindi renderer
  //    would make it "w" between vowels, so it is given a different tag.
  function gujaratiConsonants(ph) {
    for (const p of ph) {
      if (p.ch === 'फ') p.r = 'f';
      if (p.ch === 'व') p.ch = 'v';
    }
    return ph;
  }

  function romaniseWord(word) {
    const key = word.normalize('NFC');
    if (COMMON[key]) return COMMON[key];
    const { ph, hasNukta } = toPhonemes(toDevanagari(key));
    if (!ph.length) return '';
    const kept = deleteSchwasAfterNasal(deleteSchwas(ph, hasNukta));
    shorten(kept);
    return render(gujaratiConsonants(dropBareNasals(kept)))
      // છ is written "ch" like ચ: છોગાળા → "chogala", કેમ છો → "kem cho".
      .replace(/chh/g, 'ch')
      // and a doubled ch as "cch": અચ્છો → "accho", બચ્ચું → "bacchu".
      .replace(/chch/g, 'cch');
  }

  L.registerScript({
    code: 'gu',
    name: 'Gujarati',
    symbol: 'અ',
    test: /[઀-૿]/,
    // Letters, vowel signs, virama, nukta and nasal signs (not digits or ૰).
    words: /[ઁ-ૣૹ-૿\u200C\u200D]+/g,
    word: romaniseWord,
    digits: '૦૧૨૩૪૫૬૭૮૯',
  });

  if (typeof module !== 'undefined' && module.exports) module.exports = { romaniseWord };
})(globalThis);
