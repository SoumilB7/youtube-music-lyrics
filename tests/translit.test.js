const test = require('node:test');
const assert = require('node:assert/strict');
const { transliterateWord: w, transliterateLine } = require('../src/translit.js');

test('schwa deletion', () => {
  assert.equal(w('दिल'), 'dil');
  assert.equal(w('धड़कन'), 'dhadkan');
  assert.equal(w('समझना'), 'samajhna');
  assert.equal(w('मोहब्बत'), 'mohabbat');
  assert.equal(w('बरसात'), 'barsaat');
  assert.equal(w('साजन'), 'saajan');
  assert.equal(w('न'), 'na');
});

test('final schwa kept after Sanskrit clusters, dropped for Urdu', () => {
  assert.equal(w('मित्र'), 'mitra');
  assert.equal(w('सत्य'), 'satya');
  assert.equal(w('ज़िक्र'), 'zikr');
  assert.equal(w('इश्क़'), 'ishq');
});

test('nasals', () => {
  assert.equal(w('आँखें'), 'aankhein');
  assert.equal(w('रंग'), 'rang');
  assert.equal(w('अंबर'), 'ambar');
  assert.equal(w('ज़िंदगी'), 'zindagi');
  assert.equal(w('बातें'), 'baatein');
});

test('special clusters and vowels', () => {
  assert.equal(w('अच्छा'), 'accha');
  assert.equal(w('ज्ञान'), 'gyaan');
  assert.equal(w('कृपा'), 'kripa');
  assert.equal(w('गए'), 'gaye');
  assert.equal(w('विश्वास'), 'vishwaas');
  assert.equal(w('हवा'), 'hawa');
});

test('common words', () => {
  assert.equal(w('है'), 'hai');
  assert.equal(w('नहीं'), 'nahi');
  assert.equal(w('क्यों'), 'kyun');
  assert.equal(w('हमसफ़र'), 'humsafar');
});

test('NFC-decomposed and precomposed nukta letters give the same result', () => {
  assert.equal(w('ज़िक्र'), 'zikr'); // precomposed ज़
  assert.equal(w('ज़िक्र'), 'zikr'); // ज + nukta
});

test('lines keep punctuation and Latin text, capitalise, drop danda', () => {
  assert.equal(transliterateLine('कैसे तुझसे दिल ना लगाए कोई?'), 'Kaise tujhse dil na lagaaye koi?');
  assert.equal(transliterateLine('Baby, तू मेरा है।'), 'Baby, tu mera hai');
  assert.equal(transliterateLine('Already romanised'), 'Already romanised');
});
