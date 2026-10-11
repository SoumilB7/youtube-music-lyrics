const test = require('node:test');
const assert = require('node:assert/strict');
require('../src/translit.js');
const { romaniseWord: w } = require('../src/scripts/gujarati.js');
const { transliterateLine, scriptOf, scriptInfo } = require('../src/translit.js');

test('registers as Gujarati', () => {
  assert.equal(scriptOf('તારી વાટ'), 'gu');
  assert.deepEqual(scriptInfo('gu'), { code: 'gu', name: 'Gujarati', symbol: 'અ' });
});

test('common words', () => {
  assert.equal(w('છે'), 'che');
  assert.equal(w('હું'), 'hu');
  assert.equal(w('તું'), 'tu');
  assert.equal(w('નથી'), 'nathi');
  assert.equal(w('મારું'), 'maru');
  assert.equal(w('શું'), 'shu');
  assert.equal(w('કેમ'), 'kem');
  assert.equal(w('અને'), 'ane');
  assert.equal(w('કહેવું'), 'kehvu');
});

test('schwa deletion like Hindi', () => {
  assert.equal(w('ઘટ'), 'ghat');
  assert.equal(w('મળવા'), 'malva');
  assert.equal(w('વાદલડી'), 'vadaldi');
  assert.equal(w('સરોવર'), 'sarovar');
  assert.equal(w('ન'), 'na');
});

test('schwa after a nasalised vowel is dropped too', () => {
  assert.equal(w('ચાંદની'), 'chandni');
  assert.equal(w('રંગભેરૂ'), 'rangbheru');
});

test('vowel signs are short, a word-initial આ stays long', () => {
  assert.equal(w('મારા'), 'mara');
  assert.equal(w('બિરાજતા'), 'birajta');
  assert.equal(w('છોગાળા'), 'chogala');
  assert.equal(w('આવો'), 'aavo');
  assert.equal(w('મીઠો'), 'mitho');
  assert.equal(w('ધૂળ'), 'dhul');
});

test('nasals: kept before consonants, dropped at the end', () => {
  assert.equal(w('રંગ'), 'rang');
  assert.equal(w('અંબર'), 'ambar');
  assert.equal(w('આંખો'), 'aankho');
  assert.equal(w('માં'), 'ma');
  assert.equal(w('ઊમટ્યાં'), 'umatya');
});

test('consonants: ળ, ફ, વ, છ and conjuncts', () => {
  assert.equal(w('ગોકુળ'), 'gokul');
  assert.equal(w('ફૂલ'), 'ful');
  assert.equal(w('હવે'), 'have');
  assert.equal(w('છોડી'), 'chodi');
  assert.equal(w('વ્હાલમ'), 'vhalam');
  assert.equal(w('શ્યામ'), 'shyam');
  assert.equal(w('પ્રેમ'), 'prem');
  assert.equal(w('ગદ્દાર'), 'gaddar');
  assert.equal(w('ત્યારે'), 'tyare');
});

test('vowel after vowel', () => {
  assert.equal(w('ગઈ'), 'gai');
  assert.equal(w('ભવાઈ'), 'bhavai');
});

test('NFC-decomposed input gives the same result', () => {
  assert.equal(w('મારું'.normalize('NFD')), 'maru');
});

test('lines keep punctuation and Latin text, capitalise, map digits', () => {
  assert.equal(transliterateLine('છોગાળા તારા, છબીલા તારા, રંગીલા તારા'), 'Chogala tara, chabila tara, rangila tara');
  assert.equal(transliterateLine('વ્હાલમ આવો ને, આવો ને'), 'Vhalam aavo ne, aavo ne');
  assert.equal(transliterateLine('કે માંડી છે love ની ભવાઈ'), 'Ke mandi che love ni bhavai');
  assert.equal(transliterateLine('કેવી આ દિલ ની સગાઇ?'), 'Kevi aa dil ni sagai?');
  assert.equal(transliterateLine('મેં ૧૦ વાર કહ્યું છે।'), 'Me 10 var kahyu che');
  assert.equal(transliterateLine('Baby, તું આવ'), 'Baby, tu aav');
});
