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
  assert.equal(w('गाँव'), 'gaanv');
});

test('common words', () => {
  assert.equal(w('है'), 'hai');
  assert.equal(w('नहीं'), 'nahi');
  assert.equal(w('क्यों'), 'kyun');
  assert.equal(w('हमसफ़र'), 'humsafar');
  assert.equal(w('केसरिया'), 'kesariya');
  assert.equal(transliterateLine('लव-स्टोरियाँ'), 'Love-storiyaan');
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

const { scriptOf, scriptInfo } = require('../src/translit.js');

test('Punjabi (Gurmukhi) romanises like Hinglish', () => {
  assert.equal(transliterateLine('ਤੂੰ ਸਾਰਿਆਂ ਫ਼ਿਕਰਾਂ ਨੂੰ ਛੱਡ ਕੇ'), 'Tu saariyaan fikraan nu chhad ke');
  assert.equal(transliterateLine('ਕੁੜੀ ਨੂੰ ਨੱਚਣੇ ਦੇ (oh), ਹਾਂ'), 'Kudi nu nachne de (oh), haan');
  assert.equal(transliterateLine('ਮੈਨੂੰ ਤੇਰੀ ਯਾਦ ਆਉਂਦੀ ਏ'), 'Mainu teri yaad aaundi e');
  assert.equal(transliterateLine('ਦਿਲ ਦੀਆਂ ਗੱਲਾਂ'), 'Dil diyaan galaan');
  assert.equal(transliterateLine('੧੨ ਵਜੇ'), '12 Vaje');
});

test('Gurmukhi nukta letters work stored either way', () => {
  // ਸ਼ as one code point vs ਸ + nukta; NFC stores both as the pair.
  assert.equal(transliterateLine('ਸ਼ੇਰ'), 'Sher');
  assert.equal(transliterateLine('ਸ਼ੇਰ'), 'Sher');
  assert.equal(transliterateLine('ਖ਼ਾਨ'), 'Khaan');
});

test('script detection picks the button symbol', () => {
  assert.equal(scriptOf('Baby, ਨੱਚਣੇ ਦੇ'), 'pa');
  assert.equal(scriptOf('तू मेरा'), 'hi');
  assert.equal(scriptOf('only English'), null);
  assert.equal(scriptInfo('pa').symbol, 'ਪ');
});

test('emoji joiners on a Hindi line are left alone', () => {
  assert.equal(transliterateLine('तू मेरा 👩‍❤️‍👨'), 'Tu mera 👩‍❤️‍👨');
});
