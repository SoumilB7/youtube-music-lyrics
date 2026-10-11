const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/translit.js');
const { romaniseWord: w } = require('../src/scripts/kannada.js');
const { transliterateLine, scriptOf, scriptInfo } = require('../src/translit.js');

test('inherent a is kept (no schwa deletion)', () => {
  assert.equal(w('ಮನಸು'), 'manasu');
  assert.equal(w('ಕನಸು'), 'kanasu');
  assert.equal(w('ಗಮನ'), 'gamana');
  assert.equal(w('ರಾಜಕುಮಾರ'), 'raajakumaara');
});

test('virama clusters and doubled consonants', () => {
  assert.equal(w('ಬೆಳಗೆದ್ದು'), 'belageddu');
  assert.equal(w('ನಿನ್ನಿಂದಲೇ'), 'ninnindale');
  assert.equal(w('ಮುದ್ದಾಡಿ'), 'muddaadi');
  assert.equal(w('ಹೆಚ್ಚಿ'), 'hecchi');
  assert.equal(w('ಮತ್ತೆ'), 'matte');
  assert.equal(w('ಅದೃಷ್ಟಾನೋ'), 'adrushtaano');
  assert.equal(w('ಕ್ಷಣವು'), 'kshanavu');
});

test('anusvara: m at the end and before labials, n before other stops', () => {
  assert.equal(w('ಬೊಂಬೆ'), 'bombe');
  assert.equal(w('ಮುಂದೆ'), 'munde');
  assert.equal(w('ಹಂಚಿರುವ'), 'hanchiruva');
  assert.equal(w('ಸಂಸಾರ'), 'samsaara');
  assert.equal(w('ಸಿಂಹ'), 'simha');
  assert.equal(w('ಓಂ'), 'om');
});

test('long vowels, e/o and diphthongs', () => {
  assert.equal(w('ನಾನು'), 'naanu');
  assert.equal(w('ನೀನು'), 'neenu');
  assert.equal(w('ಪ್ರೀತಿ'), 'preethi');
  assert.equal(w('ಹೇಳು'), 'helu');
  assert.equal(w('ನೋಡಿದೆ'), 'nodide');
  assert.equal(w('ಜೊತೆ'), 'jothe');
  assert.equal(w('ವೈಟು'), 'vaitu');
  assert.equal(w('ಮೌನ'), 'mauna');
});

test('final long ee/oo shortened after the first syllable', () => {
  assert.equal(w('ಹುಡುಗೀ'), 'hudugi');
  assert.equal(w('ಎಂದೂ'), 'endu');
  assert.equal(w('ನೀ'), 'nee');
});

test('aspirates, sibilants and retroflex letters', () => {
  assert.equal(w('ಮುಖವ'), 'mukhava');
  assert.equal(w('ಆರಾಧಿಸೋ'), 'aaraadhiso');
  assert.equal(w('ಕಥೆಯು'), 'katheyu');
  assert.equal(w('ಆಕಾಶ'), 'aakaasha');
  assert.equal(w('ಬಣ್ಣ'), 'banna');
  assert.equal(w('ಬಳಿ'), 'bali');
  assert.equal(w('ಬಾೞ್'), 'baal');
});

test('special clusters and signs', () => {
  assert.equal(w('ಜ್ಞಾನ'), 'gnaana');
  assert.equal(w('ಹೃದಯ'), 'hrudaya');
  assert.equal(w('ಕೃಷ್ಣ'), 'krishna');
  assert.equal(w('ದುಃಖ'), 'duhkha');
  assert.equal(w('ಫ಼್ಯಾನ್'), 'fyaan');
  assert.equal(w('ಲವ್'), 'lav');
});

test('decomposed vowel signs match composed ones', () => {
  // ೀ = ಿ + ೕ, ೇ = ೆ + ೕ, ೊ = ೆ + ೂ, ೋ = ೊ + ೕ when decomposed.
  assert.equal(w('ನೀನು'), 'neenu');
  assert.equal(w('ಹೇಳು'), 'helu');
  assert.equal(w('ನೊಡಿ'), 'nodi');
  assert.equal(w('ನೋಡಿದೆ'.normalize('NFD')), 'nodide');
});

test('full lines', () => {
  assert.equal(transliterateLine('ಬೆಳಗೆದ್ದು ಯಾರ ಮುಖವ ನಾನು ನೋಡಿದೆ'), 'Belageddu yaara mukhava naanu nodide');
  assert.equal(transliterateLine('ಬೊಂಬೆ ಹೇಳುತೈತೆ, ಮತ್ತೆ ಹೇಳುತೈತೆ'), 'Bombe heluthaithe, matte heluthaithe');
  assert.equal(transliterateLine('ನೆನ್ನೆ ಕಂಡ ಕನಸು black and white'), 'Nenne kanda kanasu black and white');
  assert.equal(transliterateLine('(ನೀನೇ ರಾಜಕುಮಾರ)'), '(Neene raajakumaara)');
  assert.equal(transliterateLine('೨೦೨೨ ರಲ್ಲಿ  ಪ್ರೀತಿ ।'), '2022 Ralli preethi');
});

test('registered as Kannada', () => {
  assert.equal(scriptOf('ಬೊಂಬೆ'), 'kn');
  assert.deepEqual(scriptInfo('kn'), { code: 'kn', name: 'Kannada', symbol: 'ಅ' });
});
