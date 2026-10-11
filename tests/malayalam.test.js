const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/translit.js');
const { romaniseWord: w } = require('../src/scripts/malayalam.js');
const { transliterateLine, scriptOf, scriptInfo } = require('../src/translit.js');

test('inherent a is kept (no schwa deletion)', () => {
  assert.equal(w('മനം'), 'manam');
  assert.equal(w('മലരേ'), 'malare');
  assert.equal(w('കടലാകും'), 'kadalaakum');
  assert.equal(w('നടന്ന'), 'nadanna');
});

test('final chandrakkala is a short u', () => {
  assert.equal(w('മനസ്സ്'), 'manassu');
  assert.equal(w('കാറ്റ്'), 'kaattu');
  assert.equal(w('നിന്ന്'), 'ninnu');
  assert.equal(w('ഉണ്ട്'), 'undu');
  assert.equal(w('കാറ്റു്'), 'kaattu'); // old ു് spelling
  assert.equal(w('ആയ്'), 'aay'); // യ് stays y
});

test('chillus, atomic and ZWJ forms alike', () => {
  assert.equal(w('അവൻ'), 'avan');
  assert.equal(w('അവന്‍'), 'avan');
  assert.equal(w('കടൽ'), 'kadal');
  assert.equal(w('കടല്‍'), 'kadal');
  assert.equal(w('നാളുകൾ'), 'naalukal');
  assert.equal(w('നാളുകള്‍'), 'naalukal');
  assert.equal(w('അവർ'), 'avar');
  assert.equal(w('കണ്‍'), w('കൺ'));
  // Bare final ് after a vowel on ന ര ല ള is an old chillu spelling.
  assert.equal(w('തെന്നല്'), 'thennal');
});

test('ന്റ is nt, റ്റ is tt, single റ is r', () => {
  assert.equal(w('എന്റെ'), 'ente');
  assert.equal(w('നിന്റെ'), 'ninte');
  assert.equal(w('എൻ്റെ'), 'ente'); // typed as chillu + ് + റ
  assert.equal(w('ചിറക്'), 'chiraku');
});

test('ഴ, ള, ണ, ഞ', () => {
  assert.equal(w('മഴ'), 'mazha');
  assert.equal(w('കോഴിക്കോട്'), 'kozhikkodu');
  assert.equal(w('നിള'), 'nila');
  assert.equal(w('കണ്ണ്'), 'kannu');
  assert.equal(w('ഞാൻ'), 'njan');
  assert.equal(w('ഞാന്‍'), 'njan');
});

test('ങ്ങ and ഞ്ഞ are written once; nasal clusters', () => {
  assert.equal(w('കാലങ്ങൾ'), 'kaalangal');
  assert.equal(w('മഞ്ഞ്'), 'manju');
  assert.equal(w('അലഞ്ഞു'), 'alanju');
  assert.equal(w('നെഞ്ചിൽ'), 'nenchil');
  assert.equal(w('ചന്ദ്രൻ'), 'chandran');
});

test('anusvara', () => {
  assert.equal(w('എന്നും'), 'ennum');
  assert.equal(w('അംശം'), 'amsham');
  assert.equal(w('സംഗീതം'), 'sangeetham');
  assert.equal(w('ജീവാംശമായ്'), 'jeevaamshamaay');
});

test('vowels: long aa/ee/oo, e/o, ai/au, final long vowels shortened', () => {
  assert.equal(w('ആരോമലേ'), 'aaromale');
  assert.equal(w('ഈറൻ'), 'eeran');
  assert.equal(w('പൂക്കൾ'), 'pookkal');
  assert.equal(w('ഓരോ'), 'oro');
  assert.equal(w('ഐശ്വര്യം'), 'aishwaryam');
  assert.equal(w('വന്നൂ'), 'vannu');
  assert.equal(w('കാണാ'), 'kaana');
  assert.equal(w('നീ'), 'nee');
  assert.equal(w('ഹൃദയം'), 'hrudayam');
});

test('doubled consonants', () => {
  assert.equal(w('പൂക്കൾ'), 'pookkal');
  assert.equal(w('മെല്ലെ'), 'melle');
  assert.equal(w('അമ്മ'), 'amma');
  assert.equal(w('മുത്തേ'), 'muthe'); // ത്ത is written once
  assert.equal(w('ഒളിച്ച'), 'olicha');
  assert.equal(w('കേട്ടു'), 'kettu');
});

test('ട is d between vowels, t elsewhere; വ is w after a consonant', () => {
  assert.equal(w('വീട്'), 'veedu');
  assert.equal(w('തേടി'), 'thedi');
  assert.equal(w('ഇഷ്ടം'), 'ishtam');
  assert.equal(w('സ്വപ്നം'), 'swapnam');
});

test('decomposed and composed vowel signs give the same result', () => {
  assert.equal(w('\u0D15\u0D4A\u0D1E\u0D4D\u0D1A\u0D3F'), 'konchi'); // ൊ precomposed
  assert.equal(w('\u0D15\u0D46\u0D3E\u0D1E\u0D4D\u0D1A\u0D3F'), 'konchi'); // െ + ാ
  assert.equal(w('\u0D2A\u0D47\u0D3E\u0D32\u0D46'), 'pole'); // ോ as േ + ാ
  assert.equal(w('ഔ'), 'au');
  assert.equal(w('\u0D15\u0D46\u0D57'), w('\u0D15\u0D4C'));
});

test('lines keep punctuation and English, digits convert, first letter capitalised', () => {
  assert.equal(transliterateLine('മലരേ നിന്നെ കാണാതിരുന്നാൽ'), 'Malare ninne kaanaathirunnaal');
  assert.equal(transliterateLine('എന്റെ ഖൽബിലെ, baby!'), 'Ente khalbile, baby!');
  assert.equal(transliterateLine('Oh, കാറ്റ് മൂളിയോ?'), 'Oh, kaattu mooliyo?');
  assert.equal(transliterateLine('൧൨ പൂക്കൾ'), '12 Pookkal');
  assert.equal(transliterateLine('ആയ് ആയ് ആയ് തെന്നല് പോലെ'), 'Aay aay aay thennal pole');
});

test('emoji joiners next to Malayalam are left alone', () => {
  const family = '👨‍👩‍👧';
  assert.equal(transliterateLine(`അമ്മ ${family}`), `Amma ${family}`);
});

test('script detection', () => {
  assert.equal(scriptOf('Baby, എന്റെ'), 'ml');
  assert.equal(scriptInfo('ml').symbol, 'അ');
});
